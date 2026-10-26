# Administración de la carta — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla `/carta` solo para el administrador, con productos con foto, precios editables en la tarjeta, editor lateral, asistente de 3 pasos y categorías ordenables, según el artboard "Administrar carta".

**Architecture:** `CartaPage` es dueña de los datos (`getProductosAdmin`, `getCategorias`) y del aviso. Los componentes de `src/components/carta/` reciben datos y callbacks. La lógica pura va en `src/lib/carta.js` con tests `node:test`. El backend solo cambia en el manejo del 409 al renombrar una categoría.

**Tech Stack:** React 19, React Router 7, Tailwind 4, tokens CSS de `src/index.css`, Express y better-sqlite3.

**Spec:** `docs/superpowers/specs/2026-10-25-admin-carta-design.md`

## Global Constraints

- Rama `feat/admin-carta`. No se tocan `src/pages/PosPage.jsx`, `CheckoutSidebar`, `ModalCobro` ni `ModalVariantes`.
- No se agregan dependencias.
- Objetivos táctiles de mínimo 44px. Contraste de texto 4.5:1. Íconos de controles como SVG inline, sin emojis. Usar los tokens `var(--accent)`, `var(--on-accent)`, `var(--bg-*)`, `var(--border-*)`, `var(--text-*)`, `var(--tono-l)`; tema claro y oscuro.
- Todas las escrituras usan las funciones de `src/lib/api.js` y pasan `usuario.id` (de `useAuth()`) como `usuarioId`.
- Las URL de imagen se resuelven como en `ProductCard`: `/uploads/x` → `http://${location.hostname}:3001/uploads/x`.
- Textos exactos: "Carta", "Lo que se vende, con su foto y su precio", "Nuevo producto", "Sin foto", "Agregar foto", "Toca o arrastra aquí", "Visible en venta", "Oculto en venta", "Apágalo cuando se agote, sin borrarlo", "Eliminar producto", "Deshacer", "Así se verá en la venta", "Agregar a la carta", "Este orden es el mismo que verá el cajero en la venta.", "Nueva categoría".
- Gate de cada tarea: `npm test`, `npm run build` y ningún problema nuevo de ESLint en los archivos tocados (`npm run lint` ya tenía problemas en `main`).

## Review Focus

1. **Precio con texto o vacío** ("12.000", "$ 9000", ""): solo se toman los dígitos; si queda vacío, no se guarda. Test: `parsePrecio` (Tarea 1).
2. **Categorías con `orden` repetido** (el seed lo trae así): se normaliza antes de intercambiar. Test: `normalizarOrden` / `intercambiarOrden` (Tarea 1).
3. **Eliminar y cerrar la página antes de que venza el aviso:** no se envía el DELETE. Test: `programarEliminacion` (Tarea 2) con temporizador falso.
4. **Producto con ventas (409 al eliminar):** vuelve a la lista y ofrece "Ocultar". Verificación manual (Tarea 4).
5. **Subir un archivo que no es imagen o pesa más de 5 MB:** se rechaza sin llamar al servidor. Test: `validarFoto` (Tarea 1).

---

### Task 1: Backend 409 y lógica pura de la carta

**Files:**
- Modify: `backend/routes/productos.js` (`PUT /categorias/:id`)
- Create: `src/lib/carta.js`, `src/lib/carta.test.js`

**Interfaces — Produces** (exportadas de `src/lib/carta.js`):
- `tieneFoto(imagen: string) => boolean`: true si empieza por `/uploads/` o `http`.
- `urlImagen(imagen: string) => string`
- `parsePrecio(v: string|number) => number|null`: solo dígitos; si no hay ninguno, `null`.
- `formatoMiles(n: number) => string`: `12000` → `"12.000"`, en es-CO.
- `validarFoto(file: {type, size}) => string|null`: devuelve el mensaje de error o `null`. Mensajes: "Elige un archivo de imagen" y "La foto debe pesar menos de 5 MB" (límite: 5·1024·1024).
- `filtrarProductos(productos, { categoriaId: number|null, texto: string, soloSinFoto: boolean }) => productos`: el texto no distingue mayúsculas ni tildes.
- `contarPorCategoria(productos) => { [categoria_id]: number }`
- `normalizarOrden(categorias) => [{ id, orden }]`: ordena por (`orden`, `id`) y reasigna 1..N, devolviendo solo las que cambian.
- `intercambiarOrden(categorias, indice, dir: -1|1) => [{ id, orden }, { id, orden }] | null`: las dos actualizaciones a enviar, o `null` en los extremos. Asume el orden ya normalizado.
- `tamanosSugeridos(productos, categoriaId) => string[]`: los `nombre_tamanio` (en el orden de sus variantes) del primer producto de esa categoría con `tiene_variantes`, o `[]`.

