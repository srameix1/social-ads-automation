GUÍA DE CONSTRUCCIÓN: AGENTES DE IA Y AUTOMATIZACIONES
Metodología Orangutan — Versión 4.0
Marzo 2026

---

PARTE 1: FILOSOFÍA

1.1 Qué Construimos

Orangutan construye dos tipos de soluciones en n8n:

AGENTES CONVERSACIONALES: Sistemas con personalidad, objetivo y capacidad de decisión. Se conectan a WhatsApp, Telegram u otros canales. Ejemplos: ventas, servicio al cliente, citas, cobranza.

AUTOMATIZACIONES: Workflows sin agente conversacional. Procesan datos, generan documentos, sincronizan sistemas. Ejemplos: reportes automáticos, procesamiento de formularios, integraciones API-a-API.

1.2 Agente Inteligente vs Chatbot

CHATBOT: Reactivo, respuestas predefinidas, sin objetivo, obviamente robótico. Conversión: 10-20%.
AGENTE INTELIGENTE: Proactivo, personalidad consistente, maneja objeciones, guía la conversación, escala inteligentemente, indistinguible de humano experto. Conversión: 50-60%.

1.3 Principios Core

Estos principios aplican a TODO lo que construimos:

1. OBJETIVO SOBRE TODO — Cada componente tiene un propósito claro. Sin excepciones.
2. ESPECIALIZACIÓN MODULAR — Cada pieza hace UNA cosa bien. Orquestador coordina, Tools dan info, Sub-agentes razonan.
3. INFORMACIÓN VERIFICABLE > CREATIVIDAD — Si no sabe, consulta tool. NUNCA inventa.
4. HUMANO PRIMERO — Indistinguible de humano experto en canal de comunicación.
5. RESPUESTA DIRECTA — Sin preámbulos, sin felicitaciones, sin relleno.
6. ESCALACIÓN INTELIGENTE — Saber cuándo necesita humano. No antes, no después.
7. LÍMITES CLAROS — Saber qué NO hace. Estructura: "Tu trabajo es X. Todo lo demás → canal Y."
8. OUTCOME > FEATURES — Nunca describas features solas. Siempre conecta con el RESULTADO para el usuario.
9. OPTIMIZACIÓN BASADA EN DATOS — Deploy → 20-30 conversaciones → Análisis → Fix quirúrgico → Re-deploy.

---

PARTE 2: ANATOMÍA DE UN AGENTE

2.1 Arquitectura de 3 Capas

CAPA 1 — ORQUESTADOR (el cerebro):
- Agente principal con system prompt
- Coordina tools y mantiene personalidad
- Configuración típica: temperature 0.2-0.4, max_tokens 800

CAPA 2 — TOOLS (los sentidos):
- Google Docs para knowledge base dinámica
- Telegram/Email para escalación
- Execute Workflow para lógica compleja (patrón Mauri)
- Cada tool con description detallada: qué hace, cuándo usarla, cuándo NO

CAPA 3 — SUB-AGENTES (razonamiento especializado):
- Solo cuando el orquestador no puede resolver solo
- Objeciones complejas, cálculos ROI, análisis
- Muchos agentes excelentes NO necesitan sub-agentes

2.2 El System Prompt — Estructura Flexible

NO hay bloques rígidos obligatorios. El system prompt se organiza por SECCIONES TEMÁTICAS según lo que el agente necesita. La referencia es Dani v3 (14 secciones) pero cada agente puede tener más o menos.

SECCIONES COMUNES (incluir según necesidad):

- IDENTIDAD: Quién eres, quién NO eres, cómo respondes si preguntan si eres IA
- FORMATO: Reglas anti-bot específicas del canal (WhatsApp vs Telegram vs Web)
- FLUJO: Fases de la conversación con triggers claros entre fases
- TOOLS: Cuándo consultar cada fuente de datos, prioridad entre tools
- TONO Y LENGUAJE: Personalidad, expresiones, palabras prohibidas, humanización
- PSICOLOGÍA: Frameworks aplicados (ver sección 2.4)
- LÍMITES: Qué NO hace, a dónde redirigir
- ESCALACIÓN: Protocolo exacto, qué decir y qué NO prometer
- REGLAS FINALES: Restricciones absolutas, contadores, anti-repetición

SECCIONES OPCIONALES (según tipo de agente):
- Post-venta (si vende)
- Sistema de upgrades (si tiene planes)
- Filosofía del producto/servicio (si necesita contexto profundo)
- Detección de intención por niveles (si el flujo lo requiere)

PRINCIPIO CLAVE: El prompt no necesita seguir un orden fijo. Lo que importa es que cubra todo lo que el agente necesita para hacer su trabajo, organizado de forma que el LLM pueda seguirlo claramente.

2.3 Tool Descriptions — Estructura

Cada tool necesita decirle al agente CUÁNDO usarla y CUÁNDO NO:

[Descripción 1-2 oraciones]

USA OBLIGATORIAMENTE cuando:
- [Trigger 1]
- [Trigger 2]

NUNCA uses para:
- [Anti-trigger 1]

[Instrucciones post-uso si aplica]

REGLA: Si un dato puede cambiar con el tiempo, SIEMPRE va en tool. NUNCA hardcodeado en el prompt.

2.4 Psicología Aplicada

5 frameworks probados para integrar en agentes:

