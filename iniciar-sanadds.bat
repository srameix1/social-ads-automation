@echo off
title SanAds - Iniciando entorno de desarrollo
color 0A

echo.
echo  ================================================
echo   SanAds - Iniciando entorno de desarrollo
echo  ================================================
echo.

:: ── 1. Verificar si Docker Desktop esta corriendo ──────────────────────────
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I "Docker Desktop.exe" >NUL
if %ERRORLEVEL% NEQ 0 (
    echo  [1/3] Iniciando Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo        Esperando que Docker arranque ^(30 seg^)...
    timeout /t 30 /nobreak >NUL
) else (
    echo  [1/3] Docker Desktop ya esta corriendo.
)

:: ── Esperar hasta que el daemon de Docker responda ─────────────────────────
echo        Verificando daemon de Docker...
:wait_docker
docker info >NUL 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo        Docker aun no responde, esperando 5 seg...
    timeout /t 5 /nobreak >NUL
    goto wait_docker
)
echo        Docker listo.
echo.

:: ── 2. Levantar contenedores con docker-compose ────────────────────────────
echo  [2/3] Levantando contenedores ^(docker-compose up -d^)...
cd /d "C:\Users\Santiago Rameix\Desktop\LOCAL SECTION claude\social_ads_automation\social-ads-automation"
docker-compose up -d
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] docker-compose fallo. Revisa la consola.
    pause
    exit /b 1
)
echo        Contenedores listos.
echo.

:: ── 3. Abrir VS Code con el proyecto ──────────────────────────────────────
echo  [3/3] Abriendo VS Code...
code "C:\Users\Santiago Rameix\Desktop\LOCAL SECTION claude\social_ads_automation\social-ads-automation"
echo.
echo  ================================================
echo   VS Code abierto. Los servidores se iniciaran
echo   automaticamente en terminales integradas.
echo   ^(Acepta el permiso la primera vez que VS Code
echo    pregunte por "Allow automatic tasks"^)
echo  ================================================
echo.
timeout /t 3 /nobreak >NUL
