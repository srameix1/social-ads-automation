# 🪟 Guía de Instalación — Windows

## Tiempo estimado: 20-30 minutos

---

## PASO 1: Instalar Git for Windows (OBLIGATORIO)
Ve a https://git-scm.com/download/win y descarga el instalador.
Ejecútalo con todas las opciones por defecto.
IMPORTANTE: Asegúrate que "Add Git to PATH" esté marcado (viene marcado por defecto).

---

## PASO 2: Instalar Node.js (necesario para los MCPs)
Ve a https://nodejs.org y descarga la versión LTS (botón verde grande).
Ejecuta el instalador, dale "Next" a todo.

Abre PowerShell (clic derecho en botón Inicio → "Terminal" o "Windows PowerShell").

Verifica ambos:
git --version
node --version
Ambos deben mostrar versiones. Si alguno dice "not recognized", cierra PowerShell y ábrela de nuevo.

---

## PASO 3: Instalar Claude Code (instalador nativo)
En PowerShell, pega:
irm https://claude.ai/install.ps1 | iex

CIERRA PowerShell y ÁBRELA DE NUEVO (esto es importante para que el PATH se actualice).

Verifica:
claude --version
Debe mostrar algo como `v2.1.97` o superior.

Si dice "not recognized": ve a Configuración → Sistema → Información → Variables de entorno → PATH → agrega `%USERPROFILE%\.local\bin`

---

## PASO 4: Configurar permisos de Claude Code
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE.claude"
Copy-Item "$env:USERPROFILE\Downloads\orangutan-kit\settings.json" "$env:USERPROFILE.claude\settings.json"

---

## PASO 5: Crear tu carpeta Orangutan
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\Orangutan"
Copy-Item -Recurse "$env:USERPROFILE\Downloads\orangutan-kit" "$env:USERPROFILE\Orangutan\orangutan-kit"
Copy-Item -Recurse "$env:USERPROFILE\Orangutan\orangutan-kit" "$env:USERPROFILE\Orangutan\template-agente-ia"

---

## PASO 6: Activar Remote Control (opcional pero recomendado)
cd "$env:USERPROFILE\Orangutan\template-agente-ia"
claude

Ya adentro escribe:
/config

Busca "Remote Control" y actívalo.

Sal con:
/exit

---

## PASO 7: Tu primer proyecto
Copy-Item -Recurse "$env:USERPROFILE\Orangutan\template-agente-ia" "$env:USERPROFILE\Orangutan\mi-primer-proyecto"

Edita los archivos de configuración:
1. Abre `.mcp.json` con Notepad o VS Code y reemplaza la URL y API key de n8n
2. Abre `CLAUDE.local.md` y llena los datos de tu cliente

Para obtener tu API key de n8n:
- Ve a tu n8n → Settings → API → Create API Key

Entra a Claude Code:
cd "$env:USERPROFILE\Orangutan\mi-primer-proyecto"
claude

Dile:
/nuevo-agente Agente de ventas para [nombre del negocio], atención por WhatsApp

---

## PROBLEMAS COMUNES

**"irm: command not found"**
→ Estás en CMD, no en PowerShell. Abre PowerShell desde el menú Inicio.

**"claude is not recognized"**
→ Cierra PowerShell y ábrela de nuevo. Si no funciona, agrega `%USERPROFILE%\.local\bin` al PATH.

**"git: command not found"**
→ Git no se instaló bien o no se agregó al PATH. Reinstala Git for Windows.

**Claude Code pide permiso para todo**
→ No copiaste el settings.json. Repite Paso 4.

**Los MCPs no conectan**
→ Verifica que la URL en .mcp.json termine en `/api/v1`.

**Playwright no funciona**
→ Ejecuta: `npx playwright install chromium`

---

## LISTO 🦧
Ya tienes todo. Para cada nuevo cliente, repite el Paso 7.
