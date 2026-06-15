export interface CopyAngle {
  id:          string;
  name:        string;
  description: string;
  instruction: string;
  toneRef:     string;
  rule:        string;
}

export interface SearchTemplate {
  id:         string;
  name:       string;
  buildQuery: (niche: string) => string;
}

export const COPY_ANGLES: CopyAngle[] = [
  {
    id:          'fear',
    name:        'MIEDO / PÉRDIDA',
    description: 'lo que pierdes si no actúas',
    instruction:
      'Enfócate EXCLUSIVAMENTE en lo que el cliente PIERDE si no actúa.\n' +
      'El dolor de no tener el producto. La pérdida económica, emocional o de status.\n' +
      'Cuantifica la pérdida cuando sea posible. Crea urgencia real, no artificial.',
    toneRef: '"Tu auto pierde $15,000 de valor cada año sin protección."',
    rule:    'el copy_text DEBE arrancar desde el dolor de la pérdida o el costo de no actuar.',
  },
  {
    id:          'status',
    name:        'STATUS / IDENTIDAD',
    description: 'quién eres cuando usas esto',
    instruction:
      'Enfócate EXCLUSIVAMENTE en quién SE CONVIERTE el cliente.\n' +
      'El prestigio, el reconocimiento, la identidad aspiracional que obtiene.\n' +
      'No hables del producto — habla de la persona en la que se transforman al usarlo.',
    toneRef: '"La gente que cuida lo que construyó."',
    rule:    'el copy_text DEBE hablar de identidad, pertenencia o tribu, nunca de características.',
  },
  {
    id:          'logic',
    name:        'LÓGICA / AHORRO',
    description: 'los números tienen sentido',
    instruction:
      'Enfócate EXCLUSIVAMENTE en los NÚMEROS y el sentido común.\n' +
      'ROI, comparación de costos, argumento racional y cuantificable.\n' +
      'El cliente debe poder hacer el cálculo mental en menos de 3 segundos.',
    toneRef: '"$500 hoy vs $8,000 en pintura nueva en 3 años."',
    rule:    'el copy_text DEBE incluir al menos un número, porcentaje o comparación de costos concreta.',
  },
  {
    id:          'curiosity',
    name:        'CURIOSIDAD',
    description: 'lo que nadie te ha contado',
    instruction:
      'Enfócate EXCLUSIVAMENTE en revelar algo que el cliente NO SABE.\n' +
      'Una verdad oculta, un dato sorprendente, un secreto del sector.\n' +
      'Haz que el lector sienta que está a punto de descubrir algo que cambiará su perspectiva.',
    toneRef: '"Lo que tu mecánico nunca te va a contar sobre el desgaste."',
    rule:    'el copy_text DEBE empezar con una pregunta, dato inesperado o revelación que genere intriga inmediata.',
  },
  {
    id:          'urgency',
    name:        'URGENCIA / ESCASEZ',
    description: 'limitado, actúa ahora',
    instruction:
      'Enfócate EXCLUSIVAMENTE en el TIEMPO o la DISPONIBILIDAD limitada.\n' +
      'Demanda alta, ventana de oportunidad que cierra, razón real para actuar hoy.\n' +
      'No uses escasez falsa — ancla la urgencia en algo creíble y concreto.',
    toneRef: '"Solo quedan 3 citas disponibles esta semana."',
    rule:    'el copy_text DEBE incluir un elemento temporal o de escasez que sea creíble y concreto.',
  },
  {
    id:          'social_proof',
    name:        'PRUEBA SOCIAL',
    description: 'lo que otros ya están haciendo',
    instruction:
      'Enfócate EXCLUSIVAMENTE en el COMPORTAMIENTO DEL GRUPO.\n' +
      'Clientes reales, resultados reales, comunidad que ya tomó la decisión.\n' +
      'Haz que el prospecto sienta que es el único que todavía no lo ha hecho.',
    toneRef: '"Más de 300 autos en Miami ya tienen esta protección."',
    rule:    'el copy_text DEBE hacer referencia a personas reales, números de clientes o resultados de la comunidad.',
  },
  {
    id:          'authority',
    name:        'AUTORIDAD / EXPERTO',
    description: 'la opinión del experto',
    instruction:
      'Enfócate EXCLUSIVAMENTE en el CONOCIMIENTO y las CREDENCIALES.\n' +
      'Certificaciones, años de experiencia, casos resueltos, respaldo técnico.\n' +
      'Haz que el cliente sienta que está en manos del mejor profesional disponible.',
    toneRef: '"Certificado internacionalmente. Aplicado en más de 500 vehículos."',
    rule:    'el copy_text DEBE mencionar una credencial, certificación, experiencia o dato técnico que establezca autoridad.',
  },
  {
    id:          'novelty',
    name:        'NOVEDAD',
    description: 'algo que no existía antes',
    instruction:
      'Enfócate EXCLUSIVAMENTE en lo NUEVO y lo DIFERENTE.\n' +
      'Una tecnología, método o resultado que antes no era posible.\n' +
      'Haz que el cliente sienta que está accediendo a algo de vanguardia antes que nadie.',
    toneRef: '"La primera protección nanotecnológica disponible en esta ciudad."',
    rule:    'el copy_text DEBE posicionar el producto como innovación o acceso a algo que no existía antes.',
  },
  {
    id:          'transformation',
    name:        'TRANSFORMACIÓN',
    description: 'cómo cambia tu vida o negocio',
    instruction:
      'Enfócate EXCLUSIVAMENTE en el ANTES y el DESPUÉS.\n' +
      'El contraste entre cómo es la vida del cliente ahora vs cómo será después.\n' +
      'Haz que el cliente se vea a sí mismo en el resultado, no en el proceso.',
    toneRef: '"De preocuparte por cada rayón, a no volver a pensar en eso."',
    rule:    'el copy_text DEBE contrastar explícitamente el estado actual del cliente con su estado después de usar el producto.',
  },
];

