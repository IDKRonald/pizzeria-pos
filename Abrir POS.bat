@echo off
title Don Penolinni POS - Servidor
color 0A

cd /d "%~dp0"

echo ====================================================
echo   PIZZERIA DON PENOLINNI - Sistema de Punto de Venta
echo ====================================================
echo.

echo [1/5] Limpiando puertos por seguridad...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/5] Verificando dependencias...
if not exist "node_modules" (
    echo   Faltan dependencias del frontend, instalando... esto puede tardar un poco.
    call npm install
)
if not exist "backend\node_modules" (
    echo   Faltan dependencias del backend, instalando... esto puede tardar un poco.
    call npm install --prefix backend
)

echo [3/5] Iniciando el Backend (Express + SQLite)...
start "" /min cmd /c "cd backend && node server.js"

echo [4/5] Iniciando el Frontend (Vite)...
start "" /min cmd /c "npm run dev -- --host"

echo [5/5] Esperando a que el backend responda (hasta 40s)...
set intentos=0
:esperar_backend
curl -s -o nul -w "" http://localhost:3001/api/health
if %errorlevel%==0 goto backend_listo
set /a intentos+=1
if %intentos% GEQ 40 (
    echo.
    echo   AVISO: el backend no respondio a tiempo.
    echo   Revisa la ventana negra minimizada "Backend" por si muestra un error.
    echo   Si el problema persiste, cierra todo y vuelve a intentar.
    goto abrir_navegador
)
timeout /t 1 /nobreak >nul
goto esperar_backend

:backend_listo
echo   Backend listo.

:abrir_navegador
echo Abriendo la caja registradora...
start brave --app=http://localhost:5173

echo.
echo ====================================================
echo   SISTEMA EN LINEA Y LISTO
echo   Backend: http://localhost:3001/api
echo   Frontend: http://localhost:5173
echo   No cierres esta ventana negra.
echo   Presiona cualquier tecla AQUI para APAGAR TODO.
echo ====================================================
pause >nul

echo.
echo Apagando el sistema de forma segura...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do (
    taskkill /F /PID %%a >nul 2>&1
)
taskkill /F /IM "node.exe" >nul 2>&1
echo Servidor detenido. Buen trabajo hoy!
timeout /t 2 /nobreak >nul
