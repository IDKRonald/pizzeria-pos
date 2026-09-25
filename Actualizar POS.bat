@echo off
title Don Penolinni POS - Actualizador
color 0B

cd /d "%~dp0"

echo ====================================================
echo   PIZZERIA DON PENOLINNI - Actualizar el sistema
echo ====================================================
echo.
echo Este script descarga los ultimos cambios y reconstruye
echo la aplicacion. Usalo SOLO cuando te avisen que hay una
echo actualizacion, no es necesario correrlo a diario.
echo.
pause

echo [1/4] Descargando ultimos cambios (git pull)...
call git pull
if errorlevel 1 (
    echo.
    echo   ERROR: no se pudo descargar la actualizacion.
    echo   Revisa tu conexion a internet o si hay cambios locales sin guardar.
    pause
    exit /b 1
)

echo [2/4] Instalando dependencias del frontend...
call npm install

echo [3/4] Instalando dependencias del backend...
call npm install --prefix backend

echo [4/4] Generando el nuevo build de produccion...
call npm run build

echo.
echo ====================================================
echo   ACTUALIZACION COMPLETA
echo   Ya puedes abrir el sistema normalmente.
echo ====================================================
pause
