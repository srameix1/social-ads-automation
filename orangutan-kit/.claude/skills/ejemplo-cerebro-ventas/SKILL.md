---
name: ejemplo-cerebro-ventas
description: Cerebro de ejemplo de agente de ventas (Dani v3) con alto rendimiento en producción. Referencia para construir agentes de ventas, copiar patrones de tool descriptions, flujo de conversación en 5 fases, humanización, y system prompts por secciones temáticas. Use when user says agente de ventas, ejemplo de ventas, cerebro de ventas, how Dani works, or needs reference for sales agent architecture.
---
# Skill: Cerebro de Ejemplo — Agente de Ventas (Dani v3)

## Cuándo usar
- Como REFERENCIA cuando construyas agentes de ventas
- Para entender la estructura real de un agente de alto rendimiento en producción
- Para copiar patrones de tool descriptions, flujo de conversación, y humanización

## Qué contiene
`cerebro-dani-v3.json` — JSON completo del agente de ventas funcionando en producción.

### Arquitectura
- **Orquestador**: Agente con system prompt de 14 secciones (A-N)
- **Modelo**: Claude Sonnet 4.6, temperature 0.4, max_tokens 800
- **Memoria**: PostgreSQL, context window 8

### Tools (6 total)
- `get_course_data` — Datos dinámicos actualizados (Google Doc maestro) — FUENTE DE VERDAD
- `get_detailed_info` — Info estática en profundidad (temario, training, comparativa)
- `get_success_stories` — Casos de éxito reales con números
- `handle_objection` — Scripts de objeciones con técnicas Voss/Kahneman/Belfort/Cialdini
- `escalate_to_human` — Notifica equipo vía Telegram (NUNCA prometer contacto)
- `report_knowledge_gap` — Reporta info faltante al equipo

### Post-procesamiento (Frankenstein)
Flujo: Agente → Evaluación (Code) → ¿Necesita división? → Sí: Frankenstein (partidor) → Procesamiento final → Parteado
El Frankenstein NO reescribe — solo PARTE mensajes largos en múltiples mensajes cortos para WhatsApp.

### Las 14 secciones del System Prompt
A. Identidad (quién eres + quién NO eres + manejo de "eres bot?")
B. Formato — Reglas anti-bot (cero markdown, máx 300 chars, sin listas)
C. Flujo de conversación — 5 fases con detector de señal de compra
D. Post-venta (cambio automático de modo)
E. Escalación humana (protocolo + NUNCA prometer contacto)
F. Consulta de datos (cuándo usar cada tool, prioridad)
G. Limitador de repetición (contadores de links, precio, social proof)
H. Tono y lenguaje (personalidad, humor, expresiones, palabras prohibidas)
I. Psicología de venta (Hormozi, Kahneman, Belfort)
J. Límites de Dani (qué NO hace)
K. Filosofía del curso
L. Sistema de upgrades (lógica condicional)
M. Filosofía de venta de planes (ambos planes son buenos)
N. Reglas finales (restricciones absolutas)

### Patrones clave para reutilizar
1. **Estructura flexible por secciones** — NO usa 12 bloques rígidos, organiza por temas
2. **Detector de señal de compra** — REGLA MAESTRA que interrumpe cualquier fase para cerrar
3. **Anti-repetición con contadores** — máx 2 links, 3 menciones de precio, 2 testimonios
4. **Tool como fuente de verdad** — "si el dato puede cambiar, consulta tool. NUNCA inventes"
5. **Escalación sin promesas** — NUNCA "te contactamos", siempre "escribe a email@"
6. **Humor natural** — reacciones genuinas, no humor forzado
7. **Palabras prohibidas explícitas** — lista clara de frases robóticas a evitar
8. **Post-venta automática** — detecta "ya compré" y cambia de modo
9. **Frankenstein como partidor** — no reescribe, solo parte mensajes

## Archivo
- `cerebro-dani-v3.json` — JSON completo del workflow
