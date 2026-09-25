' installer/abrir-caja.vbs
' Acceso directo del Escritorio: el backend ya corre siempre como servicio de
' Windows, así que esto solo espera a que responda (por si la PC acaba de
' encender) y abre el punto de venta en el navegador — sin ventanas negras.

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

url = "http://localhost:3001"

' Esperar hasta ~15s a que el backend responda (arranque en frío tras encender la PC)
intentos = 0
listo = False
Do While intentos < 15 And Not listo
    On Error Resume Next
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", url & "/api/health", False
    http.Send()
    If Err.Number = 0 And http.Status = 200 Then listo = True
    On Error Goto 0
    If Not listo Then
        WScript.Sleep 1000
        intentos = intentos + 1
    End If
Loop

bravePath = objShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\BraveSoftware\Brave-Browser\Application\brave.exe"
altBravePath = "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"

If objFSO.FileExists(bravePath) Then
    objShell.Run """" & bravePath & """ --app=" & url, 1, False
ElseIf objFSO.FileExists(altBravePath) Then
    objShell.Run """" & altBravePath & """ --app=" & url, 1, False
Else
    objShell.Run url, 1, False
End If
