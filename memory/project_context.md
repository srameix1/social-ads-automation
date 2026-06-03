---
name: social-ads-automation-context
description: Contexto completo del proyecto social-ads-automation — stack, estructura, estado de construcción
metadata:
  type: project
---

Plataforma de automatización de publicidad en redes sociales construida con Next.js + Node.js/Express + PostgreSQL.

**Why:** El cliente quiere ofrecer a sus clientes un portal donde soliciten campañas, Claude genera 3 estrategias, el cliente elige una, y el sistema publica automáticamente en Instagram/TikTok/Facebook.

**How to apply:** Al continuar este proyecto, el código ya existe. No reconstruir desde cero — siempre leer el archivo relevante antes de editar.

## Stack
- Frontend: Next.js 14 App Router + Tailwind CSS → `/frontend`
- Backend: Node.js + Express + TypeScript → `/backend`
- DB: PostgreSQL 15 (Docker) — migraciones en `/backend/database/migrations/`
- Cifrado: AES-256-GCM para credenciales de clientes
- IA: Claude API (claude-opus-4-7) para generar 3 estrategias publicitarias
- Media: NanaBanana (placeholder — falta API docs del cliente)

## Estado de construcción (completado 2026-05-22)
98 archivos creados. Sistema completo funcional.
- Backend: auth, clients, credentials, campaigns, strategies, publishing, admin
- Frontend: portal cliente + panel admin
- Tests: test/e2e-flow.js

## NanaBanana
Servicio de generación de imágenes/video. No hay API docs disponibles aún.
Placeholder en: backend/src/services/nanabanana.service.ts
Cuando el cliente provea docs, conectar en la función generateMedia().

## Credenciales por plataforma (guardadas cifradas)
- Instagram: access_token + instagram_account_id
- TikTok: access_token + open_id
- Facebook: page_access_token + page_id
