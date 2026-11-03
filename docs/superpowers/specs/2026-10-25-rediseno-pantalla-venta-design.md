# Rediseño de la pantalla de venta — Diseño

**Fecha:** 2026-10-25
**Referencia visual:** artefacto "Don Peñolinni POS rediseño" (https://claude.ai/artifact/KKAPHv1QkNS7Q9Y3Cyxpf2)

## Objetivo

Que los dueños del local tomen y cobren un pedido con menos toques y menos lectura. La primera entrega cubre solo la pantalla de venta (`/pos`): catálogo, panel de orden y selector de tamaño/mitades.

**Criterio de éxito:** se puede tomar un pedido de mesa con una pizza mitad y mitad y cobrarlo en efectivo con cambio sin abrir selects ni escribir en campos que no sean necesarios, y todas las funciones actuales de la pantalla siguen disponibles.

## Restricciones

- El backend, la API (`src/lib/api.js`), los sockets y el formato de los pedidos no cambian.
- La lógica de `PosPage.jsx` se conserva: estado del carrito, claves de localStorage (`pos_v1_*`), creación y actualización de pedidos, edición de pedidos abiertos, bloqueo por caja cerrada, impresión del ticket y envío por WhatsApp.
- Fuera de alcance: Mesas, KDS, Inventario, Estadísticas, Hub y Login. Los modales de combo (`ModalComboBebida`), item personalizado (`ModalCustomItem`), QR (`ModalQR`) y cuentas (`ModalCuentas`) solo heredan los tokens de color nuevos; su flujo no cambia.
- Se mantiene el soporte de tema claro y oscuro existente.

## Enfoque

Reemplazar los componentes de presentación y mantener a `PosPage.jsx` como dueño del estado. Los componentes nuevos o rediseñados reciben datos y callbacks por props, como ahora. No se introducen librerías nuevas: se sigue con Tailwind 4 y variables CSS.

## 1. Estilo (tokens)

En `src/index.css`, se agregan o ajustan variables para el tema oscuro y sus equivalentes en claro:

| Token | Oscuro | Uso |
|---|---|---|
| `--bg-main` | `#121318` | Fondo de la pantalla |
| `--surface` | `#20232B` | Chips, tarjetas, campos |
| `--border` | `#2D313B` | Bordes de superficies |
| `--text-1` | `#F3F3F5` | Texto principal |
| `--text-3` | `#A4A9B6` | Texto secundario y contadores |
| `--accent` | `#F47A2A` | Acción principal, chip activo |
| `--on-accent` | `#1A0E05` | Texto sobre el acento |

Para los nombres que ya existen en `index.css` se reutiliza el nombre actual en vez de crear uno paralelo. Reglas: los objetivos táctiles miden ≥44px; el texto cumple contraste 4.5:1; los íconos de controles son SVG inline (trazo), sin emojis. Los emojis del texto de WhatsApp y del ticket se mantienen.

## 2. Catálogo (columna izquierda)

**Header** (dentro de `PosPage.jsx`): nombre del local + "Punto de venta", buscador con atajo `/` (enfoca `#input-busqueda`; se ignora si el foco está en un campo), botones "Pedidos abiertos" y "Reimprimir" (las acciones que ya existen) y la fecha y hora.

**Categorías:** una fila de chips con desplazamiento horizontal. Incluye "Todas" y las categorías de `getCategorias()`, cada una con el conteo de productos. El chip activo usa `--accent`. La búsqueda filtra sobre la categoría activa, como ahora.

**`ProductCard.jsx`:** foto en 4:3 (`object-fit: cover`), nombre (máximo 2 líneas) y "Desde $X" (precio del tamaño más barato, o precio único). Si no hay imagen, se muestra un placeholder con un tono derivado del id y el ícono de la categoría. Toda la tarjeta es un `<button>` con `aria-label="Elegir <nombre>"`. Al tocarla se mantiene el comportamiento actual: abre variantes, abre el combo o agrega directo al carrito.

Cuadrícula responsive igual a la actual (2 a 5 columnas).

## 3. Panel de orden (columna derecha)

`CheckoutSidebar.jsx` se reorganiza en una sola columna con scroll interno y pie fijo:

1. **Encabezado:** "Orden actual" y "N productos".
2. **Tipo de orden:** control segmentado Mesa / Para llevar / Domicilio. Se mapea a lo que ya existe: Domicilio corresponde a `esDomicilio=true`; Mesa corresponde a `esDomicilio=false` con `mesa` asignada; Para llevar corresponde a `esDomicilio=false` sin mesa. Si `mesaInfo` viene fijada desde Mesas, se muestra la mesa como etiqueta y el control queda deshabilitado.
3. **Campos según el tipo:**
   - Mesa: cuadrícula de botones numerados que asigna `mesa` (los números vienen de los mismos datos que usa hoy el input de mesa) y conserva el campo manual como alternativa para números fuera de la cuadrícula.
   - Para llevar: sin campos extra.
   - Domicilio: el costo de domicilio (`costoDomicilio`). Hoy el sistema no guarda teléfono, nombre ni dirección del cliente, y agregarlos requiere backend, así que quedan fuera de esta entrega.
4. **Líneas:** `CartItem.jsx` rediseñado con nombre, tamaño · precio unitario, stepper −/cantidad/+ (botones de 44px con `aria-label`) y total de la línea. Si el carrito está vacío: "Toca un producto para elegir tamaño y agregarlo a la orden."
5. **Nota para cocina:** se conservan las notas por línea que ya existen (`item.notas`), accesibles desde cada línea. La nota general del pedido que muestra el artefacto queda fuera de esta entrega, porque hoy PosPage envía la nota del pedido vacía.
6. **Totales:** subtotal, interruptor "Propina sugerida 10%" (`conPropina`), costo de domicilio cuando aplica y total grande.
7. **Pie:** "Enviar a cocina" (secundario) y "Cobrar $X" (acento, ancho completo). Debajo, "Cancelar orden" como enlace discreto con la confirmación actual. Si la caja está cerrada se muestran el aviso y el botón "Ir a caja" actuales en lugar de "Cobrar". Si la edición está bloqueada (`edicionBloqueada`), los steppers y el tipo de orden quedan deshabilitados.

En pantallas pequeñas se mantiene el modo cajón (`isDrawer`) actual, con el mismo contenido.

## 4. Modal de cobro (nuevo: `src/components/ModalCobro.jsx`)

Se abre con "Cobrar". Recibe por props el estado que hoy vive en el sidebar y ejecuta el `onCobrar` existente al confirmar.

- **Medio de pago:** cuatro botones grandes (Efectivo, Transferencia / Nequi, Débito, Crédito) que fijan `tipoPago`. Las etiquetas salen de `TIPOS_PAGO`, que se mueve a un módulo compartido o se exporta.
- **Facturar ahora o abonar:** se mantiene `facturarAhorita`. El abono parcial (`montoAbonar`) muestra el saldo restante.
- **Efectivo:** campo "Recibido" (`montoEntregado`) con botones rápidos (valor exacto y billetes redondeados hacia arriba) y "Cambio" calculado.
- **Domicilio:** muestra el costo de domicilio ingresado en el panel, que sigue siendo editable aquí.
- **Opciones:** "Imprimir copia" (`imprimirCopia`) y "Enviar por WhatsApp" (`enviarWhatsapp`) como interruptores.
- **Confirmar:** "Confirmar cobro · $X". Queda deshabilitado mientras `isProcesando` o si el efectivo recibido es menor al monto a pagar.
- Se cierra con Esc o con el botón de cerrar sin perder datos. El foco queda atrapado dentro del modal.

## 5. Selector de tamaño y mitades (`ModalVariantes.jsx`)

Una sola vista con dos pasos visibles:

- **Vista previa** arriba: círculo dividido en dos (foto o tono de cada sabor) con los nombres de los sabores. Si es pizza entera, el círculo va completo.
- **Paso 1 · Tamaño:** botones con tamaño y precio. Se preselecciona Mediana si existe; si no, el primer tamaño.
- **Paso 2 · Sabor:** segmentado Entera / Mitad y mitad. Con "Mitad y mitad" aparece "Elige el sabor de la otra mitad": una cuadrícula con las pizzas que tienen ese mismo tamaño (regla actual). Al cambiar de tamaño se descarta la segunda mitad si deja de estar disponible.
- **Pie:** una pista ("Elige la otra mitad" cuando falta) y "Agregar · $X". El precio y el nombre de la línea de mitades se calculan con la misma regla que hoy.
- Para productos que no son pizza (por ejemplo, jugos con "En agua" o "En leche"), solo aparece el paso 1.

## Manejo de errores

Sin cambios de comportamiento: los errores de `crearPedido` y `actualizarPedidoCompleto` se muestran igual que ahora; el modal de cobro sigue abierto si el cobro falla, para poder reintentar. Si no cargan las imágenes, se muestra el placeholder.

## Verificación

No hay tests de UI en el proyecto. Se verifica con:

1. `npm run lint` y `npm run build` sin errores.
2. Recorrido manual en el navegador, con el backend local:
   - Pedido de mesa con una pizza mitad y mitad más una bebida, y "Enviar a cocina".
   - Domicilio con costo, cobro en transferencia y WhatsApp.
   - Cobro en efectivo con cambio y con monto insuficiente (botón deshabilitado).
   - Abono parcial y saldo.
   - Editar un pedido abierto desde Mesas (`mesaInfo` fijada).
   - Caja cerrada.
   - Tema claro y oscuro.
   - Ancho de tablet (cajón) y escritorio.
