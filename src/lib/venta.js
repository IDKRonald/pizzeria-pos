/* Lógica pura de la pantalla de venta (sin React, fácil de probar). */

const _cop = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
});

/** Formatea un número como pesos colombianos. */
export const formatCOP = (n) => _cop.format(n);

/** Texto de un campo de dinero con separador de miles: '1500000' → '1.500.000'; vacío queda vacío. */
export const miles = (v) => {
  const digitos = String(v ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos).toLocaleString('es-CO') : '';
};

/** Igual que `miles` pero admite hasta 2 decimales con coma: '12345,5' → '12.345,5'. */
export const milesConDecimales = (v) => {
  const [entero, ...resto] = String(v ?? '').replace(/[^\d,]/g, '').split(',');
  const base = miles(entero) || (resto.length ? '0' : '');
  return resto.length ? `${base},${resto.join('').slice(0, 2)}` : base;
};

/** Número desde un texto con separador de miles y coma decimal: '12.345,5' → 12345.5. */
export const numeroDesdeMiles = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0;

/** Extrae solo los dígitos; sin dígitos devuelve 0. */
export const parseMonto = (v) => {
  const digitos = String(v ?? '').replace(/\D/g, '');
  return digitos ? Number(digitos) : 0;
};

/** Deduce el tipo de orden a partir del estado del formulario. */
export const tipoOrden = ({ esDomicilio, mesa }) => {
  if (esDomicilio) return 'domicilio';
  return mesa ? 'mesa' : 'llevar';
};

/** Traduce un tipo de orden a los cambios de estado necesarios. */
export const aplicarTipoOrden = (tipo) => ({
  esDomicilio: tipo === 'domicilio',
  limpiarMesa: tipo !== 'mesa',
});

/** Precio mínimo de un producto (variantes) o su precio fijo. */
export const precioDesde = (producto) => {
  if (producto.variantes?.length) {
    return Math.min(...producto.variantes.map((v) => v.precio));
  }
  return producto.precio;
};

/** Color de fondo estable derivado del id del producto. `luz` admite var(--tono-l) para seguir el tema. */
export const tonoProducto = (id, luz = '22%') => {
  const hash = [...String(id)].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `hsl(${hash % 360}, 22%, ${luz})`;
};

/** Montos sugeridos de pago en efectivo, sin repetidos y ordenados. */
export const billetesRapidos = (monto) => {
  const techo = (base) => Math.ceil(monto / base) * base;
  const lista = [monto, techo(10000), techo(50000)];
  if (monto < 100000) lista.push(100000);
  return [...new Set(lista)].filter((v) => v >= monto).sort((a, b) => a - b);
};

/** Cambio a devolver (nunca negativo). */
export const calcularCambio = (recibido, aPagar) => Math.max(0, recibido - aPagar);

/** Indica si el cobro se puede confirmar. */
export const puedeConfirmarCobro = ({ tipoPago, recibido, aPagar, isProcesando }) => {
  if (isProcesando || !(aPagar > 0)) return false;
  if (tipoPago === 'efectivo') return recibido >= aPagar;
  return true;
};

/** La segunda mitad debe ser una pizza del menú con el tamaño elegido. */
export const segundaMitadValida = (segunda, tamano, menu) => {
  if (!segunda) return false;
  const id = typeof segunda === 'object' ? segunda.id : segunda;
  const pizza = menu.find((p) => p.categoria === 'Pizzas' && p.id === id);
  return !!pizza?.variantes?.some((v) => v.nombreTamanio === tamano);
};

/** La tecla "/" enfoca la búsqueda salvo que se esté escribiendo. */
export const debeEnfocarBusqueda = ({ key, target }) => {
  if (key !== '/') return false;
  if (target?.isContentEditable) return false;
  return !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
};
