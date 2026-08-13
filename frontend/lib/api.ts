const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

import type { DeliveryMode } from './types';

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  console.log(`[API] ${options.method ?? 'GET'} ${API_URL}${path}`);

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  console.log(`[API] ${options.method ?? 'GET'} ${path} → ${res.status}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string; message?: string };
    console.error(`[API] ===== ERROR HTTP =====`);
    console.error(`[API] Status: ${res.status} ${res.statusText}`);
    console.error(`[API] URL: ${res.url}`);
    console.error(`[API] Body:`, body);
    console.error(`[API] ======================`);

    // When body has both error (code) + message (human text), extract both
    const displayMessage = body.message ?? body.error ?? `HTTP ${res.status}`;
    const errorCode      = body.message !== undefined ? body.error : undefined;

    if (res.status === 401 && typeof window !== 'undefined') {
      const onPublicPage = ['/login', '/register'].some(p =>
        window.location.pathname.startsWith(p),
      );
      if (!onPublicPage) {
        fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
          .finally(() => { window.location.href = '/login'; });
      }
      throw new ApiError(displayMessage, errorCode);
    }

    if (res.status === 403 && typeof window !== 'undefined') {
      if (body.error === 'PLAN_REQUIRED') {
        window.location.href = '/select-plan';
        throw new ApiError(body.error);
      }
      if (body.error === 'CONNECTION_REQUIRED') {
        window.location.href = '/connect';
        throw new ApiError(body.error);
      }
    }

    throw new ApiError(displayMessage, errorCode);
  }

  const data = await res.json() as T;
  console.log(`[API] Response body:`, data);
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  register: (email: string, password: string) =>
    request<{ message: string }>(
      '/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  verifyEmail: (token: string) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
    ),
  // Admins with 2FA active get { requires_2fa: true, pendingToken } instead
  // of a session — the caller has to redirect to /verify-2fa and complete it
  // via auth.verifyLogin2FA before there's an actual logged-in session.
  login: (email: string, password: string) =>
    request<
      | { token: string; user: { id: string; email: string; role: string } }
      | { requires_2fa: true; pendingToken: string }
    >(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  verifyLogin2FA: (pendingToken: string, code: string) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      '/auth/login/verify-2fa', { method: 'POST', body: JSON.stringify({ pendingToken, code }) },
    ),
  resendVerification: (email: string) =>
    request<{ message: string }>(
      '/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) },
    ),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me:     () => request<{ user: { id: string; email: string; role: string } }>('/auth/me'),
};

// ── 2FA (TOTP) — admin only ──────────────────────────────────────────────────
export const twoFactor = {
  setup: () =>
    request<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' }),
  verifySetup: (code: string) =>
    request<{ backupCodes: string[] }>('/auth/2fa/verify-setup', {
      method: 'POST', body: JSON.stringify({ code }),
    }),
  disable: (password: string, code: string) =>
    request<{ message: string }>('/auth/2fa/disable', {
      method: 'POST', body: JSON.stringify({ password, code }),
    }),
};

// ── Client Profile ─────────────────────────────────────────────────────────
export const clients = {
  getProfile: () => request<{ profile: import('./types').ClientProfile }>('/clients/profile'),
  updateProfile: (data: { business_name: string; description: string }) =>
    request('/clients/profile', { method: 'PUT', body: JSON.stringify(data) }),
  uploadPhotos: (formData: FormData) =>
    fetch(`${API_URL}/clients/profile/photos`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(r => r.json()),
  selectPlan: (plan: import('./types').ServicePlan) =>
    request('/clients/profile/plan', { method: 'PUT', body: JSON.stringify({ plan }) }),
  choosePlan: (plan: import('./types').ServicePlan) =>
    request<{ profile: import('./types').ClientProfile }>('/clients/select-plan', {
      method: 'POST', body: JSON.stringify({ plan }),
    }),
  selectDeliveryMode: (delivery_mode: DeliveryMode) =>
    request<{ profile: import('./types').ClientProfile }>('/clients/select-delivery-mode', {
      method: 'POST', body: JSON.stringify({ delivery_mode }),
    }),
  getReelUsage: () =>
    request<{ used: number; quota: number }>('/clients/reel-usage'),
  getAttemptLimits: () =>
    request<{ maxCopyAttempts: number; maxVisualAttempts: number }>('/clients/attempt-limits'),
  updateDeliveryMode: (delivery_mode: DeliveryMode) =>
    request<{ profile: import('./types').ClientProfile }>('/clients/profile/delivery-mode', {
      method: 'PUT', body: JSON.stringify({ delivery_mode }),
    }),
  updateBrand: (data: {
    brand_primary_color?: string;
    brand_secondary_color?: string;
    brand_font?: string;
  }) => request('/clients/profile/brand', { method: 'PUT', body: JSON.stringify(data) }),
  uploadBrandLogo: (formData: FormData) =>
    fetch(`${API_URL}/clients/profile/brand/logo`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(r => r.json()),
};

// ── Credentials ────────────────────────────────────────────────────────────
export const credentials = {
  list: () =>
    request<{ credentials: import('./types').CredentialStatus[] }>('/credentials'),
  save: (platform: string, data: Record<string, string>) =>
    request(`/credentials/${platform}`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (platform: string) =>
    request(`/credentials/${platform}`, { method: 'DELETE' }),
};

// ── Campaigns ──────────────────────────────────────────────────────────────
export const campaigns = {
  list: () =>
    request<{ campaigns: import('./types').Campaign[] }>('/campaigns'),
  get: (id: string) =>
    request<{ campaign: import('./types').CampaignWithPosts }>(`/campaigns/${id}`),
  create: (data: {
    title:             string;
    platforms:         string[];
    month_year?:       string;
    lang?:             string;
    business_problem?: string;
    differentiator?:   string;
    ideal_client?:     string;
    concrete_result?:  string;
    client_pain?:      string;
  }) =>
    request<{ campaign: import('./types').Campaign }>(
      '/campaigns', { method: 'POST', body: JSON.stringify(data) },
    ),
  getPublications: (campaignId: string) =>
    request<{ publications: import('./types').Publication[] }>(
      `/campaigns/${campaignId}/publications`,
    ),
};

// ── Posts ──────────────────────────────────────────────────────────────────
export const posts = {
  list: (campaignId: string) =>
    request<{ posts: import('./types').Post[] }>(`/campaigns/${campaignId}/posts`),

  create: (campaignId: string, data: {
    platforms:        string[];
    format?:          import('./types').PostFormat;
    scheduled_date?:  string;
  }) =>
    request<{ post: import('./types').Post }>(`/campaigns/${campaignId}/posts`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  getPost: (postId: string) =>
    request<{ post: import('./types').PostWithDetails }>(`/posts/${postId}`),

  updateDescription: (postId: string, data: {
    post_focus?:      string;
    // Legacy fields (backward compat with old campaigns without business profile)
    problem?:         string;
    differentiator?:  string;
    ideal_client?:    string;
    concrete_result?: string;
    client_pain?:     string;
  }) =>
    request<{ post: import('./types').Post }>(`/posts/${postId}/description`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  generateCopy: (postId: string, lang?: string) =>
    request<{ post: import('./types').Post; strategies: import('./types').Strategy[] }>(
      `/posts/${postId}/generate-copy`,
      { method: 'POST', body: JSON.stringify({ lang }) },
    ),

  selectCopy: (postId: string, strategyId: string) =>
    request<{ post: import('./types').Post }>(`/posts/${postId}/select-copy`, {
      method: 'POST', body: JSON.stringify({ strategy_id: strategyId }),
    }),

  selectCopyWithPhotos: (postId: string, strategyId: string, photos: File[]) => {
    const form = new FormData();
    form.append('strategy_id', strategyId);
    photos.forEach(f => form.append('photos', f));
    return fetch(`${API_URL}/posts/${postId}/select-copy-with-photos`, {
      method:      'POST',
      credentials: 'include',
      body:        form,
    }).then(async r => {
      const body = await r.json() as { error?: string; post?: import('./types').Post };
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      return body as { post: import('./types').Post };
    });
  },

  selectVisual: (postId: string, variationId: string) =>
    request<{ post: import('./types').Post }>(`/posts/${postId}/select-visual`, {
      method: 'PATCH', body: JSON.stringify({ visual_variation_id: variationId }),
    }),

  confirm: (postId: string, options?: { overlay_logo?: boolean; overlay_copy?: boolean }) =>
    request<{ post: import('./types').Post; variationUrl: string | null }>(`/posts/${postId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ overlay_logo: options?.overlay_logo ?? false, overlay_copy: options?.overlay_copy ?? false }),
    }),

  update: (campaignId: string, postId: string, data: {
    scheduled_date?:      string;
    status?:              import('./types').PostStatus;
    platform?:            string;
    visual_variation_id?: string;
  }) =>
    request<{ post: import('./types').Post }>(`/campaigns/${campaignId}/posts/${postId}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
};

// ── OAuth (social connect) ─────────────────────────────────────────────────
export const oauth = {
  initFacebook: () =>
    request<{ url: string }>('/oauth/facebook/init', { method: 'POST' }),
  initTikTok: () =>
    request<{ url: string }>('/oauth/tiktok/init', { method: 'POST' }),
  getFacebookPages: (token: string) =>
    request<{ pages: Array<{ id: string; name: string }> }>(`/oauth/facebook/pages?token=${encodeURIComponent(token)}`),
  selectFacebookPage: (token: string, pageId: string) =>
    request<{ success: boolean }>('/oauth/facebook/select-page', {
      method: 'POST', body: JSON.stringify({ token, pageId }),
    }),
  disconnect: (platform: string) =>
    request<{ success: boolean }>(`/oauth/disconnect/${platform}`, { method: 'DELETE' }),
};

// ── Billing (Stripe) ───────────────────────────────────────────────────────
export const billing = {
  getStatus: () =>
    request<import('./types').SubscriptionStatus>('/billing/status'),
  createCheckout: (plan: string) =>
    request<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  createPortal: () =>
    request<{ url: string }>('/billing/portal', { method: 'POST' }),
  cancelSubscription: () =>
    request<{ success: boolean; currentPeriodEnd: string | null }>('/billing/cancel', { method: 'POST' }),
};

// ── Visual Variations (legacy) ─────────────────────────────────────────────
export const variations = {
  list: (campaignId: string) =>
    request<{ variations: import('./types').VisualVariation[] }>(
      `/campaigns/${campaignId}/variations`,
    ),
  select: (campaignId: string, variationId: string) =>
    request(`/campaigns/${campaignId}/variations/${variationId}/select`, { method: 'POST' }),
};

// ── Admin ──────────────────────────────────────────────────────────────────
export const admin = {
  stats: () => request<{
    totalClients: number; totalCampaigns: number;
    activeCampaigns: number; completedCampaigns: number;
  }>('/admin/stats'),
  listClients: () =>
    request<{ clients: import('./types').AdminClientRow[] }>('/admin/clients'),
  getClient: (id: string) =>
    request<{ client: import('./types').ClientProfile & { email: string; plan: string; campaigns: (import('./types').Campaign & { posts_used: number })[] } }>(
      `/admin/clients/${id}`,
    ),
  updateClient: (id: string, data: Partial<{ trial_posts_limit: number; admin_notes: string }>) =>
    request<{ success: boolean }>(`/admin/clients/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  updateCourtesy: (id: string, data: Partial<{
    is_courtesy:         boolean;
    courtesy_plan:       import('./types').ServicePlan | null;
    courtesy_expires_at: string | null;
  }>) =>
    request<{ success: boolean }>(`/admin/clients/${id}/courtesy`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
  listCampaigns: () =>
    request<{ campaigns: import('./types').Campaign[] }>('/admin/campaigns'),
  getCampaign: (id: string) =>
    request<{ campaign: Record<string, unknown> }>(`/admin/campaigns/${id}`),
  getPlanLimits: () =>
    request<{ planLimits: import('./types').PlanLimits[] }>('/admin/plan-limits'),
  updatePlanLimit: (plan: string, data: Partial<Omit<import('./types').PlanLimits, 'id' | 'plan' | 'created_at' | 'updated_at'>>) =>
    request<{ planLimit: import('./types').PlanLimits }>(`/admin/plan-limits/${plan}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),
  updateCampaignMaxPosts: (campaignId: string, maxPosts: number) =>
    request<{ success: boolean }>(`/admin/campaigns/${campaignId}/max-posts`, {
      method: 'PATCH', body: JSON.stringify({ max_posts: maxPosts }),
    }),
  updatePostAttempts: (postId: string, data: Partial<{ copy_generation_attempts: number; visual_generation_attempts: number }>) =>
    request<{ post: { id: string; copy_generation_attempts: number; visual_generation_attempts: number } }>(
      `/admin/posts/${postId}/attempts`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),
};
