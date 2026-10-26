# Rediseño de la pantalla de venta — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar `/pos` (catálogo, panel de orden, cobro y selector de tamaño/mitades) según el artefacto, sin cambiar el backend ni la lógica de PosPage.

**Architecture:** `PosPage.jsx` sigue siendo el dueño del estado. Los cálculos puros nuevos van a `src/lib/venta.js` y se prueban con `node --test`. Los componentes visuales se reescriben con las mismas props, y el cobro se muda a un modal nuevo, `ModalCobro.jsx`.

**Tech Stack:** React 19, Tailwind 4, variables CSS en `src/index.css`, Vite 8 y `node:test` (Node 22, sin dependencias nuevas).

**Spec:** `docs/superpowers/specs/2026-10-25-rediseno-pantalla-venta-design.md`

## Global Constraints

- No se tocan `backend/`, `src/lib/api.js`, `src/lib/socket.js` ni las claves `pos_v1_*` de localStorage.
- No se agregan dependencias a `package.json` (solo el script `test`).
- Objetivos táctiles de mínimo 44px. Contraste de texto de 4.5:1. Íconos de controles como SVG inline, sin emojis. Los emojis del ticket y de WhatsApp se mantienen.
- El acento es `#F47A2A` y el texto sobre el acento es `#1A0E05`. Fondo oscuro `#121318`, superficie `#20232B`, borde `#2D313B`.
- Se conservan el tema claro y el oscuro (`[data-theme]`).
- Los textos de la interfaz van en español y siguen la spec ("Cobrar $X", "Enviar a cocina", "Agregar · $X", "Toca un producto para elegir tamaño y agregarlo a la orden.").
- Moneda con `toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })`.

## Review Focus

1. **Efectivo con recibido vacío o con texto ("50.000", "$50000"):** se interpreta solo con los dígitos. Si queda vacío, el botón queda deshabilitado y no da error. Test: `parseMonto` en la Tarea 1.
2. **Abono parcial en efectivo:** el mínimo del recibido es el abono, no el total. Test: `puedeConfirmarCobro` en la Tarea 1.
3. **Cambiar el tamaño cuando ya se eligió la segunda mitad:** si esa pizza no existe en el tamaño nuevo, la mitad se descarta y "Agregar" se deshabilita hasta elegir otra. Test: `segundaMitadValida` en la Tarea 1.
4. **Pedido abierto desde Mesas (`mesaInfo` fijada) o con edición bloqueada:** no se puede cambiar el tipo de orden ni la mesa. Verificación manual en la Tarea 4.
5. **Atajo `/` mientras se escribe en un campo:** no roba el foco. Test: `debeEnfocarBusqueda` en la Tarea 1.

---

### Task 1: Tokens de estilo y lógica pura de venta

**Files:**
- Modify: `src/index.css` (bloques `[data-theme="dark"], :root` y `[data-theme="light"]`)
- Create: `src/lib/venta.js`
- Create: `src/lib/venta.test.js`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces (todas exportadas desde `src/lib/venta.js`):
  - `formatCOP(n: number) => string`
  - `parseMonto(v: string|number) => number`: solo dígitos; si no hay ninguno, devuelve `0`.
  - `tipoOrden({ esDomicilio: boolean, mesa: string }) => 'mesa'|'llevar'|'domicilio'`
  - `aplicarTipoOrden(tipo) => { esDomicilio: boolean, limpiarMesa: boolean }`
  - `precioDesde(producto) => number`: el mínimo de `producto.variantes[].precio`, o `producto.precio`.
  - `tonoProducto(id: string|number) => string`: devuelve `hsl(H, 22%, 22%)` con H estable a partir del id.
  - `billetesRapidos(monto: number) => number[]`: `[monto, techo a 10.000, techo a 20.000, techo a 50.000, 100.000 cuando monto < 100.000]`, sin repetidos, ordenado y solo valores ≥ monto.
  - `calcularCambio(recibido: number, aPagar: number) => number`: devuelve `max(0, recibido - aPagar)`.
  - `puedeConfirmarCobro({ tipoPago, recibido, aPagar, isProcesando }) => boolean`
  - `segundaMitadValida(segunda, tamano, menu) => boolean`
  - `debeEnfocarBusqueda(evento: { key, target: { tagName, isContentEditable } }) => boolean`

