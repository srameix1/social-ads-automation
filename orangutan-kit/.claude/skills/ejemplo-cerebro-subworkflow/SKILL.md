---
name: ejemplo-cerebro-subworkflow
description: Cerebro de ejemplo de agente con sub-workflows (Mauri). Referencia para construir agentes que usan Execute Workflow como tool, patrón toolWorkflow con $fromAI(), preprocesamiento multimodal Telegram, y respuestas dinámicas con creación automática de Google Sheets. Use when user says sub-workflow, Execute Workflow, toolWorkflow, fromAI, how Mauri works, or needs reference for agent calling another workflow as tool.
---
# Skill: Cerebro de Ejemplo — Agente con Sub-Workflows (Mauri)

## Cuándo usar
- Como REFERENCIA cuando construyas agentes que necesiten ejecutar lógica compleja como tool
- Para entender el patrón `toolWorkflow` (Execute Another Workflow como herramienta del agente)
- Para ver cómo un agente puede lanzar otro flujo completo, esperar su resultado, y usar esa info para responder
- Cuando la lógica de una tool es demasiado compleja para un Google Doc o un Code node inline

## Qué contiene
- `cerebro-mauri.json` — Workflow principal del agente
- `subworkflow-buscar-contratos.json` — Sub-workflow que el agente ejecuta como tool

## Arquitectura

### Workflow Principal (Mauri)
- **Trigger**: Telegram Bot (soporta texto, voz, imagen, PDF)
- **Preprocesamiento**: Switch que detecta tipo de mensaje y normaliza todo a texto
  - Voz → Whisper transcripción → texto
  - Imagen → GPT-4o análisis → texto
  - PDF → Extract text → texto
  - Texto → directo
- **Wait node**: Anti-flood (espera antes de procesar)
- **Agente**: agent v3 con system prompt minimalista
- **Memoria**: PostgreSQL, context window 12
- **Respuesta**: Telegram con parse_mode HTML

### Sub-Workflow (BuscarContratosSOLOFS)
- **Trigger**: `executeWorkflowTrigger` v1.1 (recibe parámetros del agente)
- **Parámetros de entrada**: query, dia_inicio, dia_fin, ver_vencimientos, ver_bancarios
- **Flujo**: Google Sheets → Code (lógica pesada ~200 líneas) → If (crear sheet?) → respuesta
- **Respuesta dinámica**: Si >15 resultados, crea Google Sheet con link

### Patrón clave: toolWorkflow

El nodo toolWorkflow (tipo: @n8n/n8n-nodes-langchain.toolWorkflow, typeVersion: 2.2):
1. DESCRIPTION: Le dice al agente CUÁNDO y CÓMO usar la herramienta
2. WORKFLOW ID: Apunta al sub-workflow que se ejecutará
3. INPUTS con $fromAI(): El agente decide qué parámetros enviar
4. ESPERA: El agente se pausa hasta que el sub-workflow termina
5. RESPUESTA: El último nodo del sub-workflow devuelve datos al agente

### Cómo el agente llama al sub-workflow (JSON de referencia)
```json
{
  "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
  "typeVersion": 2.2,
  "parameters": {
    "description": "Descripción detallada para que la IA sepa cuándo usarla",
    "workflowId": { "value": "ID_DEL_SUBWORKFLOW", "mode": "id" },
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "param1": "={{ $fromAI('param1', 'Descripción para IA', 'string') ?? '' }}",
        "param2": "={{ $fromAI('param2', 'Descripción para IA', 'string') ?? '' }}"
      }
    }
  }
}
```

## Tools (1 — toolWorkflow)
- `buscar_contratos` — Ejecuta sub-workflow que lee Google Sheets, filtra contratos, formatea respuesta

## Patrones clave para reutilizar
1. **toolWorkflow como herramienta**: Lógica compleja en workflow separado, mantenible y testeable
2. **$fromAI() para parámetros**: La IA decide qué llenar, con ?? '' para vacíos
3. **Prompt minimalista**: "SIEMPRE usa herramienta, NUNCA inventes, envía respuesta TAL CUAL"
4. **Preprocesamiento multimodal**: Switch detecta voz/texto/imagen/PDF → normaliza a texto
5. **Respuestas dinámicas**: Pocos resultados → texto, muchos → crea Google Sheet con link
6. **Wait anti-flood**: Previene ejecuciones múltiples por mensajes rápidos

## Diferencias vs ventas y servicio
| Aspecto | Dani (ventas) | Alaric (servicio) | Mauri (sub-workflow) |
|---------|--------------|-------------------|---------------------|
| Tools | 12 Google Docs | 4 Google Docs | 1 toolWorkflow |
| Sub-agentes | 2 | 0 | 0 (usa sub-workflow) |
| Datos | Estáticos (docs) | Semi-estáticos | Dinámicos (Sheets live) |
| Respuesta | Agente formatea | Agente formatea | Sub-workflow formatea |
| Prompt | 15 secciones | 8 secciones | Minimalista (~15 líneas) |

## Cuándo elegir este patrón
- ✅ Datos en Google Sheets o DB externa
- ✅ Lógica de negocio compleja (filtros, cálculos, agregaciones)
- ✅ Respuesta pre-formateada (no quieres que la IA reinterprete)
- ✅ Necesitas crear archivos dinámicamente
- ❌ NO usar si la respuesta es simple texto de un Google Doc

## Archivos
- `cerebro-mauri.json` — Workflow principal
- `subworkflow-buscar-contratos.json` — Sub-workflow ejecutado como tool
