// backend/routes/pedidos.js
import { Router } from 'express';
import db from '../db/connection.js';
import { resolverMesaParaNuevoPedido, sincronizarEstadoMesa } from '../db/mesa-helpers.js';
import { procesarDescuentoStock, revertirDescuentoStock } from '../db/inventario-helpers.js';
import { hayCajaAbierta } from '../db/caja-helpers.js';

const router = Router();

/**
 * Helper para generar el número de orden DP-0001, DP-0002, etc.
 * En la vida real, sacar del max(id) de pedidos.
 */
function generarNumeroOrden() {
  const row = db.prepare('SELECT MAX(id) as max_id FROM pedidos').get();
  const nextId = (row.max_id || 0) + 1;
  return `DP-${nextId.toString().padStart(4, '0')}`;
}

/**
 * Inserta las líneas de un pedido. Si un ítem trae `esComboExtra: true` (la bebida
 * $0 elegida dentro de un combo), se enlaza a `combo_padre_id` = la línea insertada
 * justo antes — el frontend siempre manda [líneaCombo, líneaExtra] adyacentes.
 */
function insertarItemsDetalle(insertDetalleStmt, pedidoId, items) {
  let ultimoIdInsertado = null;
  for (const item of items) {
    // Intentamos extraer el ID real si viene como "prod_1" o "var_2"
    const prodId = typeof item.producto_id === 'string' ? parseInt(item.producto_id.replace('prod_', ''), 10) : item.producto_id;
    const varId = typeof item.variante_id === 'string' ? parseInt(item.variante_id.replace('var_', ''), 10) : item.variante_id;
    const comboPadreId = item.esComboExtra ? ultimoIdInsertado : null;

    const r = insertDetalleStmt.run(
      pedidoId,
      prodId || null,
      varId || null,
      item.nombre_display,
      item.cantidad,
      item.precio_unitario,
      item.subtotal,
      item.notas || null,
      comboPadreId
    );
    if (!item.esComboExtra) ultimoIdInsertado = r.lastInsertRowid;
  }
}

/**
 * GET /api/pedidos
 * Obtiene los pedidos. Permite filtrar por estado.
 */