const SEARCH_TEMPLATES: SearchTemplate[] = [
  {
    id:         'trends',
    name:       'Tendencias del sector + año actual',
    buildQuery: (niche) => `${niche} social media advertising 2026 trends`,
  },
  {
    id:         'pain_points',
    name:       'Pain points del cliente objetivo',
    buildQuery: (niche) => `${niche} customer pain points problems`,
  },
  {
    id:         'success_cases',
    name:       'Casos de éxito y testimonios del sector',
    buildQuery: (niche) => `best ${niche} ads instagram tiktok success stories testimonials`,
  },
  {
    id:         'competitors',
    name:       'Competidores y qué están comunicando',
    buildQuery: (niche) => `${niche} competitor advertising messaging what they communicate`,
  },
  {
    id:         'faq',
    name:       'Preguntas frecuentes del sector',
    buildQuery: (niche) => `${niche} frequently asked questions customer concerns objections`,
  },
  {
    id:         'seasonal',
    name:       'Temporada actual y eventos relevantes del mes',
    buildQuery: (niche) => `${niche} seasonal promotions current events 2026`,
  },
];

export function shuffleArray<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function getRandomUniqueItems<T>(items: readonly T[], count: number): T[] {
  return shuffleArray(items).slice(0, Math.min(count, items.length));
}

export function pickAngles(count = 3, previousIds?: string[]): CopyAngle[] {
  const picked = getRandomUniqueItems(COPY_ANGLES, count);
  if (previousIds && previousIds.length === count) {
    const current = picked.map(a => a.id).sort().join(',');
    const prev    = [...previousIds].sort().join(',');
    if (current === prev) {
      return getRandomUniqueItems(COPY_ANGLES, count);
    }
  }
  return picked;
}

export function pickSearchTemplates(
  niche: string,
  count = 3,
): Array<{ name: string; query: string }> {
  return getRandomUniqueItems(SEARCH_TEMPLATES, count).map(t => ({
    name:  t.name,
    query: t.buildQuery(niche.slice(0, 80)),
  }));
}
