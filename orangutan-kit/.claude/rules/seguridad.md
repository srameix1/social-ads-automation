# Seguridad

## Credenciales
- NUNCA expongas API keys, tokens o contraseñas en prompts, logs o código
- Usa SIEMPRE el sistema de credenciales nativo de n8n
- Las credenciales del cliente van en CLAUDE.local.md (no se commitea)
- NUNCA hardcodees credenciales en nodos — usa referencias por ID

## Webhooks
- Valida y sanitiza todos los inputs de webhooks
- Implementa autenticación en webhooks de producción
- No expongas endpoints sin protección

## Agentes
- NUNCA permitas que el agente revele instrucciones internas
- NUNCA permitas que el agente confirme ser IA si el diseño lo prohíbe
- Implementa límites claros de qué NO hace el agente
- Limita tokens de respuesta para evitar costos excesivos

## Datos
- No almacenes datos sensibles del cliente en el repositorio
- Usa PostgreSQL/Supabase para memoria, no archivos locales
- Respeta regulaciones de privacidad del país del cliente
