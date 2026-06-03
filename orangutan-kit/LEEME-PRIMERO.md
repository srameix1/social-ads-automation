# 🦧 Kit Orangutan — Construye Agentes de IA con Claude Code

## Qué es esto
Todo lo que necesitas para construir agentes conversacionales y automatizaciones en n8n usando Claude Code como tu builder de IA.

## Qué incluye
- **template-agente-ia/** → La estructura base de TODOS los proyectos Orangutan
- **GUIA-MAC.md** → Instalación paso a paso para Mac
- **GUIA-WINDOWS.md** → Instalación paso a paso para Windows
- **settings.json** → Permisos de Claude Code (se copia una sola vez)
- **REGISTRO.md** → Base de conocimiento con lecciones aprendidas

## Requisitos previos
- Una instancia de n8n funcionando (EasyPanel, Railway, o auto-hosted)
- Una cuenta de Claude (claude.ai) con plan Pro o superior
- Node.js instalado en tu computadora

## Cómo empezar
1. Abre la guía de tu sistema operativo (GUIA-MAC.md o GUIA-WINDOWS.md)
2. Sigue TODOS los pasos en orden
3. Al final tendrás Claude Code listo para construir tu primer agente

## Cómo se usa (una vez instalado)
Para cada nuevo cliente o proyecto:
1. Copia la carpeta template: `cp -r ~/Orangutan/template-agente-ia ~/Orangutan/nombre-cliente`
2. Edita `.mcp.json` con la URL y API key de su n8n
3. Edita `CLAUDE.local.md` con los datos del cliente
4. Abre terminal: `cd ~/Orangutan/nombre-cliente && claude`
5. Dile a Claude Code: `/nuevo-agente [descripción]` para agentes, o dale un handoff doc para automatizaciones

## Soporte
- Dudas: hola@orangutan.mx
- Web: orangutan.mx
