---
description: Checklist de mantenimiento y actualización del template y sus dependencias
---

## Checklist de mantenimiento del template Orangutan

Ejecuta estas verificaciones:

1. **Claude Code**: Verifica versión con `claude --version`. Si hay nueva versión, el instalador nativo se auto-actualiza. Si falla, correr `curl -fsSL https://claude.ai/install.sh | bash`.

2. **n8n-mcp**: Se auto-actualiza con npx. Verifica que .mcp.json use `npx n8n-mcp` (no versión fija).

3. **n8n-skills técnicas**: Las 7 skills de czlonkowski están copiadas manualmente en .claude/skills/. Para verificar actualizaciones: visita https://github.com/czlonkowski/n8n-skills y compara fecha de último commit.

4. **Claude Code changelog**: Revisa si hay nuevas features de hooks, skills, agents, o MCP que apliquen. Changelog: https://github.com/anthropics/claude-code/releases

5. **n8n platform**: Cuando n8n lanza nueva versión, verifica compatibilidad con n8n-mcp.

6. **Skills propias** (biblia-agentes, cerebros de ejemplo): Solo cambian cuando mejoras tu metodología. No requieren actualización externa.

7. **Permisos**: Verifica que ~/.claude/settings.json tiene los permisos correctos y que no pide permiso innecesariamente.

Resume: qué encontraste desactualizado y qué acciones recomiendas.
