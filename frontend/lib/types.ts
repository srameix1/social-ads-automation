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
  nameKey: string; benefitKey: string; price: number; posts: number; featureKeys: string[]; platforms: string[];
}> = {
  basic: {
    nameKey: 'plan_name_basic', benefitKey: 'plan_benefit_basic', price: 97, posts: 20,
    platforms: ['instagram', 'facebook'],
    featureKeys: [
      'plan_feature_basic_1',
      'plan_feature_basic_2',
      'plan_feature_basic_3',
    ],
  },
  professional: {
    nameKey: 'plan_name_professional', benefitKey: 'plan_benefit_professional', price: 197, posts: 24,
    platforms: ['instagram', 'facebook', 'tiktok'],
    featureKeys: [
      'plan_feature_pro_1',
      'plan_feature_pro_2',
      'plan_feature_pro_3',
      'plan_feature_pro_4',
    ],
  },
  premium: {
    nameKey: 'plan_name_premium', benefitKey: 'plan_benefit_premium', price: 397, posts: 30,
    platforms: ['instagram', 'facebook', 'tiktok'],
    featureKeys: [
      'plan_feature_premium_1',
      'plan_feature_premium_2',
      'plan_feature_premium_3',
      'plan_feature_pro_4',
    ],
  },
};

export interface ClientProfile {
  id:                    string;
  user_id:               string;
  business_name:         string;
  description:           string | null;
  timezone:              string;
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
  id:                string;
  campaign_id:       string;
  strategy_id:       string;
  media_asset_id:    string | null;
  internal_post_id:  string | null;
  platform:          string;
  status:            'pending' | 'processing' | 'published' | 'failed';
  post_id:           string | null;
  post_url:          string | null;
  error_message:     string | null;
  published_at:      string | null;
  created_at:        string;
}

export interface SubscriptionStatus {
  plan:              ServicePlan;
  status:            'inactive' | 'active' | 'past_due' | 'cancelled';
  subscriptionId:    string | null;
  currentPeriodEnd:  string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlan:       ServicePlan | null;
}
