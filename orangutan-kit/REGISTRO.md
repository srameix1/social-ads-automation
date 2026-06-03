# REGISTRO ORANGUTAN — Base de Conocimiento Central

---

## LECCIONES APRENDIDAS

### n8n
- Trailing spaces en nodos Code rompen workflows silenciosamente
- Google Drive URLs no sirven para imágenes en Meta API — usar hosting externo
- Campo `branch` en n8n-mcp OBLIGATORIO para conexiones If/Switch
- DataTables: seleccionar por dropdown, nunca IDs manuales
- Nodo Code con "Run Once for All Items" cuando necesitas procesar items agrupados

### Claude Code
- Handoff doc + JSONs + prompt autónomo = Claude Code trabaja solo
- /compact en context limit, /clear + /status cada 20-30 interacciones
- progreso.md es la biblia entre sesiones — hooks lo mantienen
- n8n MCP URL: SIEMPRE /api/v1, NUNCA URLs de UI (/home/workflows)

### Metodología
- Un cambio → verificar → siguiente. Nunca múltiples cambios a la vez
- SIEMPRE cp template ANTES de configurar — nunca editar template directo
- Analizar qué archivos mandar a Claude Code — no todo es necesario, ahorra tokens
