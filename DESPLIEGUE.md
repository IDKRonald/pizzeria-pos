# Despliegue en la computadora del local

## Instalación (recomendado): el instalador

Ahora existe un instalador de verdad (`DonPenolinniPOS-Setup-X.Y.Z.exe`, generado en
`installer/output/`) que hace todo automáticamente:

- Instala su propia copia de Node.js — no depende de tener nada instalado en la PC.
- Registra el backend como **servicio de Windows** (arranca solo al encender la PC,
  se reinicia si falla, no requiere ninguna ventana abierta).
- Crea un acceso directo en el Escritorio ("Don Peñolinni POS") que abre el punto
  de venta en el navegador.
- Programa una **actualización automática**: revisa GitHub cada 6 horas y, si hay
  una versión nueva, la instala sola entre las **4:00 y 5:00 a.m.** (cuando el
  local está cerrado) — nunca interrumpe una venta en curso.
- Guarda los datos reales (ventas, inventario, fotos de productos) en
  `%ProgramData%\DonPenolinniPOS\`, **fuera** de la carpeta de instalación — así
  una actualización nunca los toca ni los borra.

Para instalar: doble clic en el `.exe`, "Siguiente" hasta el final. Requiere permisos
de administrador (los pide Windows automáticamente).

### Migrar la instalación manual actual (una sola vez)

Si la computadora del local ya tiene el sistema corriendo desde una copia clonada
de GitHub (el flujo con `Abrir POS.bat` de más abajo), antes de instalar la versión
empaquetada hay que mover los datos reales para no perderlos:

1. Cerrar el sistema (o detener el servicio de NSSM si ya estaba instalado así).
2. **Hacer un respaldo manual** de `backend\db\don_penolinni.db` (copiarlo a un USB
   o a otra carpeta) antes de tocar nada — por seguridad.
3. Instalar `DonPenolinniPOS-Setup-X.Y.Z.exe` normalmente.
4. Detener el nuevo servicio (`services.msc` → "Don Penolinni POS" → Detener).
5. Copiar (no mover, hasta confirmar que todo funciona):
   - `backend\db\don_penolinni.db` (+ `-wal`/`-shm` si existen) →
     `%ProgramData%\DonPenolinniPOS\don_penolinni.db`
   - `backend\uploads\*` → `%ProgramData%\DonPenolinniPOS\uploads\`
6. Iniciar el servicio de nuevo y confirmar en `http://localhost:3001` que aparecen
   los datos reales (productos, ventas, etc.), no los de una instalación vacía.
7. Solo cuando esté confirmado que todo quedó bien, se puede borrar la carpeta
   clonada de GitHub vieja.

## Generar una nueva versión (para quien mantiene el proyecto)

```
cd installer
powershell -ExecutionPolicy Bypass -File empaquetar-release.ps1 -Version 1.1.0
```

Esto genera dos cosas en `installer\output\`:
- `DonPenolinniPOS-Setup-1.1.0.exe` — el instalador completo, para una instalación nueva.
- `DonPenolinniPOS-1.1.0.zip` — el paquete que descarga el actualizador automático.

Para publicarla en GitHub (crea el tag, el commit y el Release con el `.zip` adjunto,
que es lo que el actualizador de las computadoras ya instaladas va a detectar):

```
powershell -ExecutionPolicy Bypass -File empaquetar-release.ps1 -Version 1.1.0 -Publicar
```

(Requiere `gh` autenticado y el repo en GitHub. La primera vez hay que correr
`installer\prep-vendor.ps1` — lo hace `empaquetar-release.ps1` solo si falta.)

---

## Alternativa manual (legado): `Abrir POS.bat` sin instalador

Este flujo sigue existiendo por si se necesita correr el sistema directo desde una
copia clonada del repo, sin pasar por el instalador (por ejemplo, para desarrollar).

Ya no hace falta correr `npm install` cada día. La causa del problema original era
que el sistema arrancaba el servidor de **desarrollo** de Vite (pensado para
programar, no para uso real), en vez de una versión de producción ya compilada.

`Abrir POS.bat` arranca un solo proceso (el backend), que sirve la aplicación ya
compilada desde el puerto único `3001`. Todo funciona igual desde otros
dispositivos en la misma red (celulares, tablets) usando la IP de la computadora
del local en vez de `localhost`.

Cuando haya una actualización del sistema, corre `Actualizar POS.bat` — descarga
los cambios (`git pull`), instala dependencias si cambiaron y regenera el build.

### Registrar el servicio de Windows a mano (si no se usa el instalador)

1. Descargar NSSM desde https://nssm.cc/download y descomprimir `nssm.exe` (versión
   de la carpeta `win64`) en, por ejemplo, `C:\nssm\nssm.exe`.
2. Generar el build una vez: correr `Actualizar POS.bat` (o `npm run build`).
3. Abrir PowerShell o CMD **como Administrador**:
   ```
   C:\nssm\nssm.exe install DonPenolinniPOS "C:\Program Files\nodejs\node.exe" "server.js"
   ```
4. Con `nssm edit DonPenolinniPOS`: **Startup directory** = carpeta `backend` del
   proyecto; pestaña **Details** → Startup type `Automatic`; pestaña **Exit
   actions** → "Restart application".
5. `C:\nssm\nssm.exe start DonPenolinniPOS`, confirmar `http://localhost:3001`.

**Para desinstalar el servicio**: `C:\nssm\nssm.exe remove DonPenolinniPOS confirm`.
Cada vez que corras `Actualizar POS.bat` con el servicio así instalado, hay que
reiniciarlo a mano: `C:\nssm\nssm.exe restart DonPenolinniPOS`.
