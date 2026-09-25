# installer/prep-vendor.ps1
# Descarga (una sola vez) las herramientas de terceros que el instalador embebe:
# Node.js portátil (para no depender de que la PC del local tenga Node instalado)
# y NSSM (para registrar el backend como servicio de Windows). Ambas se guardan
# en installer/vendor/, que está excluido del repo (son binarios de terceros).

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest es mucho más rápido/confiable sin la barra de progreso
$root = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $PSScriptRoot 'vendor'
New-Item -ItemType Directory -Force -Path $vendor | Out-Null

$nodeVersion = 'v22.18.0'
$nodeDir = Join-Path $vendor 'node-win-x64'
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
    Write-Host "Descargando Node.js $nodeVersion (portátil, win-x64)..."
    $nodeZip = Join-Path $vendor 'node.zip'
    Invoke-WebRequest -Uri "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-win-x64.zip" -OutFile $nodeZip
    Expand-Archive -Path $nodeZip -DestinationPath $vendor -Force
    Remove-Item $nodeDir -Recurse -Force -ErrorAction SilentlyContinue
    Rename-Item (Join-Path $vendor "node-$nodeVersion-win-x64") 'node-win-x64'
    Remove-Item $nodeZip -Force
    Write-Host "  Node.js listo en $nodeDir"
} else {
    Write-Host "Node.js portátil ya está en $nodeDir — omitiendo descarga."
}

$nssmDir = Join-Path $vendor 'nssm'
if (-not (Test-Path (Join-Path $nssmDir 'nssm.exe'))) {
    Write-Host "Descargando NSSM..."
    $nssmZip = Join-Path $vendor 'nssm.zip'
    Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $nssmZip
    Expand-Archive -Path $nssmZip -DestinationPath $vendor -Force
    New-Item -ItemType Directory -Force -Path $nssmDir | Out-Null
    Copy-Item (Join-Path $vendor 'nssm-2.24\win64\nssm.exe') (Join-Path $nssmDir 'nssm.exe') -Force
    Remove-Item (Join-Path $vendor 'nssm-2.24') -Recurse -Force
    Remove-Item $nssmZip -Force
    Write-Host "  NSSM listo en $nssmDir"
} else {
    Write-Host "NSSM ya está en $nssmDir — omitiendo descarga."
}

Write-Host "`nVendor listo."