- [ ] **Step 1: Write the failing tests** in `src/lib/venta.test.js` (`import { test } from 'node:test'; import assert from 'node:assert/strict';`):
  - `parseMonto`: `parseMonto('$ 50.000') === 50000`, `parseMonto('') === 0`, `parseMonto('abc') === 0`, `parseMonto(12000) === 12000`.
  - `tipoOrden`: `{esDomicilio:true, mesa:'3'}` da `'domicilio'`; `{false,'3'}` da `'mesa'`; `{false,''}` da `'llevar'`.
  - `aplicarTipoOrden('llevar')` da `{ esDomicilio:false, limpiarMesa:true }`; `'domicilio'` da `{ true, true }`; `'mesa'` da `{ false, false }`.
  - `precioDesde({variantes:[{precio:41000},{precio:25000}]}) === 25000`; `precioDesde({precio:7000}) === 7000`.
  - `tonoProducto('donp') === tonoProducto('donp')` y la salida cumple `/^hsl\(\d+, 22%, 22%\)$/`.
  - `billetesRapidos(37000)` da `[37000, 40000, 50000, 100000]`; `billetesRapidos(50000)` da `[50000, 100000]`; `billetesRapidos(120000)` da `[120000, 150000]`.
  - `calcularCambio(50000, 37000) === 13000`; `calcularCambio(20000, 37000) === 0`.
  - `puedeConfirmarCobro`: en efectivo con recibido 30000 y aPagar 37000 da `false`; con 37000 da `true`; en transferencia con recibido 0 da `true`; con `isProcesando: true` da `false`; en efectivo con aPagar 0 (abono vacío) da `false`.
  - `segundaMitadValida(null, …) === false`; con una pizza que sí tiene ese tamaño, `true`; con una que no lo tiene, `false` (el menú de prueba va dentro del test, con la forma de `menuPizzeria`: `{id, categoria:'Pizzas', variantes:[{tamano|nombre, precio}]}`; antes de escribirlo, revisa en `src/data/menu.js` cuál es el nombre real del campo de tamaño).
  - `debeEnfocarBusqueda`: con `key '/'` sobre `BODY` da `true`; sobre `INPUT` o `TEXTAREA` da `false`; con `isContentEditable` da `false`; con `key 'a'` da `false`.

- [ ] **Step 2: Add the script `"test": "node --test src/lib/"` to `package.json`, then run `npm test`.** Expected: FAIL, porque no se encuentra el módulo `./venta.js`.

- [ ] **Step 3: Implement `src/lib/venta.js`** con las firmas de arriba. El tono es `hsl(${hash % 360}, 22%, 22%)`, con un hash simple sumando los char codes. En `puedeConfirmarCobro`, `aPagar` es lo que se cobra ahora (total, o el abono si es parcial) y debe ser > 0; si el pago es en efectivo, además `recibido >= aPagar`.

- [ ] **Step 4: Run `npm test`.** Expected: todos los tests en PASS.

- [ ] **Step 5: Update the tokens in `src/index.css`.** En el tema oscuro: `--bg-main: #121318`, `--bg-surf2: #20232B`, `--bg-surf6: #20232B`, `--border-1: #2D313B`, `--text-1: #F3F3F5`, `--text-3: #A4A9B6`. En ambos temas se agregan `--accent: #F47A2A`, `--accent-hover`, `--on-accent: #1A0E05` y `--focus-ring`. En el tema claro, `--accent: #C2541A` (contraste 4.5:1 sobre blanco) y `--on-accent: #FFFFFF`. Los demás tokens no cambian.

