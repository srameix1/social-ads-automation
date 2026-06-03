export type Lang = 'es' | 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TValue = string | ((...args: any[]) => string);
type Dict = Record<string, TValue>;

const es: Dict = {
  // Nav
  nav_dashboard:    'Dashboard',
  nav_campaigns:    'Campañas',
  nav_profile:      'Mi cuenta',
  nav_new_campaign: 'Nueva campaña',
  nav_logout:       'Cerrar sesión',

  // Login
  login_welcome:    'Bienvenido',
  login_subtitle:   'Ingresa a tu panel de control',
  login_email:      'Correo electrónico',
  login_password:   'Contraseña',
  login_submit:     'Iniciar sesión',
  login_no_account: '¿No tienes cuenta?',
  login_register:   'Regístrate gratis',
  login_tagline:    'Publicidad en redes potenciada por IA',
  login_tagline_sub:'Claude genera las estrategias. Gemini crea las imágenes. Tú solo apruebas.',
  login_feature1:   'Estrategias publicitarias en segundos',
  login_feature2:   'Imágenes y videos generados con IA',
  login_feature3:   'Publica en Instagram, Facebook y TikTok',
  login_copyright:  '© 2025 SANADDS by RAMEIX LLC',

  // Register
  register_title:             'Crear cuenta',
  register_subtitle:          'Empieza gratis, cancela cuando quieras',
  register_password_placeholder: 'Mínimo 8 caracteres',
  register_confirm:           'Confirmar contraseña',
  register_confirm_placeholder: 'Repite la contraseña',
  register_submit:            'Crear cuenta gratis',
  register_has_account:       '¿Ya tienes cuenta?',
  register_login:             'Iniciar sesión',
  register_tos:               'Al registrarte aceptas nuestros términos de servicio',
  register_err_mismatch:      'Las contraseñas no coinciden',
  register_err_short:         'Mínimo 8 caracteres',

  // Dashboard
  dash_welcome:         'Bienvenido de vuelta',
  dash_title:           'Dashboard',
  dash_total:           'Total campañas',
  dash_in_progress:     'En proceso',
  dash_completed:       'Completadas',
  dash_action_required: 'Acción requerida',
  dash_action_sub:      (n: number) => `${n} campaña${n > 1 ? 's' : ''} esperando que elijas una estrategia`,
  dash_action_btn:      'Ver ahora →',
  dash_recent:          'Campañas recientes',
  dash_see_all:         'Ver todas →',
  dash_empty_title:     'Sin campañas todavía',
  dash_empty_sub:       'Crea tu primera campaña y la IA generará 3 estrategias publicitarias en segundos.',
  dash_empty_btn:       'Crear primera campaña',

  // Campaigns list
  camp_title:       'Campañas',
  camp_total:       (n: number) => `${n} campañas en total`,
  camp_new:         'Nueva campaña',
  camp_empty_title: 'Sin campañas todavía',
  camp_empty_sub:   'La IA genera 3 estrategias distintas para cada campaña. Solo eliges la que más te gusta.',
  camp_empty_btn:   'Crear primera campaña',

  // Campaign detail
  camp_back:           'Mis campañas',
  camp_not_found:      'Campaña no encontrada',
  camp_not_found_link: '← Volver a campañas',
  camp_generating:     'Claude está analizando tu negocio y generando 3 estrategias publicitarias... (30–60 seg)',
  camp_media:          'Gemini está creando tus imágenes publicitarias...',
  camp_publishing:     'Publicando en tus redes sociales...',
  camp_details:        'Detalles',
  camp_objective:      'Objetivo',
  camp_platforms:      'Plataformas',
  camp_audience:       'Audiencia objetivo',
  camp_3_ready:        '3 estrategias listas',
  camp_3_sub:          'Claude generó 3 enfoques distintos. Elige el que mejor conecta con tu audiencia.',
  camp_choose:         'Ver y elegir estrategia →',
  camp_published:      'Campaña publicada exitosamente',
  camp_publications:   'Publicaciones',

  // New campaign page
  new_camp_title: 'Nueva campaña',
  new_camp_sub:   'Claude generará 3 estrategias distintas. Tú eliges la mejor.',

  // Campaign request form
  form_camp_title:           'Título de la campaña',
  form_camp_title_ph:        'Ej: Lanzamiento menú de verano',
  form_camp_objective:       'Objetivo de la campaña',
  form_camp_objective_ph:    '¿Qué quieres lograr? Más ventas, dar a conocer un producto, generar reservas...',
  form_camp_audience:        'Audiencia objetivo',
  form_camp_audience_ph:     '¿A quién le hablas? Edad, intereses, ubicación, comportamiento...',
  form_camp_platforms:       'Plataformas',
  form_camp_generating:      'Claude está generando 3 estrategias para tu campaña... (30–60 segundos)',
  form_camp_submit:          'Generar estrategias con IA',
  form_camp_err_title:       'El título es requerido',
  form_camp_err_objective:   'El objetivo es requerido',
  form_camp_err_platform:    'Selecciona al menos una plataforma',
  form_camp_err_generate:    'Error al generar estrategias. Revisa tu API key de Anthropic.',

  // Profile page
  prof_title:         'Mi cuenta',
  prof_sub:           'Configuración del negocio y redes sociales',
  prof_business:      'Negocio',
  prof_name:          'Nombre del negocio',
  prof_description:   'Descripción',
  prof_complete:      '✓ Perfil completo',
  prof_pending:       '⚠ Setup pendiente',
  prof_social:        'Redes sociales',
  prof_encrypted:     'Cifradas con AES-256. Nunca se comparten.',
  prof_connected:     'Conectado',
  prof_not_connected: 'Sin conectar',
  prof_connect:       'Conectar',
  prof_update:        'Actualizar',
  prof_modal_title:   (p: string) => `Conectar ${p}`,
  prof_modal_sub:     'Tus credenciales se cifran con AES-256 antes de almacenarse.',
  prof_save_creds:    'Guardar credenciales',
  prof_updated_at:    (d: string) => `Actualizado ${d}`,

  // Setup page
  setup_title: 'Configura tu perfil',
  setup_sub:   'Solo lo haces una vez. La IA usará esta información para crear publicidad personalizada.',

  // ProfileSetupForm steps
  step_plan:    'Plan',
  step_business:'Negocio',
  step_photos:  'Fotos',
  step_brand:   'Marca',
  step_done:    'Listo',

  step1_title: 'Elige tu plan',
  step1_sub:   'Puedes cambiarlo en cualquier momento.',
  step1_btn:   'Continuar →',
  step1_err:   'Selecciona un plan para continuar',

  step2_title:   'Tu negocio',
  step2_sub:     'La IA usa esto para crear publicidad personalizada.',
  step2_name:    'Nombre del negocio',
  step2_name_ph: 'Ej: CardetailingWP',
  step2_desc:    'Descripción',
  step2_desc_ph: 'Qué ofreces, tu propuesta de valor, qué te hace especial...',
  step2_desc_hint:'Cuanto más detallado, mejores resultados',
  step2_btn:     'Continuar →',
  step2_err:     'Nombre del negocio requerido',

  step3_title:      'Fotos de tu negocio',
  step3_sub:        'La IA analiza estas fotos para generar contenido visual personalizado.',
  step3_photo:      (n: number) => `Foto ${n}`,
  step3_btn_upload: 'Subiendo fotos...',
  step3_btn:        'Guardar fotos →',
  step3_err:        'Sube las 3 fotos de tu negocio',

  // BrandSetupForm
  brand_title:    'Identidad de marca',
  brand_sub:      'Tu logo y colores se aplicarán automáticamente en todas las imágenes generadas.',
  brand_logo:     'Logo del negocio',
  brand_logo_click:'Haz clic para subir tu logo',
  brand_logo_hint: 'PNG con fondo transparente recomendado',
  brand_primary:  'Color principal',
  brand_secondary:'Color secundario',
  brand_preview:  'Vista previa de colores de marca',
  brand_skip:     'Omitir por ahora',
  brand_save:     'Guardar marca →',

  // PlanSelector
  plan_popular: 'Más popular',
  plan_all_in:  'Todo incluido',
  plan_month:   '/mes',

  // Done step
  done_title: '¡Perfil listo!',
  done_sub:   'Ya puedes crear tu primera campaña publicitaria.',
  done_btn:   'Ir al dashboard →',

  // Campaign failed — no credentials
  camp_no_creds_title: 'Campaña lista para publicar',
  camp_no_creds_sub:   'Conecta tus redes sociales en Mi cuenta para que podamos publicar automáticamente.',
  camp_no_creds_btn:   'Ir a Mi cuenta →',
  camp_retry_btn:      'Reintentar publicación',
  camp_retrying:       'Reintentando...',

  // Strategy selection page
  strat_title:       'Elige tu estrategia',
  strat_sub:         'Claude generó 3 enfoques distintos. Selecciona el que mejor representa a tu negocio.',
  strat_not_found:   'Campaña no encontrada',
  strat_not_pending: 'Esta campaña no está esperando selección.',
  strat_back_camp:   '← Volver a la campaña',

  // StrategyCard
  strat_option_a:  'Opción A',
  strat_option_b:  'Opción B',
  strat_option_c:  'Opción C',
  strat_hook:      'GANCHO PRINCIPAL',
  strat_copy:      'TEXTO DEL ANUNCIO',
  strat_visual:    'CONCEPTO VISUAL',
  strat_select:    'Elegir esta estrategia',
  strat_selecting: 'Guardando...',
};

