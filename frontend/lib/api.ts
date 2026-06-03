const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  console.log(`[API] ${options.method ?? 'GET'} ${API_URL}${path}`);

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });

  console.log(`[API] ${options.method ?? 'GET'} ${path} → ${res.status}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    console.error(`[API] ===== ERROR HTTP =====`);
    console.error(`[API] Status: ${res.status} ${res.statusText}`);
    console.error(`[API] URL: ${res.url}`);
    console.error(`[API] Body:`, body);
    console.error(`[API] ======================`);

    // Session is invalid or expired — clear local auth and redirect to login.
    // Skip redirect if already on a public page to avoid infinite loops.
    if (res.status === 401 && typeof window !== 'undefined') {
      const onPublicPage = ['/login', '/register'].some(p =>
        window.location.pathname.startsWith(p),
      );
      if (!onPublicPage) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        // Call logout to clear httpOnly cookies on the backend, then redirect.
        // Without this, the Next.js middleware sees the stale cookie and
        // immediately redirects /login → /dashboard, creating an infinite loop.
        fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
          .finally(() => { window.location.href = '/login'; });
      }
      throw new Error(body.error ?? 'Sesión expirada. Por favor inicia sesión de nuevo.');
    }

    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as T;
  console.log(`[API] Response body:`, data);
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const auth = {
  register: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      '/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; role: string } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me:     () => request<{ user: { id: string; email: string; role: string } }>('/auth/me'),
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
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
      body: formData,
    }).then(r => r.json()),
  selectPlan: (plan: import('./types').ServicePlan) =>
    request('/clients/profile/plan', { method: 'PUT', body: JSON.stringify({ plan }) }),
  updateBrand: (data: {
    brand_primary_color?: string;
    brand_secondary_color?: string;
    brand_font?: string;
  }) => request('/clients/profile/brand', { method: 'PUT', body: JSON.stringify(data) }),
  uploadBrandLogo: (formData: FormData) =>
    fetch(`${API_URL}/clients/profile/brand/logo`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') ?? ''}` },
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
    request<{ campaign: import('./types').CampaignWithDetail }>(`/campaigns/${id}`),
  create: (data: {
    title: string;
    objective: string;
    target_audience: string;
    platforms: string[];
  }) => request<{ campaign: import('./types').CampaignWithDetail }>(
    '/campaigns', { method: 'POST', body: JSON.stringify(data) },
  ),
  selectStrategy: (campaignId: string, strategyId: string) =>
    request(`/campaigns/${campaignId}/strategies/${strategyId}/select`, { method: 'POST' }),
  retryPublishing: (campaignId: string) =>
    request(`/campaigns/${campaignId}/strategies/retry`, { method: 'POST' }),
  getPublications: (campaignId: string) =>
    request<{ publications: import('./types').Publication[] }>(
      `/campaigns/${campaignId}/publications`,
    ),
};

// ── Admin ──────────────────────────────────────────────────────────────────
export const admin = {
  stats: () => request<{
    totalClients: number; totalCampaigns: number;
    activeCampaigns: number; completedCampaigns: number;
  }>('/admin/stats'),
  listClients: () =>
    request<{ clients: import('./types').User[] }>('/admin/clients'),
  getClient: (id: string) =>
    request<{ client: import('./types').ClientProfile & { email: string; campaigns: import('./types').Campaign[] } }>(
      `/admin/clients/${id}`,
    ),
  listCampaigns: () =>
    request<{ campaigns: import('./types').Campaign[] }>('/admin/campaigns'),
  getCampaign: (id: string) =>
    request<{ campaign: import('./types').CampaignWithDetail }>(`/admin/campaigns/${id}`),
};