VOSS (Tactical Empathy): Labeling ("parece que te preocupa..."), Mirroring (repetir últimas palabras), preguntas No-Oriented.
HORMOZI (Value Equation): Outcome > features. Resultado soñado, probabilidad de éxito, tiempo, esfuerzo.
CIALDINI (Influence): Social proof, escasez, autoridad, reciprocidad.
KAHNEMAN (Loss Aversion): Las pérdidas motivan 2x más. "Dejas de perder X" > "ganas X". Reference point antes del precio.
BELFORT (Straight Line): Cada mensaje mueve hacia el cierre. Si se desvían, redirigir.

NO metas los 5 en cada agente. Usa los que apliquen al objetivo del agente.

2.5 Humanización — Sistema Frankenstein

El Frankenstein es un nodo SEPARADO del agente que hace UNA cosa: partir mensajes largos en múltiples mensajes cortos para simular escritura humana en WhatsApp.

NO es un reescritor. NO cambia contenido. Solo PARTE.

Reglas del Frankenstein:
- Mensajes cortos (<150 chars): no partir
- Mensajes medios (150-300): 2 partes
- Mensajes largos (300+): 2-3 partes máximo
- Links siempre en su propia parte
- Quitar markdown residual (**negritas**, *cursivas*)
- Quitar punto final (los humanos no ponen punto final en WhatsApp)

---

PARTE 3: AUTOMATIZACIONES (sin agente)

3.1 Cuándo Usar Automatización vs Agente

USA AGENTE cuando: hay conversación, hay decisiones contextuales, hay personalidad, hay canal de chat.
USA AUTOMATIZACIÓN cuando: es procesamiento de datos, no hay conversación, es trigger→transformar→enviar.

3.2 Patrones Comunes de Automatización

FORMULARIO → PROCESAR → ENVIAR:
Ejemplo: Formulario médico → genera PDF con datos + fotos → envía por email.
Nodos típicos: n8n Form Trigger → Set → Code → HTTP Request → Gmail/SendGrid.

WEBHOOK → TRANSFORMAR → DB:
Ejemplo: Recibe datos de sistema externo → transforma formato → guarda en Supabase.
Nodos típicos: Webhook → Code → Supabase/PostgreSQL.

SCHEDULE → FETCH → NOTIFY:
Ejemplo: Cada lunes → consulta métricas → envía reporte por Telegram.
Nodos típicos: Schedule Trigger → HTTP Request → Code → Telegram.

MULTI-STEP CON SUBWORKFLOW:
Ejemplo: Proceso complejo con múltiples APIs → orquestado por workflow principal que llama sub-workflows.
Referencia: Patrón Mauri (cerebro ejemplo subworkflow).

---

PARTE 4: PROCESO DE CONSTRUCCIÓN

4.1 Discovery — 5 Bloques de Preguntas

Antes de construir CUALQUIER cosa, recopilar info en 5 bloques:

BLOQUE 1 — NEGOCIO: Nombre, qué vende/hace, objetivo del agente/automatización, métrica de éxito.
BLOQUE 2 — CLIENTES: Quién es el cliente ideal, cómo llegan, qué preguntan, qué les duele.
BLOQUE 3 — PRODUCTO/SERVICIO: Precios, planes, diferenciadores, proceso de compra/contratación.
BLOQUE 4 — OBJECIONES Y LÍMITES: Objeciones comunes, qué SÍ hace el agente, qué NO, a dónde escalar.
BLOQUE 5 — PERSONALIDAD E INFO OPERATIVA: Nombre del agente, tono, horarios, links, contactos.

Para automatizaciones sin agente, solo bloques 1 y 5 son obligatorios.

4.2 Arquitectura

Antes de construir, presentar resumen:
- PROYECTO: nombre y objetivo en una línea
- TIPO: agente conversacional o automatización
- ARQUITECTURA: diagrama de nodos y conexiones
- MEMORIA: tipo y configuración (si aplica)
- TOOLS/INTEGRACIONES: lista de fuentes de datos
- LÍMITES: qué no hace y a dónde redirige

4.3 Construcción

- Nodo por nodo, con verificación después de cada uno
- System prompts y tool descriptions SIEMPRE completos
- NUNCA dar JSON para importar — instrucciones paso a paso
- No avanzar al siguiente nodo sin resolver errores del actual

4.4 Revisión

Antes de entregar, pasar por:
1. prompt-critic (evalúa calidad del system prompt)
2. workflow-reviewer (audita estructura de nodos)
3. /verificar (compara contra arquitectura aprobada)
4. Gemini como segunda opinión (opcional)

---

PARTE 5: ERRORES COMUNES

- Meter TODO en el system prompt en vez de usar tools
- Inventar datos en vez de consultar tools
- Prompts gigantes sin estructura clara
- Tool descriptions vagas sin triggers específicos
- No tener protocolo de escalación
- Prometer tiempos de respuesta de humanos
- Repetir la misma frase/link múltiples veces
- Usar markdown en canales que no lo soportan (WhatsApp)
- No validar nodo por nodo antes de avanzar

---

REFERENCIA RÁPIDA

Cerebros de ejemplo disponibles:
- Dani v3 (ventas) — 14 secciones, Sonnet 4.6, 6 tools, Frankenstein como partidor
- Mauri (subworkflows) — patrón toolWorkflow, Execute Another Workflow, datos dinámicos

Configuraciones estándar:
- Agente principal: temperature 0.2-0.4, max_tokens 800
- Memoria PostgreSQL: sessionKey={{ $json.sessionid }}, contextWindowLength 8-12
- Frankenstein: temperature 0, output JSON, solo partir mensajes
