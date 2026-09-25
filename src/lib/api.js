// src/lib/api.js
// Helper para llamadas al backend API

// Detectar la URL base del backend:
// - En desarrollo: mismo host que Vite, puerto 3001
// - En producción / red local: inferir del hostname actual
const API_BASE = (() => {
  const host = window.location.hostname; // localhost o 192.168.x.x
  return `http://${host}:3001/api`;
})();

/**
 * Fetch genérico al API con manejo de errores
 */
async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(body.error || `Error ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

// ── Endpoints específicos ────────────────────────────────────

/** Login por PIN de 4 dígitos → { id, nombre, rol } */
export function loginPIN(pin) {
  return fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

/** Lista todos los productos activos con variantes */
export function getProductos() {
  return fetchApi('/productos');
}

/** Lista categorías ordenadas */
export function getCategorias() {
  return fetchApi('/categorias');
}

/** Crea una categoría (admin) */
export function crearCategoria(categoria, usuarioId) {
  return fetchApi('/categorias', { method: 'POST', body: JSON.stringify({ ...categoria, usuario_id: usuarioId }) });
}

/** Edita una categoría (admin) */
export function actualizarCategoria(id, cambios, usuarioId) {
  return fetchApi(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify({ ...cambios, usuario_id: usuarioId }) });
}

/** Elimina una categoría sin productos (admin) */
export function eliminarCategoria(id, usuarioId) {
  return fetchApi(`/categorias/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

/** Lista TODOS los productos (activos e inactivos) con datos crudos, para el editor de carta */
export function getProductosAdmin() {
  return fetchApi('/productos/admin/todos');
}

/** Crea un producto, simple o con tamaños (admin) */
export function crearProducto(producto, usuarioId) {
  return fetchApi('/productos', { method: 'POST', body: JSON.stringify({ ...producto, usuario_id: usuarioId }) });
}

/** Edita datos base de un producto — el precio de uno con tamaños se edita por variante (admin) */
export function actualizarProducto(id, cambios, usuarioId) {
  return fetchApi(`/productos/${id}`, { method: 'PUT', body: JSON.stringify({ ...cambios, usuario_id: usuarioId }) });
}

/** Elimina un producto sin historial de ventas (admin) */
export function eliminarProducto(id, usuarioId) {
  return fetchApi(`/productos/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

/** Agrega un tamaño/variante a un producto (admin) */
export function crearVariante(productoId, variante, usuarioId) {
  return fetchApi(`/productos/${productoId}/variantes`, { method: 'POST', body: JSON.stringify({ ...variante, usuario_id: usuarioId }) });
}

/** Edita nombre/precio de una variante (admin) */
export function actualizarVariante(id, cambios, usuarioId) {
  return fetchApi(`/variantes/${id}`, { method: 'PUT', body: JSON.stringify({ ...cambios, usuario_id: usuarioId }) });
}

/** Elimina una variante sin historial de ventas (admin) */
export function eliminarVariante(id, usuarioId) {
  return fetchApi(`/variantes/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

/**
 * Sube una imagen de producto al servidor.
 * @param {File} archivo - El archivo de imagen a subir.
 * @returns {Promise<{ url: string }>} - URL pública del archivo subido, ej. "/uploads/123.jpg"
 */
export async function subirImagenProducto(archivo) {
  const formData = new FormData();
  formData.append('imagen', archivo);
  const res = await fetch(`${API_BASE}/uploads/imagen`, {
    method: 'POST',
    body: formData,
    // NO incluir Content-Type aquí; el browser lo pone con el boundary correcto
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status} al subir imagen`);
  }
  return res.json(); // { url: "/uploads/<filename>" }
}

/** Sugerencia de compra: insumos en mínimo, agrupados por proveedor, con cantidad hasta el máximo */
export function getSugerenciaCompra() {
  return fetchApi('/inventario/sugerencia-compra');
}

/**
 * Crea un pedido en la base de datos
 * @param {Object} pedido - { mesa_id, usuario_id, estado, tipo, items, total, ... }
 */
export function crearPedido(pedido) {
  return fetchApi('/pedidos', {
    method: 'POST',
    body: JSON.stringify(pedido),
  });
}

/**
 * Actualiza un pedido completo (al modificar o cobrar)
 */
export function actualizarPedidoCompleto(id, pedido) {
  return fetchApi(`/pedidos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(pedido),
  });
}

/**
 * Obtiene los pedidos recientes
 */
export function getPedidosPendientes() {
  return fetchApi('/pedidos');
}

/**
 * Actualiza el estado de un pedido
 */
export function actualizarEstadoPedido(id, estado) {
  return fetchApi(`/pedidos/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
}

// ── Mesas / diagrama del salón ───────────────────────────────

/** Lista todas las mesas con info de grupo (fusión) y pedidos activos */
export function getMesas() {
  return fetchApi('/mesas');
}

/** Historial de pedidos de una mesa (o de todo su grupo si está fusionada) */
export function getPedidosDeMesa(mesaId) {
  return fetchApi(`/mesas/${mesaId}/pedidos`);
}

/** Crea una mesa nueva en el diagrama (admin) */
export function crearMesa(mesa, usuarioId) {
  return fetchApi('/mesas', {
    method: 'POST',
    body: JSON.stringify({ ...mesa, usuario_id: usuarioId }),
  });
}

/** Mueve / renombra / cambia capacidad de una mesa (admin) */
export function actualizarMesa(id, cambios, usuarioId) {
  return fetchApi(`/mesas/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...cambios, usuario_id: usuarioId }),
  });
}

