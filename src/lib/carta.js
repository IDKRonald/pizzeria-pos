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

/** Listas de tamaños que ya existen en la carta, para copiar sus nombres: una por lista distinta. */
export function listasDeTamanos(productos, categorias) {
  const vistas = new Set();
  const listas = [];
  for (const c of categorias) {
    const tamanos = tamanosSugeridos(productos, c.id);
    const clave = tamanos.join('|');
    if (!tamanos.length || vistas.has(clave)) continue;
    vistas.add(clave);
    listas.push({ categoriaId: c.id, nombre: c.nombre, tamanos });
  }
  return listas;
}

/** Revisa las filas de tamaños ({ nombre, precio }). Devuelve el mensaje de error o null. */
export function validarTamanos(filas) {
  if (!filas.length) return 'Agrega al menos un tamaño';
  const vistos = new Set();
  for (const f of filas) {
    const nombre = normalizar(f.nombre).trim();
    if (!nombre) return 'Cada tamaño necesita un nombre';
    if (vistos.has(nombre)) return `El tamaño "${String(f.nombre).trim()}" está repetido`;
    vistos.add(nombre);
    if (!(parsePrecio(f.precio) > 0)) return `Falta el precio de "${String(f.nombre).trim()}"`;
  }
  return null;
}

export function tamanosSugeridos(productos, categoriaId) {
  // La lista más común de la categoría: un producto mal ubicado no debe definir sus tamaños.
  const conteo = new Map();
  for (const p of productos) {
    if (p.categoria_id !== categoriaId || !p.tiene_variantes || !(p.variantes || []).length) continue;
    const tamanos = p.variantes.map((v) => v.nombre_tamanio);
    const clave = tamanos.join('|');
    const actual = conteo.get(clave);
    if (actual) actual.veces += 1;
    else conteo.set(clave, { tamanos, veces: 1 });
  }
  let mejor = null;
  for (const c of conteo.values()) if (!mejor || c.veces > mejor.veces) mejor = c;
  return mejor ? mejor.tamanos : [];
}

/** Eliminación diferida con opción de deshacer; `ejecutar` corre una sola vez al vencer. */
export function programarEliminacion({ ejecutar, ms = 6000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, onError = () => {} }) {
  let activo = true;
  const id = setTimeoutFn(() => {
    if (!activo) return;
    activo = false;
    new Promise((res) => res(ejecutar())).catch(onError);
  }, ms);
  const cancelar = () => {
    activo = false;
    clearTimeoutFn(id);
  };
  return { deshacer: cancelar, cancelarSinEjecutar: cancelar };
}
