// backend/db/fecha-helpers.js
// created_at se guarda como 'YYYY-MM-DD HH:MM:SS' (datetime('now','localtime')) —
// un formato de ancho fijo comparable como texto. Los rangos se arman como
// strings en ese mismo formato (no con date()/datetime() sobre la columna,
// para poder usar los índices existentes; ni con `new Date(str)`, que es
// frágil con zonas horarias ya que el valor guardado no trae offset).

const pad = (n) => String(n).padStart(2, '0');
const formatear = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 00:00:00`;

/** Rango [desde, hasta) para un solo día 'YYYY-MM-DD'. hasta es exclusivo. */
export function rangoDelDia(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const desde = `${fechaStr} 00:00:00`;
  const siguiente = new Date(y, m - 1, d + 1);
  return { desde, hasta: formatear(siguiente) };
}

/**
 * Resuelve { desde, hasta } a partir de query params opcionales.
 * Sin parámetros: hoy. `desde`/`hasta` esperados como 'YYYY-MM-DD'.
 */
export function resolverRango({ desde, hasta } = {}) {
  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

  if (!desde && !hasta) return rangoDelDia(hoyStr);

  const desdeStr = desde || hoyStr;
  const hastaStr = hasta || hoyStr;
  const [y, m, d] = hastaStr.split('-').map(Number);
  const siguienteAHasta = new Date(y, m - 1, d + 1);
  return { desde: `${desdeStr} 00:00:00`, hasta: formatear(siguienteAHasta) };
}