/** Elimina una mesa sin historial de pedidos (admin) */
export function eliminarMesa(id, usuarioId) {
  return fetchApi(`/mesas/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

/** Libera manualmente el estado de una mesa trabada (admin) */
export function liberarMesa(id, usuarioId) {
  return fetchApi(`/mesas/${id}/liberar`, {
    method: 'PATCH',
    body: JSON.stringify({ usuario_id: usuarioId }),
  });
}

/** Fusiona 2+ mesas en un solo grupo/cuenta compartida (admin) */
export function fusionarMesas(mesaIds, usuarioId, nombre) {
  return fetchApi('/mesas/merge', {
    method: 'POST',
    body: JSON.stringify({ mesa_ids: mesaIds, usuario_id: usuarioId, nombre }),
  });
}

/** Separa un grupo de mesas fusionadas (admin) */
export function separarMesas(grupoId, usuarioId) {
  return fetchApi(`/mesas/grupos/${grupoId}/unmerge`, {
    method: 'POST',
    body: JSON.stringify({ usuario_id: usuarioId }),
  });
}

// ── Inventario: insumos, movimientos, proveedores, recetas ───

/** Lista insumos, con filtros opcionales { proveedor_id, modo_descuento, bajo_stock, activo } */
export function getInsumos(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/inventario/insumos${qs ? `?${qs}` : ''}`);
}

/** Crea un insumo (admin) */
export function crearInsumo(insumo, usuarioId) {
  return fetchApi('/inventario/insumos', {
    method: 'POST',
    body: JSON.stringify({ ...insumo, usuario_id: usuarioId }),
  });
}

/** Edita datos de un insumo, NUNCA su stock_actual directamente (admin) */
export function actualizarInsumo(id, cambios, usuarioId) {
  return fetchApi(`/inventario/insumos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...cambios, usuario_id: usuarioId }),
  });
}

/** Elimina un insumo sin recetas ni movimientos asociados (admin) */
export function eliminarInsumo(id, usuarioId) {
  return fetchApi(`/inventario/insumos/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

/** Ajuste manual de stock: delta puede ser negativo o positivo (admin) */
export function ajustarStockInsumo(id, delta, motivo, usuarioId) {
  return fetchApi(`/inventario/insumos/${id}/ajuste`, {
    method: 'POST',
    body: JSON.stringify({ delta, motivo, usuario_id: usuarioId }),
  });
}

/** Historial de movimientos, con filtros opcionales { insumo_id, tipo, desde, hasta } */
export function getMovimientos(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/inventario/movimientos${qs ? `?${qs}` : ''}`);
}

/** Importación inicial masiva desde Excel: filas ya parseadas en el navegador (admin) */
export function importarInsumos(filas, usuarioId) {
  return fetchApi('/inventario/importar', {
    method: 'POST',
    body: JSON.stringify({ filas, usuario_id: usuarioId }),
  });
}

/** Lista proveedores */
export function getProveedores() {
  return fetchApi('/inventario/proveedores');
}

/** Crea un proveedor (admin) */
export function crearProveedor(proveedor, usuarioId) {
  return fetchApi('/inventario/proveedores', {
    method: 'POST',
    body: JSON.stringify({ ...proveedor, usuario_id: usuarioId }),
  });
}

/** Edita un proveedor (admin) */
export function actualizarProveedor(id, cambios, usuarioId) {
  return fetchApi(`/inventario/proveedores/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...cambios, usuario_id: usuarioId }),
  });
}

