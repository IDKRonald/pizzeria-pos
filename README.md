# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

Guia de instalación para PC:
Paso 1: Preparar los archivos (En tu computadora)
No puedes simplemente copiar y pegar toda la carpeta tal cual, porque la carpeta oculta node_modules (donde están las librerías) es muy pesada y a veces genera conflictos al cambiar de computadora.

Abre la carpeta donde tienes tu proyecto (pizzeria-pos).

Elimina la carpeta llamada node_modules. No te preocupes, no vas a dañar nada, la reconstruiremos en la otra PC.

Comprime toda la carpeta pizzeria-pos en un archivo ZIP (clic derecho -> Comprimir en archivo ZIP).

Guarda ese archivo ZIP en una memoria USB.

Paso 2: Preparar la computadora de la pizzería
Esa computadora necesita el "motor" para poder leer tu código y ejecutar el archivo .bat que creamos.

Conecta tu memoria USB y copia el archivo ZIP al Disco Local (C:) o a la carpeta de Documentos.

Descomprime el archivo ZIP.

Abre el navegador de esa computadora, entra a nodejs.org y descarga la versión recomendada (LTS) de Node.js.

Instala Node.js (es solo darle "Siguiente" a todo, no requiere configuración especial).

Paso 3: Instalación y primer arranque (Solo se hace una vez)
Ahora vamos a encender el motor en su nuevo hogar.

Entra a la carpeta descomprimida pizzeria-pos en la computadora de la pizzería.

Haz clic en la barra de direcciones de la carpeta en la parte superior, borra la ruta, escribe cmd y presiona Enter. Esto abrirá una terminal negra exactamente en esa carpeta.

Escribe el comando npm install y presiona Enter. Verás que se empieza a descargar nuevamente la carpeta node_modules. Esto tomará un par de minutos.

Cuando termine, ya puedes cerrar esa ventana negra.

Paso 4: El Acceso Directo Mágico
Dentro de esa misma carpeta, busca el archivo iniciar_pos.bat que creamos en el paso anterior.

Haz clic derecho sobre él -> Enviar a -> Escritorio (crear acceso directo).

Ve al escritorio, ponle un nombre fácil como "Caja Pizzería" y, si quieres, cámbiale el ícono.

¡Listo! A partir de ese momento, el cajero solo tiene que encender la computadora, hacer doble clic en el ícono del escritorio y el sistema arrancará automáticamente en Chrome con la impresión configurada.
