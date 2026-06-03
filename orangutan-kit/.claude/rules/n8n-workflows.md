# Reglas Técnicas n8n

## Antes de Crear Workflows
- Consulta Context7 para documentación actualizada del nodo
- Verifica credenciales en CLAUDE.local.md
- Si es integración nueva, INVESTIGA primero la API en web

## Credenciales
- Lista con `n8n_list_credentials` antes de construir
- Referencia por nombre e ID exacto del CLAUDE.local.md
- Si falta una credencial, pídela al usuario — no la inventes

## Construcción
- Usa `n8n_create_workflow` para crear, NUNCA importar JSON directo
- Usa `n8n_update_partial_workflow` para editar nodos existentes
- SIEMPRE incluye Error Workflow
- NUNCA hardcodees credenciales — usa el sistema de n8n

## WhatsApp
- Webhook data está en $json.body, NO directamente en $json
- Siempre valida phone number antes de responder
- Implementa rate limiting para evitar bloqueos

## Testing
- Prueba cada nodo con Execute Step antes de avanzar
- Prueba agente completo con Chat Trigger antes de conectar WhatsApp
- Verifica que usa tools cuando debe y que escalación funciona