const en: Dict = {
  // Nav
  nav_dashboard:    'Dashboard',
  nav_campaigns:    'Campaigns',
  nav_profile:      'My account',
  nav_new_campaign: 'New campaign',
  nav_logout:       'Sign out',

  // Login
  login_welcome:    'Welcome back',
  login_subtitle:   'Sign in to your dashboard',
  login_email:      'Email address',
  login_password:   'Password',
  login_submit:     'Sign in',
  login_no_account: "Don't have an account?",
  login_register:   'Sign up for free',
  login_tagline:    'Social media advertising powered by AI',
  login_tagline_sub:'Claude builds strategies. Gemini creates visuals. You just approve.',
  login_feature1:   'Ad strategies generated in seconds',
  login_feature2:   'AI-generated images and videos',
  login_feature3:   'Publish to Instagram, Facebook and TikTok',
  login_copyright:  '© 2025 SANADDS by RAMEIX LLC',

  // Register
  register_title:             'Create account',
  register_subtitle:          'Start free, cancel anytime',
  register_password_placeholder: 'At least 8 characters',
  register_confirm:           'Confirm password',
  register_confirm_placeholder: 'Repeat your password',
  register_submit:            'Create free account',
  register_has_account:       'Already have an account?',
  register_login:             'Sign in',
  register_tos:               'By signing up you agree to our terms of service',
  register_err_mismatch:      'Passwords do not match',
  register_err_short:         'Minimum 8 characters',

  // Dashboard
  dash_welcome:         'Welcome back',
  dash_title:           'Dashboard',
  dash_total:           'Total campaigns',
  dash_in_progress:     'In progress',
  dash_completed:       'Completed',
  dash_action_required: 'Action required',
  dash_action_sub:      (n: number) => `${n} campaign${n > 1 ? 's' : ''} waiting for your strategy selection`,
  dash_action_btn:      'View now →',
  dash_recent:          'Recent campaigns',
  dash_see_all:         'View all →',
  dash_empty_title:     'No campaigns yet',
  dash_empty_sub:       'Create your first campaign and the AI will generate 3 ad strategies in seconds.',
  dash_empty_btn:       'Create first campaign',

  // Campaigns list
  camp_title:       'Campaigns',
  camp_total:       (n: number) => `${n} campaign${n > 1 ? 's' : ''} total`,
  camp_new:         'New campaign',
  camp_empty_title: 'No campaigns yet',
  camp_empty_sub:   'The AI generates 3 distinct strategies for each campaign. Pick the one you like best.',
  camp_empty_btn:   'Create first campaign',

  // Campaign detail
  camp_back:           'My campaigns',
  camp_not_found:      'Campaign not found',
  camp_not_found_link: '← Back to campaigns',
  camp_generating:     'Claude is analyzing your business and generating 3 ad strategies... (30–60 sec)',
  camp_media:          'Gemini is creating your ad images...',
  camp_publishing:     'Publishing to your social networks...',
  camp_details:        'Details',
  camp_objective:      'Objective',
  camp_platforms:      'Platforms',
  camp_audience:       'Target audience',
  camp_3_ready:        '3 strategies ready',
  camp_3_sub:          'Claude generated 3 distinct approaches. Choose the one that best connects with your audience.',
  camp_choose:         'View and choose strategy →',
  camp_published:      'Campaign published successfully',
  camp_publications:   'Publications',

  // New campaign page
  new_camp_title: 'New campaign',
  new_camp_sub:   'Claude will generate 3 distinct strategies. You choose the best one.',

  // Campaign request form
  form_camp_title:           'Campaign title',
  form_camp_title_ph:        'E.g.: Summer menu launch',
  form_camp_objective:       'Campaign objective',
  form_camp_objective_ph:    'What do you want to achieve? More sales, product awareness, reservations...',
  form_camp_audience:        'Target audience',
  form_camp_audience_ph:     'Who are you talking to? Age, interests, location, behavior...',
  form_camp_platforms:       'Platforms',
  form_camp_generating:      'Claude is generating 3 strategies for your campaign... (30–60 seconds)',
  form_camp_submit:          'Generate strategies with AI',
  form_camp_err_title:       'Title is required',
  form_camp_err_objective:   'Objective is required',
  form_camp_err_platform:    'Select at least one platform',
  form_camp_err_generate:    'Error generating strategies. Check your Anthropic API key.',

  // Profile page
  prof_title:         'My account',
  prof_sub:           'Business settings and social networks',
  prof_business:      'Business',
  prof_name:          'Business name',
  prof_description:   'Description',
  prof_complete:      '✓ Profile complete',
  prof_pending:       '⚠ Setup pending',
  prof_social:        'Social networks',
  prof_encrypted:     'Encrypted with AES-256. Never shared.',
  prof_connected:     'Connected',
  prof_not_connected: 'Not connected',
  prof_connect:       'Connect',
  prof_update:        'Update',
  prof_modal_title:   (p: string) => `Connect ${p}`,
  prof_modal_sub:     'Your credentials are encrypted with AES-256 before storage.',
  prof_save_creds:    'Save credentials',
  prof_updated_at:    (d: string) => `Updated ${d}`,

  // Setup page
  setup_title: 'Set up your profile',
  setup_sub:   'You only do this once. The AI will use this info to create personalized ads.',

  // ProfileSetupForm steps
  step_plan:    'Plan',
  step_business:'Business',
  step_photos:  'Photos',
  step_brand:   'Brand',
  step_done:    'Done',

  step1_title: 'Choose your plan',
  step1_sub:   'You can change it at any time.',
  step1_btn:   'Continue →',
  step1_err:   'Select a plan to continue',

  step2_title:   'Your business',
  step2_sub:     'The AI uses this to create personalized advertising.',
  step2_name:    'Business name',
  step2_name_ph: 'E.g.: CardetailingWP',
  step2_desc:    'Description',
  step2_desc_ph: 'What you offer, your value prop, what makes you special...',
  step2_desc_hint:'More detail = better results',
  step2_btn:     'Continue →',
  step2_err:     'Business name is required',

  step3_title:      'Business photos',
  step3_sub:        'The AI analyzes these photos to generate personalized visual content.',
  step3_photo:      (n: number) => `Photo ${n}`,
  step3_btn_upload: 'Uploading photos...',
  step3_btn:        'Save photos →',
  step3_err:        'Upload all 3 photos of your business',

  // BrandSetupForm
  brand_title:     'Brand identity',
  brand_sub:       'Your logo and colors will be applied automatically to all generated images.',
  brand_logo:      'Business logo',
  brand_logo_click:'Click to upload your logo',
  brand_logo_hint: 'PNG with transparent background recommended',
  brand_primary:   'Primary color',
  brand_secondary: 'Secondary color',
  brand_preview:   'Brand color preview',
  brand_skip:      'Skip for now',
  brand_save:      'Save brand →',

  // PlanSelector
  plan_popular: 'Most popular',
  plan_all_in:  'All included',
  plan_month:   '/mo',

  // Done step
  done_title: 'Profile ready!',
  done_sub:   'You can now create your first ad campaign.',
  done_btn:   'Go to dashboard →',

  // Campaign failed — no credentials
  camp_no_creds_title: 'Campaign ready to publish',
  camp_no_creds_sub:   'Connect your social networks in My Account so we can publish automatically.',
  camp_no_creds_btn:   'Go to My Account →',
  camp_retry_btn:      'Retry publishing',
  camp_retrying:       'Retrying...',

  // Strategy selection page
  strat_title:       'Choose your strategy',
  strat_sub:         'Claude generated 3 distinct approaches. Pick the one that best fits your business.',
  strat_not_found:   'Campaign not found',
  strat_not_pending: 'This campaign is not waiting for a strategy selection.',
  strat_back_camp:   '← Back to campaign',

  // StrategyCard
  strat_option_a:  'Option A',
  strat_option_b:  'Option B',
  strat_option_c:  'Option C',
  strat_hook:      'MAIN HOOK',
  strat_copy:      'AD COPY',
  strat_visual:    'VISUAL CONCEPT',
  strat_select:    'Choose this strategy',
  strat_selecting: 'Saving...',
};

export const translations: Record<Lang, Dict> = { es, en };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function translate(lang: Lang, key: string, ...args: any[]): string {
  const val = translations[lang][key];
  if (val === undefined) return key;
  if (typeof val === 'function') return val(...args);
  return val;
}
