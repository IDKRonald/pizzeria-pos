; installer/pizzeria-pos.iss
; Instalador de Don Peñolinni POS — compilar con:
;   ISCC.exe /DAppVersion=1.0.0 pizzeria-pos.iss
; (o mejor, correr installer\empaquetar-release.ps1, que hace todo el proceso)
;
; Instala: Node.js portátil + backend (con node_modules ya compilados) +
; el build de producción del frontend + NSSM, registra el backend como
; servicio de Windows, y programa la tarea de actualización automática.
; Los datos reales (base de datos, imágenes subidas) NUNCA viven dentro de
; esta carpeta de instalación — van en %ProgramData%\DonPenolinniPOS, para
; que una actualización jamás los toque.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{8F2C9A1E-6B3D-4E7F-9C2A-1D4E5F6A7B8C}}
AppName=Don Peñolinni POS
AppVersion={#AppVersion}
AppPublisher=Don Peñolinni
DefaultDirName={autopf}\DonPenolinniPOS
DefaultGroupName=Don Peñolinni POS
DisableProgramGroupPage=yes
OutputDir=output
OutputBaseFilename=DonPenolinniPOS-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\logo.ico
UninstallDisplayIcon={app}\logo.ico
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableWelcomePage=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\backend\*"; DestDir: "{app}\backend"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "db\don_penolinni.db,db\don_penolinni.db-wal,db\don_penolinni.db-shm,db\backups\*,uploads\*"
Source: "vendor\node-win-x64\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "vendor\nssm\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "actualizar.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "registrar-tarea.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "abrir-caja.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\logo.ico"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\DonPenolinniPOS"; Permissions: users-modify
Name: "{commonappdata}\DonPenolinniPOS\uploads"; Permissions: users-modify

[Icons]
Name: "{autodesktop}\Don Peñolinni POS"; Filename: "{app}\abrir-caja.vbs"; IconFilename: "{app}\logo.ico"; WorkingDir: "{app}"
Name: "{group}\Don Peñolinni POS"; Filename: "{app}\abrir-caja.vbs"; IconFilename: "{app}\logo.ico"; WorkingDir: "{app}"
Name: "{group}\Desinstalar Don Peñolinni POS"; Filename: "{uninstallexe}"

[Run]
; Registrar el backend como servicio de Windows (arranca solo, se reinicia si falla)
Filename: "{app}\nssm.exe"; Parameters: "install DonPenolinniPOS ""{app}\node\node.exe"" ""{app}\backend\server.js"""; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "set DonPenolinniPOS AppDirectory ""{app}\backend"""; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "set DonPenolinniPOS AppEnvironmentExtra ""DATA_DIR={commonappdata}\DonPenolinniPOS"""; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "set DonPenolinniPOS Start SERVICE_AUTO_START"; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "set DonPenolinniPOS AppExit Default Restart"; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "set DonPenolinniPOS DisplayName ""Don Penolinni POS"""; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "set DonPenolinniPOS Description ""Backend del punto de venta Don Penolinni. No cerrar."""; Flags: runhidden waituntilterminated
Filename: "{app}\nssm.exe"; Parameters: "start DonPenolinniPOS"; Flags: runhidden waituntilterminated
; Registrar la tarea programada del actualizador
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NonInteractive -File ""{app}\registrar-tarea.ps1"" -AppDir ""{app}"""; Flags: runhidden waituntilterminated
; Abrir la app al terminar
Filename: "{app}\abrir-caja.vbs"; Description: "Abrir Don Peñolinni POS ahora"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\nssm.exe"; Parameters: "stop DonPenolinniPOS"; Flags: runhidden waituntilterminated; RunOnceId: "StopService"
Filename: "{app}\nssm.exe"; Parameters: "remove DonPenolinniPOS confirm"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveService"
Filename: "powershell.exe"; Parameters: "-Command ""Unregister-ScheduledTask -TaskName 'DonPenolinniPOS-Actualizar' -Confirm:$false -ErrorAction SilentlyContinue"""; Flags: runhidden waituntilterminated; RunOnceId: "RemoveTask"

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel2.Caption := 'Este instalador configura el punto de venta completo: instala el servicio que corre siempre en segundo plano y revisa actualizaciones solas todas las noches.' + #13#10 + #13#10 +
    'Tus datos (ventas, inventario, fotos) se guardan aparte de la carpeta de instalación, así que instalar una actualización nunca los borra.';
end;