- [ ] **Step 6: Run `npm run lint && npm run build`.** Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add package.json src/lib/venta.js src/lib/venta.test.js src/index.css
git commit -m "feat(pos): tokens del rediseño y lógica pura de venta"
```

### Task 2: Catálogo: header, chips de categoría y tarjeta de producto

**Files:**
- Modify: `src/components/ProductCard.jsx`
- Modify: `src/pages/PosPage.jsx` (header, aprox. líneas 720–790; cuadrícula, aprox. 890)

**Interfaces:**
- Consumes: `formatCOP`, `precioDesde`, `tonoProducto`, `debeEnfocarBusqueda` de `src/lib/venta.js`.
- Produces: `ProductCard` con las mismas props (`producto, onAgregar, onAbrirVariantes, onAbrirCombo`).

- [ ] **Step 1: Rewrite `ProductCard`** como un único `<button type="button" aria-label={'Elegir ' + producto.nombre}>`. Arriba, la foto en 4:3 (`producto.imagen_url` o el campo de imagen que use hoy el componente) con `object-fit: cover` y `loading="lazy"`. Si no hay foto o falla la carga (`onError`), un bloque con fondo `tonoProducto(producto.id)`. Abajo, el nombre (`line-clamp-2`) y `'Desde ' + formatCOP(precioDesde(producto))`. Al hacer clic se conserva el `handleClick` actual. Borde `--border-1`; en hover y focus, borde `--accent`.

- [ ] **Step 2: Rewrite the header in `PosPage.jsx`.** Izquierda: "Don Peñolinni" y "Punto de venta". Al centro, el buscador `#input-busqueda` con la etiqueta visible o `aria-label="Buscar producto"` y una pista `/`. Derecha: "Pedidos abiertos" y "Reimprimir", que reutilizan los handlers que ya existen (`handleReimprimir` y la acción actual de pedidos abiertos), y la fecha y hora con `toLocaleString('es-CO', { weekday:'short', day:'numeric', month:'short', hour:'numeric', minute:'2-digit' })`.

- [ ] **Step 3: Add the `/` shortcut**: un `useEffect` con `keydown` en `window` que, si `debeEnfocarBusqueda(e)`, hace `e.preventDefault()` y enfoca `#input-busqueda`. Si PosPage ya tiene un `useEffect` de teclado (el atajo de cobrar, cerca de la línea 593), el atajo se agrega ahí en vez de crear otro.

- [ ] **Step 4: Replace the category filter with chips**: una fila con `overflow-x-auto` de botones `min-h-[44px] rounded-full`. Incluye "Todas" más `categoriasMenu`, cada chip con el conteo de productos de esa categoría. El chip activo lleva `background: var(--accent); color: var(--on-accent)` y `aria-pressed`.

- [ ] **Step 5: Run `npm run lint && npm run build`.** Expected: sin errores.

- [ ] **Step 6: Manual check** con `npm run dev` y el backend local, en `/pos`: aparecen las fotos o el placeholder, los chips filtran y muestran el conteo, `/` enfoca el buscador y no lo hace si estás escribiendo en otro campo, y un producto con variantes abre el modal.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProductCard.jsx src/pages/PosPage.jsx
git commit -m "feat(pos): catálogo rediseñado con chips y tarjetas con foto"
```

### Task 3: Modal de cobro

**Files:**
- Create: `src/components/ModalCobro.jsx`
- Modify: `src/components/CheckoutSidebar.jsx` (exporta `TIPOS_PAGO` sin emojis en `label` y le agrega una clave `icono`)

**Interfaces:**
- Consumes: `formatCOP`, `parseMonto`, `billetesRapidos`, `calcularCambio`, `puedeConfirmarCobro`.
- Produces: `ModalCobro({ abierto, onCerrar, total, saldoRestante, tipoPago, setTipoPago, esDomicilio, costoDomicilio, setCostoDomicilio, facturarAhorita, setFacturarAhorita, montoAbonar, setMontoAbonar, montoEntregado, setMontoEntregado, imprimirCopia, setImprimirCopia, enviarWhatsapp, setEnviarWhatsapp, isProcesando, onConfirmar })`. Si `abierto` es falso, devuelve `null`.

- [ ] **Step 1: Implement `ModalCobro`** como un overlay `role="dialog" aria-modal="true" aria-labelledby`. Contiene, en orden:
  1. Los 4 botones de `TIPOS_PAGO`, con `aria-pressed`.
  2. El interruptor "Facturar ahora", con el mismo significado que el actual `facturarAhorita`. Cuando está apagado, se muestra el campo de abono (`montoAbonar`) y el saldo restante.
  3. Si es efectivo: el campo "Recibido" (`montoEntregado`), los botones de `billetesRapidos(aPagar)` y "Cambio · $X".
  4. Si es domicilio: el campo del costo.
  5. Los interruptores "Imprimir copia" y "Enviar por WhatsApp".
  6. El botón "Confirmar cobro · $X", deshabilitado si `!puedeConfirmarCobro(...)`.

  Aquí `aPagar` es `facturarAhorita ? total : parseMonto(montoAbonar)`. Antes de implementarlo, revisa cómo se usan hoy `facturarAhorita` y `montoAbonar` en `PosPage.handleCobrar` y respeta ese significado. Esc y el botón de cerrar (`aria-label="Cerrar cobro"`) llaman `onCerrar` sin limpiar el estado. Al abrir, el foco va al primer botón de pago, y Tab y Shift+Tab quedan atrapados dentro del modal.

- [ ] **Step 2: Run `npm run lint && npm run build`.** Expected: sin errores. El modal todavía no se usa; se conecta en la Tarea 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/ModalCobro.jsx src/components/CheckoutSidebar.jsx
git commit -m "feat(pos): modal de cobro"
```

