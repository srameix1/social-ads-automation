# Reglas de Construcción en n8n

## Nomenclatura Obligatoria
- Nodos y workflows: texto_texto (minúsculas, sin acentos, sin espacios, sin emojis)
- Correcto: get_pricing_info, escalate_to_human
- Incorrecto: Get Pricing 📊, Escalación-Humano

## Formato de Instrucciones por Nodo
```
NODO: [nombre]
TIPO: [tipo exacto en n8n]
CONFIGURACIÓN:
  Campo: [valor]
[Prompt/description COMPLETO]
CONEXIÓN: [origen] → [nodo] → [destino]
✅ VERIFICACIÓN: Execute Step y dame resultado o error
```

## Reglas Absolutas
1. NUNCA dar JSON exportado para importar — instrucciones paso a paso
2. System prompts SIEMPRE completos, nunca parciales
3. Tool descriptions con triggers y anti-triggers (formato en biblia.md)
4. No avanzar al siguiente nodo sin resolver errores del actual
5. NO explicar por qué — solo instrucciones precisas de qué hacer

## Validación via n8n-mcp
- `n8n_list_workflows` para verificar workflows creados
- `n8n_get_workflow` para verificar estructura de nodos
- `n8n_execute_workflow` para testing
- NUNCA activar workflow sin validar primero
