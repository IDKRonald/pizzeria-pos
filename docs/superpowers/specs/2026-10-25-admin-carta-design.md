# Administración de la carta — Diseño

**Fecha:** 2026-10-25
**Referencia visual:** artboard "Administrar carta" en el canvas https://claude.ai/artifact/KKAPHv1QkNS7Q9Y3Cyxpf2
**Rama:** `feat/admin-carta`, sobre `feat/rediseno-pantalla-venta` (reutiliza sus tokens de color y `src/lib/venta.js`).

## Objetivo

Que el administrador mantenga la carta (fotos, productos, precios y categorías) sin ayuda y sin miedo a romper algo. Hoy la carta es la 7.ª de 9 pestañas dentro de Inventario, las tarjetas muestran emojis y las acciones son íconos sin texto (⏸, ✕).

**Criterios de éxito:**
- Desde el Hub, en dos toques, el administrador llega a una pantalla donde ve qué productos no tienen foto y les pone una arrastrando o tocando la tarjeta.
- Puede cambiar el precio de un producto de precio único sin abrir ningún formulario.
- Puede crear un producto en 3 pasos y ver cómo quedará en la venta antes de guardarlo.
- Puede reordenar categorías, y la venta muestra ese mismo orden.
- Ninguna acción destructiva ocurre con un solo toque accidental: eliminar tiene Deshacer, y lo que no se puede borrar explica por qué.

## Alcance

**Dentro:** una pantalla nueva `/carta` (solo admin) con las secciones Productos y Categorías, una tarjeta "Carta" en el Hub, y sacar la pestaña Carta de Inventario.

**Fuera:** inventario, recetas, combos, importar Excel (siguen en Inventario, sin cambios), descripciones largas, emojis de categoría (el campo se conserva sin editarlo) y recorte o edición de fotos.

## Backend

Los endpoints que hacen falta ya existen y se usan tal cual: categorías (`GET/POST/PUT/DELETE /api/categorias`), productos (`GET /api/productos/admin/todos`, `POST/PUT/DELETE /api/productos/:id`), variantes (`POST /api/productos/:id/variantes`, `PUT/DELETE /api/variantes/:id`) y `POST /api/uploads/imagen`. Solo hay un cambio:

- `PUT /api/categorias/:id`: devolver 409 con un mensaje claro ("Ya existe una categoría llamada …") cuando el nombre choca con otro, igual que ya hace `POST`. Hoy responde 500.

Reglas del backend que la interfaz debe respetar:
- No se puede eliminar un producto con historial de ventas: responde 409 y sugiere desactivarlo.
- No se puede eliminar una categoría con productos: responde 409.
- `productos.imagen` guarda un emoji o una URL `/uploads/…`. Un producto "tiene foto" si `imagen` empieza por `/uploads/` o `http`.
- El precio de un producto con variantes vive en `producto_variantes`, no en `productos.precio`.

## Pantalla `/carta`

Ruta protegida con `roles={['admin']}`. Usa los tokens de `index.css` (tema claro y oscuro), controles de mínimo 44px e íconos SVG.

**Encabezado:** volver al Hub, título "Carta" con el subtítulo "Lo que se vende, con su foto y su precio", un segmentado Productos / Categorías y el botón principal **Nuevo producto**.

### Productos

- **Barra:** buscador por nombre y filtro **Sin foto** con su contador.
- **Chips de categoría** con su conteo, en el orden de `categorias.orden`, igual que en la venta.
- **Aviso de pendientes:** si hay productos sin foto y el filtro está apagado, aparece "N productos no tienen foto. Arrastra una foto encima de la tarjeta o tócala." con el botón **Ver cuáles**, que activa el filtro.
- **Cuadrícula de tarjetas** (`auto-fill`, mínimo 220px):
  - **Foto:** si la tiene, se muestra la foto 4:3; tocarla abre el editor. Si no la tiene, un recuadro punteado con "Agregar foto · Toca o arrastra aquí". Tocar abre el selector de archivos (`accept="image/*"`), y soltar un archivo encima lo sube. Al terminar: aviso "Foto guardada".
  - **Nombre:** al tocarlo, abre el editor.
  - **Precio:** en un producto de precio único, al tocarlo se convierte en un campo numérico con formato de miles y un botón ✓. Enter guarda y Esc cancela. En un producto con tamaños muestra "Desde $X", y tocarlo abre el editor.
  - **Interruptor "Visible en venta"** (`productos.activo`): cuando está apagado, la tarjeta se ve atenuada. Aviso: "X oculto en la venta".
- **Estado vacío:** "No hay productos con ese filtro."

### Editor lateral

