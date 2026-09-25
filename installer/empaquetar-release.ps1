# installer/empaquetar-release.ps1
# Genera una nueva version publicable: el instalador completo (Setup.exe,
# para una instalacion nueva) y el paquete de actualizacion (release.zip,
# para que el actualizador automatico lo descargue). Se corre SOLO en esta
# maquina de desarrollo, nunca en la del local.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File installer\empaquetar-release.ps1 -Version 1.1.0
#   powershell -ExecutionPolicy Bypass -File installer\empaquetar-release.ps1 -Version 1.1.0 -Publicar
param(
    [Parameter(Mandatory=$true)][string]$Version,
    [switch]$Publicar   # si se pasa, sube el release a GitHub con `gh` (requiere gh autenticado)
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$installerDir = Join-Path $root 'installer'
$releaseDir = Join-Path $installerDir 'release'
$outputDir = Join-Path $installerDir 'output'

Write-Host "== 1/6 Version -> $Version (package.json raiz y backend) =="
# Reemplazo puntual de la linea "version" por regex (no round-trip por
# ConvertTo-Json): evita reformatear todo el archivo y, sobre todo, evita que
# Set-Content/ConvertTo-Json agreguen BOM, que rompe a Vite/PostCSS al leer
# package.json como JSON plano.
$utf8SinBom = New-Object System.Text.UTF8Encoding($false)
foreach ($pkgPath in @((Join-Path $root 'package.json'), (Join-Path $root 'backend\package.json'))) {
    $raw = [System.IO.File]::ReadAllText($pkgPath)
    $raw = $raw -replace '"version":\s*"[^"]*"', "`"version`": `"$Version`""
    [System.IO.File]::WriteAllText($pkgPath, $raw, $utf8SinBom)
}

Write-Host "== 2/6 Instalando dependencias =="
Push-Location $root
npm install
Push-Location (Join-Path $root 'backend')
npm install --omit=dev
Pop-Location
Pop-Location

Write-Host "== 3/6 Generando el build de produccion del frontend =="
Push-Location $root
npm run build
Pop-Location

Write-Host "== 4/6 Preparando herramientas embebidas (Node/NSSM) =="
& (Join-Path $installerDir 'prep-vendor.ps1')

Write-Host "== 5/6 Armando el paquete de actualizacion (release.zip) =="
Remove-Item $releaseDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $releaseDir | Out-Null
Copy-Item (Join-Path $root 'dist') (Join-Path $releaseDir 'dist') -Recurse
Copy-Item (Join-Path $root 'backend') (Join-Path $releaseDir 'backend') -Recurse

# Nunca empaquetar datos reales: se borran explícitamente después de copiar
# (más confiable que -Exclude en una copia recursiva).
Get-ChildItem (Join-Path $releaseDir 'backend\db') -Filter 'don_penolinni.db*' -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item (Join-Path $releaseDir 'backend\db\backups') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $releaseDir 'backend\uploads') -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $releaseDir 'backend\uploads') | Out-Null

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$zipPath = Join-Path $outputDir "DonPenolinniPOS-$Version.zip"
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $releaseDir '*') -DestinationPath $zipPath

Write-Host "== 6/6 Compilando el instalador (Setup.exe) =="
$iscc = "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) { $iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" }
if (-not (Test-Path $iscc)) { throw "No se encontro ISCC.exe (Inno Setup). Instalalo con: winget install JRSoftware.InnoSetup" }
& $iscc "/DAppVersion=$Version" (Join-Path $installerDir 'pizzeria-pos.iss')

Write-Host ""
Write-Host "Listo:"
Write-Host "  Instalador (instalacion nueva):    $outputDir\DonPenolinniPOS-Setup-$Version.exe"
Write-Host "  Paquete de actualizacion (updater): $zipPath"

if ($Publicar) {
    Write-Host ""
    Write-Host "== Publicando release v$Version en GitHub =="
    Push-Location $root
    git add -A
    git commit -m "chore: release v$Version" --allow-empty-message -m "" 2>$null
    git tag "v$Version"
    git push origin HEAD
    git push origin "v$Version"
    gh release create "v$Version" $zipPath --title "v$Version" --notes "Version $Version"
    Pop-Location
}
