// backend/db/inventario-helpers.js
// Descuento (y reversión) automático de stock cuando un pedido se paga.
// Solo afecta insumos en modo_descuento='automatico' — los insumos 'manual'
// (ingredientes servidos a mano) nunca se tocan desde aquí.

import db from './connection.js';

const buscarRecetaPorVariante = db.prepare(`
  SELECT r.insumo_id, r.cantidad, i.precio_compra
  FROM recetas r
  JOIN insumos i ON i.id = r.insumo_id
  WHERE r.producto_id = ? AND r.variante_id = ? AND i.modo_descuento = 'automatico'
`);

const buscarRecetaPorProducto = db.prepare(`
  SELECT r.insumo_id, r.cantidad, i.precio_compra
  FROM recetas r
  JOIN insumos i ON i.id = r.insumo_id
  WHERE r.producto_id = ? AND r.variante_id IS NULL AND i.modo_descuento = 'automatico'
`);

const buscarProductoDeVariante = db.prepare('SELECT producto_id FROM producto_variantes WHERE id = ?');

/**
 * Resuelve producto_id cuando un ítem solo trae variante_id (ver comentario en
 * procesarDescuentoStock) y devuelve las recetas automáticas que aplican —
 * reutilizado por estadísticas para calcular el costo de lo vendido.
 */
export function resolverRecetaAutomatica(productoId, varianteId) {
  let pid = productoId;
  if (!pid && varianteId) {
    pid = buscarProductoDeVariante.get(varianteId)?.producto_id ?? null;
  }
  if (!pid) return [];
  return varianteId ? buscarRecetaPorVariante.all(pid, varianteId) : buscarRecetaPorProducto.all(pid);
}
const getStockActual = db.prepare('SELECT stock_actual FROM insumos WHERE id = ?');
const updateStock = db.prepare('UPDATE insumos SET stock_actual = ? WHERE id = ?');
const insertMovimiento = db.prepare(`
  INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, stock_resultante, pedido_id, usuario_id, notas)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Calcula, por cada línea vendida de un pedido, cuánto insumo automático consume
 * (sumando líneas que compartan insumo) y aplica el descuento + registra el movimiento.
 * Debe llamarse UNA SOLA VEZ, justo cuando un pedido pasa a estado 'pagado' —
 * el llamador es responsable de esa comparación antes/después (ver pedidos.js).
 */
export function procesarDescuentoStock(pedidoId, usuarioId) {
  const items = db.prepare('SELECT producto_id, variante_id, cantidad FROM detalle_pedido WHERE pedido_id = ?').all(pedidoId);

  const deltaPorInsumo = new Map(); // insumo_id -> cantidad total a descontar
  for (const item of items) {
    // En detalle_pedido, un ítem con tamaño (pizza, adición) solo guarda variante_id
    // — producto_id queda NULL. Hay que resolverlo desde la variante para poder
    // buscar la receta (que sí se define por producto_id + variante_id).
    let productoId = item.producto_id;
    if (!productoId && item.variante_id) {
      productoId = buscarProductoDeVariante.get(item.variante_id)?.producto_id ?? null;
    }
    if (!productoId) continue; // ítems personalizados sin producto real: no hay receta posible
    const recetas = item.variante_id
      ? buscarRecetaPorVariante.all(productoId, item.variante_id)
      : buscarRecetaPorProducto.all(productoId);
    for (const receta of recetas) {
      const consumo = receta.cantidad * item.cantidad;
      deltaPorInsumo.set(receta.insumo_id, (deltaPorInsumo.get(receta.insumo_id) || 0) + consumo);
    }
  }

  for (const [insumo_id, cantidadConsumida] of deltaPorInsumo) {
    const insumo = getStockActual.get(insumo_id);
    if (!insumo) continue; // insumo fue borrado entre tanto — no debería pasar (recetas se borran en cascada)
    const nuevoStock = insumo.stock_actual - cantidadConsumida;
    updateStock.run(nuevoStock, insumo_id);
    insertMovimiento.run(insumo_id, 'venta', -cantidadConsumida, nuevoStock, pedidoId, usuarioId, null);
  }
}

/**
 * Revierte el descuento de un pedido que fue pagado y luego se cancela:
 * deshace exactamente los movimientos tipo='venta' que ese pedido generó.
 */
export function revertirDescuentoStock(pedidoId, usuarioId) {
  const movimientos = db.prepare(`
    SELECT insumo_id, cantidad FROM movimientos_inventario WHERE pedido_id = ? AND tipo = 'venta'
  `).all(pedidoId);

  for (const mov of movimientos) {
    const insumo = getStockActual.get(mov.insumo_id);
    if (!insumo) continue;
    const devolver = -mov.cantidad; // mov.cantidad ya es negativo (salida), así que -mov.cantidad es positivo
    const nuevoStock = insumo.stock_actual + devolver;
    updateStock.run(nuevoStock, mov.insumo_id);
    insertMovimiento.run(mov.insumo_id, 'reversion', devolver, nuevoStock, pedidoId, usuarioId, 'Pedido cancelado tras estar pagado');
  }
}
