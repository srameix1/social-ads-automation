export interface User {
  id:         string;
  email:      string;
  role:       'client' | 'admin';
  is_active:  boolean;
  created_at: string;
}

export type ServicePlan = 'basic' | 'professional' | 'premium';
export type DeliveryMode = 'automatic' | 'manual';

export const PLAN_DETAILS: Record<ServicePlan, {
  name: string; price: number; posts: number; features: string[]; platforms: string[];
}> = {
  basic: {
    name: 'Básico', price: 97, posts: 20,
    platforms: ['instagram', 'facebook'],
    features: [
      '20 posts al mes',
      'Imágenes generadas por IA con texto superpuesto',
      'Publicación en Instagram y Facebook',
    ],
  },
  professional: {
    name: 'Profesional', price: 197, posts: 24,
    platforms: ['instagram', 'facebook', 'tiktok'],
    features: [
      '24 posts al mes',
      'Logo de tu negocio en cada imagen',
      'Colores y tipografía de tu marca',
      'Publicación en Instagram, Facebook y TikTok',
    ],
  },
  premium: {
    name: 'Premium', price: 397, posts: 30,
    platforms: ['instagram', 'facebook', 'tiktok'],
    features: [
      '30 posts al mes',
      '8 videos cortos Veo 2 incluidos',
      'Videos de 6-8 segundos generados con IA',
      'Publicación en Instagram, Facebook y TikTok',
    ],
  },
};

export interface ClientProfile {
  id:                    string;
  user_id:               string;
  business_name:         string;
  description:           string | null;
  photo_1_url:           string | null;
  photo_2_url:           string | null;
  photo_3_url:           string | null;
  plan:                  ServicePlan;
  plan_selected_at:      string | null;
  delivery_mode:         'automatic' | 'manual' | null;
  service_period_started_at:     string | null;
  facebook_grace_period_ends_at: string | null;
  brand_logo_url:        string | null;
  brand_primary_color:   string | null;
  brand_secondary_color: string | null;
  brand_font:            string | null;
  setup_completed:       boolean;
  is_trial:              boolean;
  trial_posts_limit:     number;
  posts_used:            number;
  admin_notes:           string | null;
  registration_ip:       string | null;
  created_at:            string;
  updated_at:            string;
}

export interface AdminClientRow {
  id:                string;
  email:             string;
  is_active:         boolean;
  created_at:        string;
  business_name:     string;
  setup_completed:   boolean;
  plan:              ServicePlan;
  campaign_count:    string | number;
  is_trial:          boolean;
  trial_posts_limit: number;
  posts_used:        number;
  admin_notes:       string | null;
  registration_ip:   string | null;
  duplicate_ip:      boolean;
  is_courtesy:         boolean;
  courtesy_plan:       ServicePlan | null;
  courtesy_expires_at: string | null;
}

export interface CredentialStatus {
  platform:   'instagram' | 'tiktok' | 'facebook';
  connected:  boolean;
  updated_at: string | null;
}

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type PostFormat = 'image' | 'animated_video' | 'reel';
export type WorkflowStatus =
  | 'draft' | 'described' | 'generating_copy' | 'copy_ready'
  | 'generating_visuals' | 'visuals_ready' | 'visuals_failed'
  | 'visual_selected' | 'generating_video' | 'confirmed';

export interface Post {
  id:                  string;
  campaign_id:         string;
  strategy_id:         string | null;
  visual_variation_id: string | null;
  scheduled_date:      string | null;
  status:              PostStatus;
  platforms:           string[];
  platform:            string;
  format:              PostFormat;
  post_focus:          string | null;
  problem:             string | null;
  differentiator:      string | null;
  ideal_client:        string | null;
  concrete_result:     string | null;
  client_pain:         string | null;
  workflow_status:     WorkflowStatus;
  overlay_logo:        boolean;
  overlay_copy:        boolean;
  copy_generation_attempts:   number;
  visual_generation_attempts: number;
  selected_visual_url: string | null;
  published_at:        string | null;
  error_message:       string | null;
  created_at:          string;
  updated_at:          string;
}

export interface Strategy {
  id:             string;
  post_id:        string;
  title:          string;
  description:    string;
  copy_text:      string;
  visual_concept: string;
  tone:           string | null;
  target_hook:    string | null;
  position:       1 | 2 | 3;
  selected:       boolean;
  created_at:     string;
}

export interface VisualVariation {
  id:                    string;
  post_id:               string;
  strategy_id:           string | null;
  position:              1 | 2 | 3 | 4;
  url:                   string | null;
  type:                  'image' | 'video';
  status:                'generating' | 'ready' | 'failed';
  visual_concept_variant: string | null;
  selected:              boolean;
}

export interface PostWithDetails extends Post {
  strategies: Strategy[];
  variations: VisualVariation[];
}

export interface PlanLimits {
  id:                     string;
  plan:                   ServicePlan;
  max_posts_per_campaign: number;
  can_upload_photos:      boolean;
  can_generate_video:     boolean;
  can_generate_reel:      boolean;
  reel_quota:             number;
  max_copy_attempts:      number;
  max_visual_attempts:    number;
  created_at:             string;
  updated_at:             string;
}

export interface Campaign {
  id:               string;
  client_id:        string;
  title:            string;
  platforms:        string[];
  month_year:       string | null;
  start_date:       string | null;
  end_date:         string | null;
  max_posts:        number;
  posts_used:       number;
  business_problem: string | null;
  differentiator:   string | null;
  ideal_client:     string | null;
  concrete_result:  string | null;
  client_pain:      string | null;
  created_at:       string;
  updated_at:       string;
}

export interface CampaignWithPosts extends Campaign {
  posts: Post[];
}

// Backward-compat alias used by hooks and admin pages
export type CampaignWithDetail = CampaignWithPosts;

export interface Publication {
  id:             string;
  campaign_id:    string;
  strategy_id:    string;
  media_asset_id: string | null;
  platform:       string;
  status:         'pending' | 'published' | 'failed';
  post_id:        string | null;
  post_url:       string | null;
  error_message:  string | null;
  published_at:   string | null;
  created_at:     string;
}

export interface SubscriptionStatus {
  plan:              ServicePlan;
  status:            'inactive' | 'active' | 'past_due' | 'cancelled';
  subscriptionId:    string | null;
  currentPeriodEnd:  string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlan:       ServicePlan | null;
}
