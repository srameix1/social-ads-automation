# 🍎 Guía de Instalación — Mac

## Tiempo estimado: 15-20 minutos

---

## PASO 1: Instalar Node.js
Abre Terminal (Cmd + Espacio → escribe "Terminal" → Enter).

Pega esto y presiona Enter:
curl -fsSL https://fnm.vercel.app/install | bash && source ~/.zshrc && fnm install --lts

Verifica que funcionó:
node --version
Debe mostrar algo como `v22.x.x`. Si dice "command not found", cierra Terminal, ábrela de nuevo, e intenta otra vez.

---

## PASO 2: Instalar Claude Code
Pega esto:
curl -fsSL https://claude.ai/install.sh | bash

Verifica:
claude --version
Debe mostrar algo como `v2.1.97` o superior.

---

## PASO 3: Configurar permisos de Claude Code
Esto se hace UNA SOLA VEZ. Copia el archivo `settings.json` que viene en este kit:
mkdir -p ~/.claude
cp ~/Orangutan/orangutan-kit/settings.json ~/.claude/settings.json

---

## PASO 4: Crear tu carpeta Orangutan
mkdir -p ~/Orangutan
cp -r ~/Orangutan/orangutan-kit ~/Orangutan/template-agente-ia

Si descargaste el kit desde Google Drive, primero muévelo:
mkdir -p ~/Orangutan
cp -r ~/Downloads/orangutan-kit ~/Orangutan/orangutan-kit
cp -r ~/Orangutan/orangutan-kit ~/Orangutan/template-agente-ia

---

## PASO 5: Activar Remote Control (opcional pero recomendado)
Abre Claude Code en cualquier proyecto:
cd ~/Orangutan/template-agente-ia && claude

Ya adentro escribe:
/config

Busca "Remote Control" y actívalo. Esto te permite monitorear desde tu celular o navegador.

Sal con:
/exit

---

## PASO 6: Tu primer proyecto
cp -r ~/Orangutan/template-agente-ia ~/Orangutan/mi-primer-proyecto

Edita los archivos de configuración:
1. Abre `.mcp.json` y reemplaza `REEMPLAZA_CON_URL_N8N_CLIENTE/api/v1` con la URL real de tu n8n
2. Reemplaza `REEMPLAZA_CON_API_KEY_CLIENTE` con tu API key de n8n
3. Abre `CLAUDE.local.md` y llena los datos de tu cliente

Para obtener tu API key de n8n:
- Ve a tu n8n → Settings → API → Create API Key

Entra a Claude Code:
cd ~/Orangutan/mi-primer-proyecto && claude

Dile:
/nuevo-agente Agente de ventas para [nombre del negocio], atención por WhatsApp

¡Claude Code te guiará paso a paso desde ahí!

---

## PROBLEMAS COMUNES

**"npx: command not found"**
→ Node.js no se instaló bien. Cierra Terminal, ábrela de nuevo, y repite Paso 1.

**"claude: command not found"**
→ Cierra Terminal, ábrela de nuevo. Si no funciona, repite Paso 2.

**Claude Code pide permiso para todo**
→ No copiaste el settings.json. Repite Paso 3.

**Los MCPs no conectan**
→ Verifica que la URL en .mcp.json termine en `/api/v1` (no en /home/workflows ni /settings).

---

## LISTO 🦧
Ya tienes todo. Para cada nuevo cliente, repite el Paso 6.
