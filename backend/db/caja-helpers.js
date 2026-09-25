// backend/db/caja-helpers.js
// Lógica compartida de caja: si hay una abierta, y los totales de un período
// de tiempo a partir de la tabla `pagos` (fuente de verdad de cada cobro real,
// a diferencia de pedidos.metodo_pago que es un solo valor por pedido aunque
// el pedido se haya pagado en varias partes con métodos distintos).

import db from './connection.js';

/** ¿Hay una caja abierta ahora mismo? */
export function hayCajaAbierta() {
  return !!db.prepare(`SELECT id FROM cierres_caja WHERE fecha_cierre IS NULL`).get();
}

/** La caja abierta actual (con el nombre de quién la abrió), o null si no hay ninguna. */
export function obtenerCajaAbierta() {
  return db.prepare(`
    SELECT c.*, u.nombre as usuario_nombre
    FROM cierres_caja c
    JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.fecha_cierre IS NULL
  `).get() || null;
}

/**
 * Totales de pagos reales entre [desde, hasta) — excluye pedidos cancelados.
 * Se usa tanto para el resumen en vivo (GET /caja/actual) como para el cierre
 * final, con la misma lógica exacta en ambos casos.
 */
export function calcularTotalesPeriodo(desde, hasta) {
  const filas = db.prepare(`
    SELECT p.metodo_pago, SUM(p.monto) as total, COUNT(*) as cantidad
    FROM pagos p
    JOIN pedidos ped ON ped.id = p.pedido_id
    WHERE ped.estado != 'cancelado' AND p.created_at >= ? AND p.created_at < ?
    GROUP BY p.metodo_pago
  `).all(desde, hasta);

  const totales = {
    total_efectivo: 0, total_transferencia: 0, total_tarjeta_debito: 0,
    total_tarjeta_credito: 0, total_otros: 0, total_general: 0, cantidad_pagos: 0,
  };
  for (const f of filas) {
    totales.total_general += f.total;
    totales.cantidad_pagos += f.cantidad;
    if (f.metodo_pago === 'efectivo') totales.total_efectivo += f.total;
    else if (f.metodo_pago === 'transferencia') totales.total_transferencia += f.total;
    else if (f.metodo_pago === 'tarjeta_debito') totales.total_tarjeta_debito += f.total;
    else if (f.metodo_pago === 'tarjeta_credito') totales.total_tarjeta_credito += f.total;
    else totales.total_otros += f.total;
  }
  return totales;
}
