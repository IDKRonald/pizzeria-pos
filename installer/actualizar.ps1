# installer/actualizar.ps1
# Corrido por la Tarea Programada "DonPenolinniPOS-Actualizar" (cada 6h y al
# encender la PC). Revisa si hay una version mas nueva publicada en GitHub
# Releases y, si la hay, la aplica SOLO dentro de una ventana horaria segura
# (por defecto 4:00-5:00 a.m., cuando el local esta cerrado) para no
# interrumpir una venta en curso. Nunca toca los datos en %ProgramData%
# (la base de datos y las imagenes subidas viven ahi, fuera de la carpeta
# de instalacion). Si algo falla a mitad de camino, revierte solo a la
# version anterior.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceName = 'DonPenolinniPOS'
$Repo = 'IDKRonald/pizzeria-pos'
$VentanaInicio = 4   # hora (24h) desde la que se permite aplicar una actualizacion
$VentanaFin = 5
$LogFile = Join-Path $AppDir 'actualizador.log'
$PendienteFile = Join-Path $AppDir 'actualizacion-pendiente.txt'

function Log($msg) {
    $linea = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogFile -Value $linea
    # Evitar que el log crezca sin limite
    if ((Get-Item $LogFile -ErrorAction SilentlyContinue).Length -gt 2MB) {
        $tail = Get-Content $LogFile -Tail 500
        Set-Content -Path $LogFile -Value $tail
    }
}

try {
    $verInstalada = (Invoke-RestMethod -Uri 'http://localhost:3001/api/version' -TimeoutSec 5).version
} catch {
    Log "No se pudo consultar la version instalada (el backend no responde): $($_.Exception.Message)"
    exit 0
}

try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" `
        -Headers @{ 'User-Agent' = 'DonPenolinniPOS-Updater' } -TimeoutSec 15
} catch {
    Log "No se pudo consultar GitHub (sin internet?): $($_.Exception.Message)"
    exit 0
}

$verRemota = $release.tag_name.TrimStart('v')
if ($verRemota -eq $verInstalada) {
    if (Test-Path $PendienteFile) { Remove-Item $PendienteFile -Force }
    exit 0
}

Log "Nueva version disponible: v$verRemota (instalada: v$verInstalada)"

$horaActual = (Get-Date).Hour
$enVentana = $horaActual -ge $VentanaInicio -and $horaActual -lt $VentanaFin
if (-not $enVentana) {
    Log "Fuera de la ventana horaria segura ($VentanaInicio-$VentanaFin h) - queda pendiente para la proxima revision."
    Set-Content -Path $PendienteFile -Value "v$verRemota"
    exit 0
}

$asset = $release.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1
if (-not $asset) {
    Log "El release v$verRemota no tiene un .zip adjunto - no se puede aplicar."
    exit 1
}

$tmp = Join-Path $env:TEMP "donpenolinni-update-$verRemota"
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tmp | Out-Null
$zipPath = Join-Path $tmp 'release.zip'

Log "Descargando $($asset.browser_download_url)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath
Expand-Archive -Path $zipPath -DestinationPath $tmp -Force

if (-not (Test-Path (Join-Path $tmp 'backend')) -or -not (Test-Path (Join-Path $tmp 'dist'))) {
    Log "El paquete descargado no tiene la estructura esperada (backend/ + dist/) - abortando sin tocar nada."
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

$backendCur = Join-Path $AppDir 'backend'
$distCur = Join-Path $AppDir 'dist'
$backendOld = Join-Path $AppDir 'backend.old'
$distOld = Join-Path $AppDir 'dist.old'
Remove-Item $backendOld, $distOld -Recurse -Force -ErrorAction SilentlyContinue

Log "Deteniendo el servicio..."
Stop-Service -Name $ServiceName -ErrorAction Stop
Start-Sleep -Seconds 2

$exitoso = $false
try {
    Log "Guardando la version actual por si hay que revertir..."
    Rename-Item $backendCur $backendOld
    Rename-Item $distCur $distOld

    Log "Instalando la nueva version..."
    Move-Item (Join-Path $tmp 'backend') $backendCur
    Move-Item (Join-Path $tmp 'dist') $distCur

    Log "Reiniciando el servicio..."
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 5

    $verNueva = (Invoke-RestMethod -Uri 'http://localhost:3001/api/version' -TimeoutSec 15).version
    if ($verNueva -ne $verRemota) {
        throw "El backend respondio pero con una version inesperada: v$verNueva"
    }
    Log "Actualizacion exitosa. Version activa: v$verNueva"
    $exitoso = $true
} catch {
    Log "ERROR aplicando la actualizacion: $($_.Exception.Message) - revirtiendo a la version anterior."
    Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
    Remove-Item $backendCur -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $distCur -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $backendOld) { Rename-Item $backendOld $backendCur -ErrorAction SilentlyContinue }
    if (Test-Path $distOld) { Rename-Item $distOld $distCur -ErrorAction SilentlyContinue }
    Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
    Log "Reversion completada."
}

if ($exitoso) {
    Remove-Item $backendOld, $distOld -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $PendienteFile) { Remove-Item $PendienteFile -Force }
}
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