### Task 4: Panel de orden y conexión del cobro

**Files:**
- Modify: `src/components/CheckoutSidebar.jsx`
- Modify: `src/components/CartItem.jsx`
- Modify: `src/pages/PosPage.jsx` (las dos llamadas a `<CheckoutSidebar>`, cerca de las líneas 900 y 965, y el estado `cobroAbierto`)

**Interfaces:**
- Consumes: `tipoOrden`, `aplicarTipoOrden`, `formatCOP` y el `ModalCobro` de la Tarea 3.
- Produces: `CheckoutSidebar` con las props actuales más `mesas: Array<{id, numero}>` y `onAbrirCobro()`. Las props de pago, abono, efectivo, copia y WhatsApp dejan de usarse en el sidebar y pasan a `ModalCobro`.

- [ ] **Step 1: Rewrite `CartItem`** en dos líneas: el nombre y, debajo, `"{variante/tamaño} · {formatCOP(precio)}"` (usa el campo de tamaño que ya tenga el item; si no tiene, solo el precio). A la derecha, el stepper −/cantidad/+ con botones de 44px y `aria-label="Quitar uno de {nombre}"` / `"Agregar uno de {nombre}"`, y el total de la línea. Si el item tiene `item.notas`, se muestra debajo en `--text-3`. El emoji `item.imagen` se elimina.

- [ ] **Step 2: Rewrite the `CheckoutSidebar` layout** según la sección 3 de la spec:
  - Encabezado "Orden actual" con "N productos".
  - El segmentado Mesa / Para llevar / Domicilio, que usa `tipoOrden({esDomicilio, mesa})`. Al elegir un tipo, se aplica `aplicarTipoOrden` llamando `setEsDomicilio` y, si `limpiarMesa`, `setMesa('')`. Queda deshabilitado si hay `mesaInfo` o `edicionBloqueada`.
  - Si el tipo es Mesa: una cuadrícula de 4 columnas con un botón por cada mesa de `mesas`. El botón muestra `numero`, hace `setMesa(String(id))` y lleva `aria-pressed`. Se conserva el `#input-mesa` actual debajo, como alternativa. Si hay `mesaInfo`, la etiqueta actual reemplaza a la cuadrícula.
  - Si el tipo es Domicilio: `#input-costo-domicilio`.
  - Las líneas del pedido. Si no hay ninguna: "Toca un producto para elegir tamaño y agregarlo a la orden."
  - Los totales: subtotal, el interruptor "Propina sugerida 10%" (`conPropina`), domicilio y total.
  - El pie: "Enviar a cocina" (`onEnviarCocina`) y "Cobrar {formatCOP(total)}" (`onAbrirCobro`), y debajo el enlace "Cancelar orden" (`onCancelar`). Si `cajaCerrada`, se mantienen el aviso y el botón "Ir a caja" actuales en lugar de Cobrar.

  Se quitan del sidebar el select de pago, el abono, el efectivo y los checkboxes de copia y WhatsApp. El modo `isDrawer` y `onCerrar` siguen igual.

