export interface User {
  id:         string;
  email:      string;
  role:       'client' | 'admin';
  is_active:  boolean;
  created_at: string;
}

export type ServicePlan = 'basic' | 'professional' | 'premium';

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
    name: 'Profesional', price: 197, posts: 20,
    platforms: ['instagram', 'facebook', 'tiktok'],
    features: [
      '20 posts al mes',
      'Logo de tu negocio en cada imagen',
      'Colores y tipografía de tu marca',
      'Publicación en Instagram, Facebook y TikTok',
    ],
  },
  premium: {
    name: 'Premium', price: 397, posts: 20,
    platforms: ['instagram', 'facebook', 'tiktok'],
    features: [
      '20 posts al mes (igual que Profesional)',
      '12 videos cortos al mes con IA (Reels y Stories)',
      'Videos de 6-8 segundos generados con Veo 2',
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
  brand_logo_url:        string | null;
  brand_primary_color:   string | null;
  brand_secondary_color: string | null;
  brand_font:            string | null;
  setup_completed:       boolean;
  created_at:            string;
  updated_at:            string;
}

export interface CredentialStatus {
  platform:   'instagram' | 'tiktok' | 'facebook';
  connected:  boolean;
  updated_at: string | null;
}

export type CampaignStatus =
  | 'draft'
  | 'generating'
  | 'pending_selection'
  | 'creating_media'
  | 'publishing'
  | 'completed'
  | 'failed';

export interface Campaign {
  id:              string;
  client_id:       string;
  title:           string;
  objective:       string | null;
  target_audience: string | null;
  platforms:       string[];
  status:          CampaignStatus;
  error_message:   string | null;
  created_at:      string;
  updated_at:      string;
}

export interface Strategy {
  id:             string;
  campaign_id:    string;
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

export interface MediaAsset {
  id:          string;
  campaign_id: string;
  strategy_id: string;
  type:        'image' | 'video';
  status:      'pending' | 'generating' | 'ready' | 'failed';
  platform:    string;
  url:         string | null;
  created_at:  string;
}

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

export interface CampaignWithDetail extends Campaign {
  strategies:   Strategy[];
  publications: Publication[];
}