router.get('/', (req, res) => {
  const { estado, mesa_id } = req.query;
  try {
    const condiciones = [];
    const params = [];
    if (estado)  { condiciones.push('p.estado = ?');  params.push(estado); }
    if (mesa_id) { condiciones.push('p.mesa_id = ?'); params.push(mesa_id); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const orden = condiciones.length ? 'ORDER BY p.created_at ASC' : 'ORDER BY p.created_at DESC LIMIT 50';

    let pedidos = db.prepare(`
      SELECT p.*, m.numero as mesa_numero, m.nombre as mesa_nombre, g.nombre as grupo_nombre
      FROM pedidos p
      LEFT JOIN mesas m ON m.id = p.mesa_id
      LEFT JOIN mesa_grupos g ON g.id = m.grupo_id
      ${where}
      ${orden}
    `).all(...params);

    // Traer los items y pagos de cada pedido
    const getItems = db.prepare('SELECT * FROM detalle_pedido WHERE pedido_id = ?');
    const getPagos = db.prepare('SELECT * FROM pagos WHERE pedido_id = ?');
    for (let p of pedidos) {
      p.items = getItems.all(p.id);
      p.pagos = getPagos.all(p.id);
      p.timestamp = p.created_at; // Alias para compatibilidad con el frontend
      // El frontend espera recibidoEn = timestamp para el timer
      p.recibidoEn = new Date(p.created_at).getTime();
    }

    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error interno al obtener pedidos' });
  }
});

/**
 * POST /api/pedidos
 * Crea un pedido y sus detalles usando una transacción SQLite.
 * Body esperado: { mesa_id, usuario_id, estado, tipo, subtotal, impuestos, total, propina, metodo_pago, items }
 * items: [{ producto_id, variante_id, nombre_display, cantidad, precio_unitario, subtotal, notas }]
 */
router.post('/', (req, res) => {
  const {
    mesa_id = null,
    usuario_id,
    estado = 'pendiente', // mesero envía 'pendiente', caja envía 'pagado'
    tipo = 'mostrador',
    subtotal,
    impuestos = 0,
    total,
    propina = 0,
    costo_domicilio = 0,
    pago_actual = 0,
    metodo_pago = 'efectivo',
    items = []
  } = req.body;

  if (!usuario_id || !items.length) {
    return res.status(400).json({ error: 'usuario_id y items son obligatorios' });
  }
  if (pago_actual > 0 && !hayCajaAbierta()) {
    return res.status(409).json({ error: 'No hay una caja abierta — ábrela antes de registrar un pago' });
  }

  const numero_orden = generarNumeroOrden();
  // Si la mesa está fusionada, el pedido nuevo se ancla en la mesa principal del grupo.
  const mesaResuelta = resolverMesaParaNuevoPedido(mesa_id);

  // Preparamos los statements para la transacción
  const insertPedido = db.prepare(`
    INSERT INTO pedidos (numero_orden, mesa_id, usuario_id, estado, tipo, subtotal, impuestos, total, propina, costo_domicilio, monto_pagado, metodo_pago)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDetalle = db.prepare(`
    INSERT INTO detalle_pedido (pedido_id, producto_id, variante_id, nombre_display, cantidad, precio_unitario, subtotal, notas, combo_padre_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Ejecutamos la transacción
  const realizarVenta = db.transaction(() => {
    // 1. Guardar el pedido
    const resPedido = insertPedido.run(
      numero_orden, mesaResuelta, usuario_id, estado, tipo,
      subtotal, impuestos, total, propina, costo_domicilio, pago_actual, metodo_pago
    );
    const pedido_id = resPedido.lastInsertRowid;

    // 1.1 Registrar el pago si hay abono
    if (pago_actual > 0) {
      db.prepare(`INSERT INTO pagos (pedido_id, monto, metodo_pago) VALUES (?, ?, ?)`).run(pedido_id, pago_actual, metodo_pago);
    }

    // 2. Guardar los items
    insertarItemsDetalle(insertDetalle, pedido_id, items);

    // La señal real de "esto se pagó" en esta app es que lo pagado cubra el total —
    // el campo `estado` sigue el flujo de cocina (pendiente→...→entregado) y en la
    // práctica casi nunca llega a 'pagado' por sí solo, así que no basta con mirarlo.
    if (estado === 'pagado' || pago_actual >= total) {
      procesarDescuentoStock(pedido_id, usuario_id);
    }

    return { pedido_id, numero_orden };
  });

  try {
    const result = realizarVenta();
    const socketServer = req.app.get('io');

    // 3. Sincronizar el estado de la mesa (y su grupo, si está fusionada) a partir
    // de todos sus pedidos activos, y avisar a todos los dispositivos conectados.
    if (mesaResuelta) sincronizarEstadoMesa(mesaResuelta, socketServer);

    // 4. Emitir evento WebSocket a la cocina (y caja para sync)
    if (socketServer) {
      const nuevoPedidoPayload = {
        id: result.pedido_id,
        numero_orden: result.numero_orden,
        mesa_id: mesaResuelta,
        estado,
        tipo,
        subtotal,
        propina,
        costo_domicilio,
        monto_pagado: pago_actual,
        total,
        items,
        timestamp: new Date().toISOString()
      };

      // Si no está pagado, probablemente deba ir a cocina
      // Incluso si está pagado (mostrador), si requiere preparación debería ir a cocina.
      // Emitimos a la sala de cocina para que preparen.
      socketServer.to('sala_cocina').emit('nuevo_pedido', nuevoPedidoPayload);

      // Emitimos a caja para actualizar estadísticas/vistas si es necesario
      socketServer.to('sala_caja').emit('nuevo_pedido', nuevoPedidoPayload);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error interno al guardar el pedido' });
  }
});
/**
 * PUT /api/pedidos/:id
 * Actualiza un pedido completo y sus detalles (usado cuando el cajero modifica o cobra un pedido existente).
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const {
    mesa_id = null,
    estado = 'pagado',
    tipo = 'mesa',
    subtotal,
    impuestos = 0,
    total,
    propina = 0,
    costo_domicilio = 0,
    pago_actual = 0,
    metodo_pago = 'efectivo',
    items = [],
    // 'editar': el mesero cambia los ítems — solo permitido si cocina no lo ha tomado aún.
    // 'cobrar' (o sin especificar): registrar pago / avanzar estado — sin ese candado.
    modo = 'cobrar',
  } = req.body;

  if (!items.length) {
    return res.status(400).json({ error: 'items es obligatorio' });
  }
  if (pago_actual > 0 && !hayCajaAbierta()) {
    return res.status(409).json({ error: 'No hay una caja abierta — ábrela antes de registrar un pago' });
  }

  const pedidoActual = db.prepare('SELECT estado, mesa_id, total, monto_pagado FROM pedidos WHERE id = ?').get(id);
  if (!pedidoActual) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  if (modo === 'editar' && pedidoActual.estado !== 'pendiente') {
    return res.status(409).json({ error: 'Cocina ya tomó este pedido — no se puede modificar, agrega un pedido adicional a la mesa' });
  }

  const updatePedido = db.prepare(`
    UPDATE pedidos
    SET mesa_id = ?, estado = ?, tipo = ?, subtotal = ?, impuestos = ?, total = ?, propina = ?, costo_domicilio = ?, monto_pagado = monto_pagado + ?, metodo_pago = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `);

  const deleteDetalles = db.prepare(`DELETE FROM detalle_pedido WHERE pedido_id = ?`);

  const insertDetalle = db.prepare(`
    INSERT INTO detalle_pedido (pedido_id, producto_id, variante_id, nombre_display, cantidad, precio_unitario, subtotal, notas, combo_padre_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const actualizarPedido = db.transaction(() => {
    updatePedido.run(mesa_id, estado, tipo, subtotal, impuestos, total, propina, costo_domicilio, pago_actual, metodo_pago, id);

    if (pago_actual > 0) {
      db.prepare(`INSERT INTO pagos (pedido_id, monto, metodo_pago) VALUES (?, ?, ?)`).run(id, pago_actual, metodo_pago);
    }

    deleteDetalles.run(id);
    insertarItemsDetalle(insertDetalle, id, items);

    // Descuenta stock UNA sola vez, en la transición que realmente marca el pago.
    // La señal real de "esto se pagó" es que lo pagado cubra el total — `estado`
    // sigue el flujo de cocina y en la práctica casi nunca llega a 'pagado' por sí
    // solo (se paga sin que eso cambie si el pedido va o no a cocina), así que se
    // compara el saldo antes/después para no volver a descontar en un reimpreso.
    const estabaCompleto = pedidoActual.monto_pagado >= pedidoActual.total;
    const quedaCompleto = (pedidoActual.monto_pagado + pago_actual) >= total;
    if ((!estabaCompleto && quedaCompleto) || (pedidoActual.estado !== 'pagado' && estado === 'pagado')) {
      procesarDescuentoStock(id, req.body.usuario_id || null);
    } else if ((estabaCompleto || pedidoActual.estado === 'pagado') && estado === 'cancelado') {
      revertirDescuentoStock(id, req.body.usuario_id || null);
    }

    const row = db.prepare('SELECT numero_orden FROM pedidos WHERE id = ?').get(id);
    return row ? row.numero_orden : `DP-${id}`;
  });

  try {
    const numero_orden = actualizarPedido();
    const socketServer = req.app.get('io');

    // Sincronizar mesa (y grupo, si aplica) a partir del estado real de todos sus pedidos.
    // Cubre tanto la mesa nueva como la anterior, por si el pedido se reasignó de mesa.
    if (mesa_id) sincronizarEstadoMesa(mesa_id, socketServer);
    if (pedidoActual.mesa_id && pedidoActual.mesa_id !== mesa_id) {
      sincronizarEstadoMesa(pedidoActual.mesa_id, socketServer);
    }

    if (socketServer) {
      // Necesitamos emitir el monto pagado actualizado. Lo consultamos:
      const pData = db.prepare('SELECT monto_pagado FROM pedidos WHERE id = ?').get(id);
      const payload = { id: parseInt(id, 10), numero_orden, mesa_id, estado, tipo, subtotal, propina, costo_domicilio, monto_pagado: pData?.monto_pagado || 0, total, items };
      // Notificar a todos que el pedido se actualizó
      socketServer.emit('pedido_actualizado', payload);
    }

    res.json({ message: 'Pedido actualizado', id, numero_orden });
  } catch (error) {
    console.error('Error al actualizar pedido completo:', error);
    res.status(500).json({ error: 'Error interno al actualizar pedido' });
  }
});
/**
 * PATCH /api/pedidos/:id/estado
 * Actualiza el estado de un pedido (ej: pendiente -> en_preparacion -> listo -> entregado)
 */
router.patch('/:id/estado', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) return res.status(400).json({ error: 'Estado es requerido' });

  try {
    const pedido = db.prepare('SELECT mesa_id, estado, total, monto_pagado FROM pedidos WHERE id = ?').get(id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Este endpoint no toca pagos — solo cubre el caso de cancelar algo que ya
    // estaba totalmente pagado (revierte) o un 'pagado' puesto a mano (descuenta).
    const yaEstabaPagado = pedido.monto_pagado >= pedido.total || pedido.estado === 'pagado';

    const actualizar = db.transaction(() => {
      db.prepare('UPDATE pedidos SET estado = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(estado, id);
      if (pedido.estado !== 'pagado' && estado === 'pagado') {
        procesarDescuentoStock(id, req.body.usuario_id || null);
      } else if (yaEstabaPagado && estado === 'cancelado') {
        revertirDescuentoStock(id, req.body.usuario_id || null);
      }
    });
    actualizar();

    const socketServer = req.app.get('io');

    // El KDS es el flujo que más cambia el estado de un pedido (pendiente → en_preparacion →
    // listo → entregado) y antes nunca reflejaba ese avance en el estado de la mesa.
    if (pedido.mesa_id) sincronizarEstadoMesa(pedido.mesa_id, socketServer);

    if (socketServer) {
      socketServer.emit('pedido_actualizado', { id: parseInt(id, 10), estado });
    }

    res.json({ message: 'Estado actualizado correctamente', id, estado });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error interno al actualizar estado' });
  }
});

export default router;
