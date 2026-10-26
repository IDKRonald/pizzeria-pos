// Lógica pura de la administración de la carta.

const MAX_FOTO = 5 * 1024 * 1024;

/** ¿La imagen es una foto (y no un emoji)? */
export function tieneFoto(imagen) {
  return typeof imagen === 'string' && (imagen.startsWith('/uploads/') || imagen.startsWith('http'));
}

export function urlImagen(imagen, host = (typeof location !== 'undefined' ? location.hostname : 'localhost')) {
  if (typeof imagen === 'string' && imagen.startsWith('/uploads/')) return `http://${host}:3001${imagen}`;
  return imagen;
}

/** Solo dígitos; sin dígitos devuelve null. */
export function parsePrecio(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  return d === '' ? null : Number(d);
}

export function formatoMiles(n) {
  return new Intl.NumberFormat('es-CO').format(n);
}

/** Mensaje de error o null si la foto es válida. */
export function validarFoto(file) {
  if (!file || !String(file.type || '').startsWith('image/')) return 'Elige un archivo de imagen';
  if (file.size > MAX_FOTO) return 'La foto debe pesar menos de 5 MB';
  return null;
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function filtrarProductos(productos, { categoriaId, texto, soloSinFoto }) {
  const q = normalizar(texto).trim();
  return productos.filter((p) => {
    if (categoriaId != null && p.categoria_id !== categoriaId) return false;
    if (q && !normalizar(p.nombre).includes(q)) return false;
    if (soloSinFoto && tieneFoto(p.imagen)) return false;
    return true;
  });
}

export function contarPorCategoria(productos) {
  const r = {};
  for (const p of productos) r[p.categoria_id] = (r[p.categoria_id] || 0) + 1;
  return r;
}

/** Reasigna 1..N por (orden, id); devuelve solo las que cambian. */
export function normalizarOrden(categorias) {
  return [...categorias]
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .map((c, i) => ({ id: c.id, orden: i + 1, previo: c.orden }))
    .filter((c) => c.orden !== c.previo)
    .map(({ id, orden }) => ({ id, orden }));
}

/** Las dos actualizaciones para mover un lugar, o null en los extremos. */
export function intercambiarOrden(categorias, indice, dir) {
  const a = categorias[indice];
  const b = categorias[indice + dir];
  if (!a || !b) return null;
  return [{ id: a.id, orden: b.orden }, { id: b.id, orden: a.orden }];
}

export function tamanosSugeridos(productos, categoriaId) {
  const p = productos.find((x) => x.categoria_id === categoriaId && x.tiene_variantes && (x.variantes || []).length > 0);
  return p ? (p.variantes || []).map((v) => v.nombre_tamanio) : [];
}
