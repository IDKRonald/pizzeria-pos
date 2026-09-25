# installer/registrar-tarea.ps1
# Corrido una vez por el instalador. Registra la Tarea Programada de Windows
# que revisa actualizaciones en GitHub: cada 6 horas, y también al encender
# la PC (por si estuvo apagada varios días).
param(
    [Parameter(Mandatory=$true)][string]$AppDir
)

$ErrorActionPreference = 'Stop'
$taskName = 'DonPenolinniPOS-Actualizar'
$scriptPath = Join-Path $AppDir 'actualizar.ps1'

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -NonInteractive -File `"$scriptPath`""

$triggerPeriodico = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration ([TimeSpan]::MaxValue)
$triggerArranque = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName `
    -Action $action -Trigger @($triggerPeriodico, $triggerArranque) `
    -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Tarea programada '$taskName' registrada."