/** Elimina un proveedor sin insumos asignados (admin) */
export function eliminarProveedor(id, usuarioId) {
  return fetchApi(`/inventario/proveedores/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

/** Lista recetas, con filtros opcionales { producto_id, variante_id, insumo_id } */
export function getRecetas(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/inventario/recetas${qs ? `?${qs}` : ''}`);
}

/** Crea una receta: { producto_id, variante_id, insumo_id, cantidad } (admin) */
export function crearReceta(receta, usuarioId) {
  return fetchApi('/inventario/recetas', {
    method: 'POST',
    body: JSON.stringify({ ...receta, usuario_id: usuarioId }),
  });
}

/** Elimina una receta (admin) */
export function eliminarReceta(id, usuarioId) {
  return fetchApi(`/inventario/recetas/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

// ── Combos ───────────────────────────────────────────────────

/** Lista combos configurados */
export function getCombos() {
  return fetchApi('/combos');
}

/** Marca un producto existente como combo: { producto_id, categoria_opciones_id, nombre_slot } (admin) */
export function crearCombo(combo, usuarioId) {
  return fetchApi('/combos', {
    method: 'POST',
    body: JSON.stringify({ ...combo, usuario_id: usuarioId }),
  });
}

/** Edita la configuración de un combo (admin) */
export function actualizarCombo(id, cambios, usuarioId) {
  return fetchApi(`/combos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...cambios, usuario_id: usuarioId }),
  });
}

/** Quita la configuración de combo de un producto (admin) */
export function eliminarCombo(id, usuarioId) {
  return fetchApi(`/combos/${id}?usuario_id=${usuarioId}`, { method: 'DELETE' });
}

// ── Caja ─────────────────────────────────────────────────────

/** Caja abierta actual (o null) + totales en vivo desde que abrió */
export function getCajaActual() {
  return fetchApi('/caja/actual');
}

/** Abre caja: { monto_inicial, notas } (admin/cajero) */
export function abrirCaja(datos, usuarioId) {
  return fetchApi('/caja/abrir', { method: 'POST', body: JSON.stringify({ ...datos, usuario_id: usuarioId }) });
}

/** Cierra caja: { monto_final, notas } (admin/cajero) */
export function cerrarCaja(id, datos, usuarioId) {
  return fetchApi(`/caja/${id}/cerrar`, { method: 'POST', body: JSON.stringify({ ...datos, usuario_id: usuarioId }) });
}

/** Historial de cajas cerradas, con filtros opcionales { desde, hasta, limite } */
export function getCajaHistorial(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/caja/historial${qs ? `?${qs}` : ''}`);
}

// ── Estadísticas ─────────────────────────────────────────────

/** Ventas totales por período { desde, hasta } (YYYY-MM-DD) */
export function getEstadisticasVentas(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/estadisticas/ventas${qs ? `?${qs}` : ''}`);
}

/** Ranking de productos más vendidos { desde, hasta, limite } */
export function getProductosMasVendidos(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/estadisticas/productos-mas-vendidos${qs ? `?${qs}` : ''}`);
}

/** Rentabilidad por producto según costo de insumos automáticos { desde, hasta } */
export function getRentabilidad(filtros = {}) {
  const qs = new URLSearchParams(filtros).toString();
  return fetchApi(`/estadisticas/rentabilidad${qs ? `?${qs}` : ''}`);
}

/** IPs de red local de este PC + puerto, para armar el QR de "conectar dispositivo" */
export function getRedLocal() {
  return fetchApi('/red-local');
}

// ── Admin: mantenimiento ─────────────────────────────────────

/** Borra todo el historial de pedidos/caja/movimientos de prueba (admin). No toca carta ni insumos configurados. */
export function resetearDatosPrueba({ revertir_stock = true } = {}, usuarioId) {
  return fetchApi('/admin/reset-datos-prueba', {
    method: 'POST',
    body: JSON.stringify({ revertir_stock, confirmar: 'BORRAR', usuario_id: usuarioId }),
  });
}

export { API_BASE };
export default fetchApi;
