# Template: Agente de IA — Metodología Orangutan

## Setup Rápido (5 minutos)

### 1. Copiar template al proyecto del cliente
```bash
cp -r ~/Orangutan/template-agente-ia ~/Orangutan/[nombre-cliente]
cd ~/Orangutan/[nombre-cliente]
```

### 2. Configurar .mcp.json
Edita `.mcp.json` y reemplaza:
- `REEMPLAZA_CON_URL_N8N_CLIENTE` → URL del n8n del cliente
- `REEMPLAZA_CON_API_KEY_CLIENTE` → API key del n8n del cliente

### 3. Configurar CLAUDE.local.md
Edita `CLAUDE.local.md` con las credenciales específicas del cliente.
Tip: abre Claude Code y pídele que liste las credenciales del n8n del cliente.

### 4. Pegar la Biblia (solo la primera vez)
Copia el contenido de la Biblia completa en:
`.claude/skills/biblia-agentes/biblia.md`

### 5. Abrir en Antigravity/Claude Code
```bash
cd ~/Orangutan/[nombre-cliente]
claude
```
O abre la carpeta en Antigravity.

### 6. Iniciar proyecto
Dile a Claude Code:
"Vamos a crear un agente de IA para [NOMBRE_NEGOCIO]. Lee la Biblia y los cerebros de ejemplo, y empecemos con el discovery."

## Estructura
```
template-agente-ia/
├── .claude/
│   ├── settings.json         ← Permisos (auto-approve MCPs, sin pedir permiso)
│   ├── rules/
│   │   ├── metodologia-orangutan.md  ← Proceso de 3 fases
│   │   ├── construccion-n8n.md       ← Reglas nodo por nodo
│   │   ├── n8n-workflows.md          ← Reglas técnicas n8n
│   │   └── seguridad.md             ← Seguridad y credenciales
│   └── skills/
│       ├── biblia-agentes/           ← Biblia completa (70 pags)
│       ├── ejemplo-cerebro-ventas/   ← Dani v2 (JSON + análisis)
│       └── ejemplo-cerebro-servicio/ ← Alaric v3 (JSON + análisis)
├── .mcp.json                 ← MCPs (n8n, playwright, context7)
├── CLAUDE.md                 ← Config del proyecto (lean)
├── CLAUDE.local.md           ← Credenciales del cliente (NO commitear)
├── progreso.md               ← Tracking de avance
├── docs/                     ← Documentos del cliente
├── google-docs/              ← Contenido de knowledge base
└── .gitignore                ← Protege archivos sensibles
```

## Modo Autónomo (Trabajar toda la noche)
1. Completa el discovery juntos
2. Aprueba la arquitectura
3. Dile: "Construye todo el cerebro siguiendo la arquitectura. Documenta en progreso.md"
4. Claude Code construirá nodo por nodo, validará, y documentará avance
5. Revisa progreso.md al día siguiente

## Notas
- settings.json auto-aprueba MCPs y operaciones de archivo
- Las credenciales del cliente NUNCA se commitean (CLAUDE.local.md en .gitignore)
- La Biblia y los cerebros de ejemplo son read-only — Claude los lee, no los modifica
- progreso.md se actualiza automáticamente durante construcción
