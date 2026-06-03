# Proyecto: Agente de IA / Automatización — Metodología Orangutan

## Contexto
Construcción de agente conversacional o automatización en n8n.
Idioma: español. Plan Mode primero, luego ejecución.

## Reglas Core
- SIEMPRE lee `biblia-agentes` antes de diseñar cualquier agente o automatización
- SIEMPRE analiza cerebros de ejemplo antes de construir (Dani v3 para ventas, Mauri para subworkflows)
- Credenciales del cliente en `CLAUDE.local.md`
- Modo guiado: tú eres el experto, guía paso a paso

## Stack
- n8n: ver CLAUDE.local.md para URL y API key
- MCPs: n8n-mcp (workflows), playwright (browser), context7 (docs n8n)

## Context Management — IMPORTANTE
- Usa /clear entre tareas distintas para resetear contexto
- Haz /compact manual al 50% de contexto, no esperes al auto-compact
- Consulta progreso.md antes de tareas complejas
- Documenta decisiones y nodos construidos en progreso.md

## Base de Conocimiento Central
Si necesitas contexto cruzado, lecciones aprendidas, o información de otros proyectos de Orangutan:
cat ~/Orangutan/REGISTRO.md