- [ ] **Step 1: Write failing tests** in `src/lib/carta.test.js`, con un caso por función que use los valores de arriba:
  - `parsePrecio('$ 12.000') === 12000` y `parsePrecio('') === null`;
  - `validarFoto({type:'image/png', size: 6*1024*1024})` devuelve el mensaje de 5 MB, y `{type:'application/pdf', size:10}` devuelve el de "Elige un archivo de imagen";
  - `filtrarProductos` encuentra "Española" al buscar "espanola";
  - `normalizarOrden([{id:3,orden:0},{id:1,orden:0},{id:2,orden:5}])` da `[{id:1,orden:1},{id:3,orden:2},{id:2,orden:3}]` (todas cambian);
  - `intercambiarOrden` en el índice 0 con `dir -1` da `null`;
  - `tamanosSugeridos` de una categoría sin productos con variantes da `[]`.
- [ ] **Step 2: Run `npm test`.** Expected: FAIL porque no existe el módulo.
- [ ] **Step 3: Implement `src/lib/carta.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Backend.** En `PUT /categorias/:id`, captura el error `UNIQUE` y responde `409 { error: 'Ya existe una categoría llamada "<nombre>"' }`, con el mismo patrón que `POST`.
- [ ] **Step 6: Commit** `feat(carta): lógica pura de la carta y 409 al renombrar categoría`.

### Task 2: Componentes base: Aviso y ZonaFoto

**Files:** Create `src/components/carta/Aviso.jsx`, `src/components/carta/ZonaFoto.jsx`; add `programarEliminacion` to `src/lib/carta.js` with its test.

**Interfaces — Produces:**
- `programarEliminacion({ ejecutar: () => Promise, ms = 6000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) => { deshacer(): void, cancelarSinEjecutar(): void }`. Llama a `ejecutar` una sola vez cuando vence el tiempo. `deshacer` y `cancelarSinEjecutar` evitan la llamada.
- `Aviso({ aviso: { texto, accion?: { etiqueta, onClick } } | null, onCerrar })`: un `role="status"` fijo abajo al centro, con el botón de acción (por ejemplo "Deshacer" u "Ocultar") y el botón cerrar `aria-label="Cerrar aviso"`. Se oculta solo a los 6 s, llamando a `onCerrar`.
- `ZonaFoto({ imagen, nombre, variante: 'tarjeta'|'editor', onSubida: (url) => void, onError: (msg) => void })`:
  - acepta clic (`<input type="file" accept="image/*">` oculto) y soltar archivos (`onDragOver`/`onDrop`, resaltando el borde con `--accent` mientras se arrastra);
  - valida con `validarFoto`, sube con `subirImagenProducto` y muestra "Subiendo…" mientras tanto;
  - sin foto, muestra el recuadro punteado con "Agregar foto" y "Toca o arrastra aquí" (en `variante: 'editor'`, el texto es "Arrastra la foto aquí");
  - con foto, muestra `<img src={urlImagen(imagen)} alt="">` en 4:3 (tarjeta) o 16:10 (editor);
  - en `editor`, añade los botones "Cambiar foto" / "Elegir foto" y "Tomar con la cámara" (un segundo input con `capture="environment"`).

- [ ] **Step 1: Test** de `programarEliminacion` con un `setTimeoutFn` falso:
  - si vence el tiempo, `ejecutar` se llama 1 vez;
  - si antes se llama `deshacer`, se llama 0 veces;
  - si se llama `cancelarSinEjecutar`, se llama 0 veces.
- [ ] **Step 2:** Implementa la función hasta que el test pase, y luego los dos componentes.
- [ ] **Step 3:** `npm test`, `npm run build` y ESLint.
- [ ] **Step 4: Commit** `feat(carta): aviso con deshacer y zona de foto`.

### Task 3: CartaPage, tarjetas, ruta y Hub

**Files:**
- Create: `src/pages/CartaPage.jsx`, `src/components/carta/TarjetaProducto.jsx`
- Modify: `src/App.jsx` (ruta `/carta`, `roles={['admin']}`), `src/pages/HubPage.jsx` (módulo "Carta" con la descripción "Fotos, precios y categorías", solo admin, antes de Inventario), `src/pages/InventarioPage.jsx` (quitar la pestaña Carta)
- Delete: `src/components/inventario/TabCarta.jsx`

**Interfaces:**
- `CartaPage` guarda en su estado `productos`, `categorias`, `vista: 'productos'|'categorias'`, `categoriaId`, `texto`, `soloSinFoto`, `editandoId` y `aviso`. Expone `recargar()` y `actualizarLocal(id, cambios)` para que las tareas 4 a 6 los usen.
- `TarjetaProducto({ producto, seleccionado, onEditar, onFotoSubida, onGuardarPrecio(precio), onToggleVisible, onError })`.

- [ ] **Step 1: CartaPage.** Encabezado según la spec (volver a `/hub`, segmentado y "Nuevo producto", que por ahora solo abre un estado `asistenteAbierto`); buscador; "Sin foto" con su contador; chips por `categorias.orden` con conteo; aviso de pendientes con "Ver cuáles"; cuadrícula `repeat(auto-fill, minmax(220px, 1fr))`; estado vacío "No hay productos con ese filtro."
- [ ] **Step 2: TarjetaProducto:**
  - `ZonaFoto variante="tarjeta"`; al subir, `actualizarProducto(id, { imagen: url })` y aviso "Foto guardada";
  - el nombre es un botón que abre el editor;
  - precio inline solo en productos de precio único: campo con `formatoMiles` y ✓; Enter guarda y Esc cancela; usa `parsePrecio` y, si da `null`, no guarda. Con tamaños: "Desde $X" abre el editor;
  - interruptor `role="switch"` "Visible en venta" / "Oculto en venta", que llama a `actualizarProducto(id, { activo })`; la tarjeta se ve atenuada cuando está apagado;
  - cambio optimista con reversión y aviso si la llamada falla.
- [ ] **Step 3:** Ruta, Hub e Inventario; borrar `TabCarta.jsx` y su import.
- [ ] **Step 4:** `npm test`, `npm run build` y ESLint.
- [ ] **Step 5: Commit** `feat(carta): pantalla de carta con tarjetas, fotos y precios`.

### Task 4: Editor lateral y eliminar con Deshacer

**Files:** Create `src/components/carta/EditorProducto.jsx`; modify `CartaPage.jsx`.

**Interfaces:** `EditorProducto({ producto, categorias, onCambio(id, cambios), onCerrar, onEliminar(producto), onError })`.

- [ ] **Step 1: EditorProducto:**
  - `<aside aria-label="Editar producto">` a la derecha en pantallas de 1024px o más, y hoja a pantalla completa por debajo;
  - `ZonaFoto variante="editor"`;
  - nombre guardado en `onBlur` (no se guarda si queda vacío);
  - categorías como `role="radio"`, que llaman a `actualizarProducto(id, { categoria_id })`;
  - precios: el único precio llama a `actualizarProducto(id, { precio })`; con variantes, una fila por variante con `nombre_tamanio` y `actualizarVariante(v.id, { precio })` en `onBlur`;
  - interruptor "Visible en venta" con su ayuda;
  - botón "Listo" y, al final, "Eliminar producto".
- [ ] **Step 2: Eliminar en CartaPage:**
  - quita el producto del estado y crea `programarEliminacion({ ejecutar: () => eliminarProducto(id, usuario.id) })`;
  - el aviso dice "Producto eliminado · <nombre>" con "Deshacer", que lo restaura;
  - si `ejecutar` falla con 409, restaura el producto y muestra el aviso "Tiene ventas registradas, así que no se puede borrar. Puedes ocultarlo de la venta." con la acción "Ocultar" (`actualizarProducto(id, { activo: false })`);
  - al desmontar `CartaPage`, llama a `cancelarSinEjecutar()` en las eliminaciones pendientes.
- [ ] **Step 3:** Gate (test, build y ESLint).
- [ ] **Step 4: Commit** `feat(carta): editor lateral y eliminar con deshacer`.

### Task 5: Asistente "Nuevo producto"

**Files:** Create `src/components/carta/AsistenteProducto.jsx`; modify `CartaPage.jsx`.

**Interfaces:** `AsistenteProducto({ categorias, productos, categoriaInicial, onCreado(producto), onCerrar, onError })`.

- [ ] **Step 1:** Modal `role="dialog" aria-modal` con "Paso N de 3", barra de 3 segmentos, foco atrapado y Esc para cerrar. Los pasos siguen la spec:
  1. `ZonaFoto variante="editor"` (opcional) y nombre obligatorio.
  2. Tarjetas de categoría en `role="radio"`, con `categoriaInicial` preseleccionada.
  3. "Un solo precio" o "Por tamaños". "Por tamaños" solo aparece si `tamanosSugeridos(...)` no está vacío, y entonces muestra una fila de precio por tamaño. Todos los precios deben ser > 0 para continuar. Debajo, "Así se verá en la venta" con `ProductCard` de `src/components/ProductCard.jsx` y callbacks vacíos.
- [ ] **Step 2:** "Agregar a la carta" llama a `crearProducto({ nombre, categoria_id, imagen: url || '🍽️', tiene_variantes, precio, variantes: [{ nombre_tamanio, precio }] }, usuario.id)`. Después, `onCreado`: CartaPage recarga, selecciona esa categoría y muestra el aviso "Agregado a la carta · <nombre>".
- [ ] **Step 3:** Gate.
- [ ] **Step 4: Commit** `feat(carta): asistente de nuevo producto`.

### Task 6: Categorías

**Files:** Create `src/components/carta/ListaCategorias.jsx`; modify `CartaPage.jsx`.

**Interfaces:** `ListaCategorias({ categorias, conteo, onRecargar, onAviso, usuarioId })`.

- [ ] **Step 1:** Título "Categorías", el texto "Este orden es el mismo que verá el cajero en la venta." y el botón "Nueva categoría". La lista es un `<ol>` numerado; cada fila tiene:
  - el ícono de agarre `aria-hidden`;
  - el nombre en un input con label oculto, guardado en `onBlur` con `actualizarCategoria`; si responde 409, revierte y muestra el aviso con el mensaje del backend;
  - "N productos";
  - ↑ y ↓ con `aria-label` "Subir <nombre>" / "Bajar <nombre>", deshabilitados en los extremos;
  - Eliminar.
- [ ] **Step 2: Reordenar.** Antes del primer intercambio, si `normalizarOrden` devuelve cambios, se envían; después se envían los dos `PUT` de `intercambiarOrden` y se recarga.
- [ ] **Step 3: Eliminar.** Con productos, muestra el aviso "“X” tiene N productos. Muévelos a otra categoría antes de eliminarla." sin llamar al servidor. Vacía, usa `programarEliminacion` con "Deshacer".
- [ ] **Step 4: Nueva categoría.** Agrega una fila al final con el input en foco; en `onBlur`, si tiene nombre, `crearCategoria({ nombre, orden: max+1 })`, y si no, la fila desaparece.
- [ ] **Step 5:** Gate.
- [ ] **Step 6: Commit** `feat(carta): categorías ordenables`.

### Task 7: Verificación final

- [ ] Revisión de toda la rama y prueba en el navegador con la lista de verificación de la spec (la hace el controlador).