- [ ] **Step 3: Wire it in `PosPage.jsx`:**
  - Carga `getMesas()` una vez en un `useEffect` y guarda el resultado en `mesas` (si falla, queda `[]` y se usa solo el input manual).
  - Agrega `const [cobroAbierto, setCobroAbierto] = useState(false)`.
  - Pasa `mesas` y `onAbrirCobro={() => setCobroAbierto(true)}` a ambas instancias de `<CheckoutSidebar>`.
  - Renderiza `<ModalCobro>` con el estado existente y `onConfirmar={handleCobrar}`. Cierra el modal solo cuando el cobro sale bien: en `handleCobrar`, `setCobroAbierto(false)` va junto a `resetOrden()`.
  - El atajo de teclado de cobrar (cerca de la línea 593) abre el modal en lugar de cobrar directo.

- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: sin errores.

- [ ] **Step 5: Manual check** en `/pos`:
  - Pedido de mesa más "Enviar a cocina" llega al KDS.
  - En efectivo, recibido 30.000 sobre 37.000 deja el botón deshabilitado; con el billete rápido de 50.000 el cambio es 13.000.
  - Abono parcial deja el saldo correcto.
  - Domicilio con transferencia y WhatsApp.
  - Al abrir un pedido desde Mesas, el segmentado queda bloqueado.
  - Con caja cerrada aparece "Ir a caja".
  - En ancho de tablet, el cajón funciona.
  - Revisar tema claro y oscuro.

- [ ] **Step 6: Commit**

```bash
git add src/components/CheckoutSidebar.jsx src/components/CartItem.jsx src/pages/PosPage.jsx
git commit -m "feat(pos): panel de orden rediseñado y cobro en modal"
```

### Task 5: Selector de tamaño y mitades

**Files:**
- Modify: `src/components/ModalVariantes.jsx`

**Interfaces:**
- Consumes: `formatCOP`, `tonoProducto`, `segundaMitadValida`.
- Produces: la misma interfaz `ModalVariantes({ producto, onSeleccionar, onCerrar })` y la misma forma de los datos que se envían a `onSeleccionar`, para los dos casos (entera y mitades). Se conserva el cálculo actual del nombre y el precio de mitades.

- [ ] **Step 1: Replace the wizard with a single view:**
  - **Vista previa:** un SVG de 160px con un círculo. Si es entera, va completo con `tonoProducto(producto.id)`. Si es mitad y mitad, va partido en dos semicírculos, uno por sabor, y si no hay segunda mitad elegida, esa mitad queda punteada. Debajo van los nombres. El SVG lleva `role="img"` y un `aria-label`.
  - **"1 · Tamaño":** un botón por variante con tamaño y precio. Al abrir, se preselecciona la variante cuyo nombre contenga "Mediana" o, si no hay, la primera. Se conserva `PORCIONES_DESC` como subtítulo.
  - **"2 · Sabor":** solo para productos de categoría Pizzas. Es un segmentado Entera / Mitad y mitad. Con "Mitad y mitad" aparecen "Elige el sabor de la otra mitad" y la cuadrícula de `opcionesSegundaMitad`, que ya existe.
  - Al cambiar de tamaño, si `!segundaMitadValida(segunda, tamano, menuPizzeria)`, se pone `segunda = null`.
  - **Pie:** la pista "Elige la otra mitad" cuando falta, y "Agregar · {formatCOP(precio)}", deshabilitado si es mitad y mitad sin segunda.
  - Esc y el botón de cerrar llaman `onCerrar`.

- [ ] **Step 2: Run `npm test && npm run lint && npm run build`.** Expected: sin errores.

- [ ] **Step 3: Manual check:**
  - Hawaiana mediana entera se agrega con el mismo nombre y precio que antes.
  - Mitad Hawaiana y mitad Mexicana en mediana se agrega igual que antes.
  - Elegir una mitad y cambiar a un tamaño donde no existe la descarta.
  - Un jugo muestra solo el tamaño.
  - El orden de los cambios llega bien al KDS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ModalVariantes.jsx
git commit -m "feat(pos): selector de tamaño y mitades en una sola vista"
```

### Task 6: Revisión final

- [ ] **Step 1: Run `npm test && npm run lint && npm run build`.** Expected: todo en verde.
- [ ] **Step 2:** Recorre la lista de verificación de la spec completa, en tema claro y oscuro, en escritorio y en tablet. Los modales que no se rediseñaron (combo, item personalizado, QR y cuentas) deben verse bien con los colores nuevos; si alguno tiene colores fijos que choquen con el tema, se cambian a tokens.
- [ ] **Step 3: Commit** cualquier ajuste con `fix(pos): …`.