Panel a la derecha. En pantallas de menos de 1024px pasa a ser una hoja a pantalla completa. Contiene:
- **Foto grande** como zona para soltar un archivo, con los botones "Cambiar foto" / "Elegir foto" y "Tomar con la cámara" (`capture="environment"`).
- **Nombre:** se guarda al salir del campo.
- **Categoría:** botones, uno por categoría.
- **Precios:** el único precio o una fila por variante con su `nombre_tamanio`. Cada uno se guarda al salir del campo.
- **Interruptor "Visible en venta"**, con la ayuda "Apágalo cuando se agote, sin borrarlo".
- **"Listo"**, que cierra el panel, y al final, separado, **"Eliminar producto"**.

Los cambios se guardan campo por campo; no hay un botón "Guardar" global. Si el guardado falla, el campo vuelve a su valor anterior y aparece un aviso con el error.

### Eliminar con Deshacer

Al tocar "Eliminar producto", el producto desaparece de la lista y sale el aviso "Producto eliminado · Deshacer" durante 6 segundos. El `DELETE` se envía solo cuando el aviso vence. Si se toca Deshacer, no se envía nada. Si el backend responde 409 (tiene ventas), el producto vuelve a la lista y el aviso dice "Tiene ventas registradas, así que no se puede borrar. Puedes ocultarlo de la venta." con el botón **Ocultar**. Si la página se cierra antes de que venza el aviso, el producto no se elimina.

### Asistente "Nuevo producto"

Modal de 3 pasos con barra de progreso, "Atrás" y "Siguiente". "Siguiente" está deshabilitado mientras el paso esté incompleto.
1. **Foto y nombre.** La foto es opcional y el nombre es obligatorio.
2. **Categoría.** Tarjetas grandes; se preselecciona la del chip activo si no es "Todas".
3. **Precio.** Dos opciones: "Un solo precio" o "Por tamaños". "Por tamaños" solo aparece si la categoría elegida tiene algún producto con variantes, y entonces propone los mismos `nombre_tamanio` de ese producto, cada uno con su campo de precio. Debajo, la vista previa **"Así se verá en la venta"** usa la misma tarjeta de la venta.

"Agregar a la carta" crea el producto (y sus variantes), cierra el asistente, selecciona su categoría y muestra el aviso "Agregado a la carta · X".

### Categorías

- Lista numerada en el orden de la venta. Cada fila tiene un nombre editable (se guarda al salir del campo), el conteo "N productos", los botones ↑ y ↓ (deshabilitados en los extremos) y el botón Eliminar.
- **↑ / ↓** intercambian el `orden` con la vecina (dos `PUT`). Si `orden` está repetido, como en el seed, se normaliza a 1..N antes del primer cambio.
- **Eliminar:**
  - Con productos: no se envía nada y se muestra "“X” tiene N productos. Muévelos a otra categoría antes de eliminarla."
  - Vacía: el mismo patrón de Deshacer diferido que en productos.
- **"Nueva categoría":** agrega una fila al final con el nombre en foco, y la crea al salir del campo si tiene nombre.

## Hub e Inventario

- `HubPage`: nueva tarjeta **Carta** ("Fotos, precios y categorías"), solo para admin, antes de Inventario.
- `InventarioPage`: se quita la pestaña Carta. `TabCarta.jsx` deja de usarse y se elimina.

## Estructura del código

- `src/pages/CartaPage.jsx`: encabezado, secciones y estado de la página (datos, filtros, aviso).
- `src/components/carta/TarjetaProducto.jsx`, `EditorProducto.jsx`, `AsistenteProducto.jsx`, `ListaCategorias.jsx`, `ZonaFoto.jsx` (seleccionar o soltar un archivo y subirlo) y `Aviso.jsx` (aviso con Deshacer y temporizador).
- `src/lib/carta.js`, lógica pura con tests (`node:test`): `tieneFoto(imagen)`, `filtrarProductos(productos, {categoria, texto, soloSinFoto})`, `normalizarOrden(categorias)`, `intercambiarOrden(categorias, i, dir)`, `tamanosSugeridos(productos, categoriaId)` y `contarPorCategoria(productos)`.
- La tarjeta de vista previa del asistente reutiliza `ProductCard` de la venta.

## Manejo de errores

- Toda llamada que falla muestra un aviso con el mensaje del backend y revierte el cambio optimista.
- Subida de foto: se rechazan archivos que no son imagen o pesan más de 5 MB, antes de subirlos ("La foto debe pesar menos de 5 MB"). Mientras sube, la tarjeta muestra "Subiendo…".

## Verificación

1. `npm test` (incluye `src/lib/carta.test.js`), `npm run build` y ningún problema nuevo de ESLint en los archivos tocados.
2. En el navegador, con el backend local y una base de datos temporal:
   - poner una foto con clic y otra arrastrando, y confirmar que aparece en la venta;
   - cambiar el precio en la tarjeta;
   - ocultar un producto y confirmar que desaparece de la venta;
   - crear un producto de precio único y una pizza por tamaños;
   - eliminar con Deshacer, y eliminar un producto con ventas (409);
   - reordenar categorías y confirmar el orden en la venta;
   - renombrar una categoría con un nombre duplicado (409);
   - tema claro;
   - ancho de tablet.
