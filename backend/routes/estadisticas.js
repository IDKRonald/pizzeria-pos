// backend/routes/estadisticas.js
import { Router } from 'express';
import db from '../db/connection.js';
import { calcularTotalesPeriodo } from '../db/caja-helpers.js';
import { resolverRango } from '../db/fecha-helpers.js';
import { resolverRecetaAutomatica } from '../db/inventario-helpers.js';

const router = Router();

/** GET /api/estadisticas/ventas?desde=&hasta= */
router.get('/ventas', (req, res) => {
  try {
    const { desde, hasta } = resolverRango(req.query);
    const totales = calcularTotalesPeriodo(desde, hasta);
    res.json({ desde, hasta, ...totales });
  } catch (error) {
    console.error('Error al calcular ventas:', error);
    res.status(500).json({ error: 'Error interno al calcular ventas' });
  }
});

const POR_PAGINA = 20;

/**
 * GET /api/estadisticas/pedidos?desde=&hasta=&tipo=&metodo=&estado_pago=&pagina=
 * Solo los campos de la lista; el detalle de cada pedido se pide aparte.
 */
router.get('/pedidos', (req, res) => {
  try {
    const { desde, hasta } = resolverRango(req.query);
    const cond = ['p.created_at >= ?', 'p.created_at < ?'];
    const params = [desde, hasta];
    if (['mesa', 'mostrador', 'domicilio'].includes(req.query.tipo)) { cond.push('p.tipo = ?'); params.push(req.query.tipo); }
    if (req.query.metodo) { cond.push('EXISTS (SELECT 1 FROM pagos pg WHERE pg.pedido_id = p.id AND pg.metodo_pago = ?)'); params.push(req.query.metodo); }
    if (req.query.estado_pago === 'pagado') cond.push("p.estado != 'cancelado' AND p.monto_pagado >= p.total");
    else if (req.query.estado_pago === 'debe') cond.push("p.estado != 'cancelado' AND p.monto_pagado < p.total");
    else if (req.query.estado_pago === 'cancelado') cond.push("p.estado = 'cancelado'");
    const where = cond.join(' AND ');
    const pagina = Math.max(1, Number(req.query.pagina) || 1);

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM pedidos p WHERE ${where}`).get(...params);
    const pedidos = db.prepare(`
      SELECT p.id, p.numero_orden, p.created_at, p.tipo, p.estado, p.total, p.monto_pagado, m.numero AS mesa_numero,
        (SELECT GROUP_CONCAT(DISTINCT pg.metodo_pago) FROM pagos pg WHERE pg.pedido_id = p.id) AS metodos
      FROM pedidos p LEFT JOIN mesas m ON m.id = p.mesa_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, POR_PAGINA, (pagina - 1) * POR_PAGINA);

    res.json({ total, pagina, por_pagina: POR_PAGINA, pedidos });
  } catch (error) {
    console.error('Error al listar pedidos:', error);
    res.status(500).json({ error: 'Error interno al listar pedidos' });
  }
});

/** GET /api/estadisticas/pedidos/:id — productos, abonos (con quién cobró) y salidas del pedido */
router.get('/pedidos/:id', (req, res) => {
  try {
    const pedido = db.prepare(`
      SELECT p.*, m.numero AS mesa_numero, u.nombre AS tomado_por
      FROM pedidos p LEFT JOIN mesas m ON m.id = p.mesa_id LEFT JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    pedido.items = db.prepare('SELECT nombre_display, cantidad, precio_unitario, subtotal, notas FROM detalle_pedido WHERE pedido_id = ? ORDER BY id').all(pedido.id);
    pedido.pagos = db.prepare(`
      SELECT pg.monto, pg.metodo_pago, pg.created_at, u.nombre AS cobrado_por
      FROM pagos pg LEFT JOIN usuarios u ON u.id = pg.usuario_id WHERE pg.pedido_id = ? ORDER BY pg.created_at
    `).all(pedido.id);
    pedido.salidas = db.prepare('SELECT tipo, monto, created_at FROM movimientos_caja WHERE pedido_id = ?').all(pedido.id);
    res.json(pedido);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error interno al obtener el pedido' });
  }
});

/** Filas vendidas en el rango (una por producto/variante), reutilizada por ambos reportes. */
function obtenerVentasPorProducto(desde, hasta) {
  return db.prepare(`
    SELECT
      COALESCE(dp.producto_id, pv.producto_id) AS producto_id,
      dp.variante_id AS variante_id,
      COALESCE(p1.nombre, p2.nombre) AS nombre,
      pv.nombre_tamanio AS nombre_tamanio,
      SUM(dp.cantidad) AS unidades_vendidas,
      SUM(dp.subtotal) AS ingresos
    FROM detalle_pedido dp
    JOIN pedidos ped ON ped.id = dp.pedido_id
    LEFT JOIN producto_variantes pv ON pv.id = dp.variante_id
    LEFT JOIN productos p1 ON p1.id = dp.producto_id
    LEFT JOIN productos p2 ON p2.id = pv.producto_id
    WHERE ped.estado != 'cancelado' AND ped.monto_pagado >= ped.total
      AND ped.created_at >= ? AND ped.created_at < ?
    GROUP BY COALESCE(dp.producto_id, pv.producto_id), dp.variante_id
    ORDER BY unidades_vendidas DESC
  `).all(desde, hasta);
}

/** GET /api/estadisticas/productos-mas-vendidos?desde=&hasta=&limite=20 */
router.get('/productos-mas-vendidos', (req, res) => {
  try {
    const { desde, hasta } = resolverRango(req.query);
    const limite = Number(req.query.limite) || 20;
    const filas = obtenerVentasPorProducto(desde, hasta).slice(0, limite);
    res.json({ desde, hasta, productos: filas });
  } catch (error) {
    console.error('Error al calcular productos más vendidos:', error);
    res.status(500).json({ error: 'Error interno al calcular productos más vendidos' });
  }
});

/** GET /api/estadisticas/rentabilidad?desde=&hasta= */
router.get('/rentabilidad', (req, res) => {
  try {
    const { desde, hasta } = resolverRango(req.query);
    const filas = obtenerVentasPorProducto(desde, hasta);

    let ingresosTotales = 0;
    let costoTotalConocido = 0;
    let itemsConCostoDesconocido = 0;

    const items = filas.map((f) => {
      ingresosTotales += f.ingresos;
      const recetas = resolverRecetaAutomatica(f.producto_id, f.variante_id);
      if (recetas.length === 0) {
        itemsConCostoDesconocido++;
        return {
          producto_id: f.producto_id, variante_id: f.variante_id,
          nombre: f.nombre_tamanio ? `${f.nombre} · ${f.nombre_tamanio}` : f.nombre,
          unidades_vendidas: f.unidades_vendidas, ingresos: f.ingresos,
          costo_unitario: null, costo_total: null, margen: null, margen_pct: null,
          costo_desconocido: true,
        };
      }
      const costoUnitario = recetas.reduce((acc, r) => acc + r.cantidad * r.precio_compra, 0);
      const costoTotal = Math.round(costoUnitario * f.unidades_vendidas);
      costoTotalConocido += costoTotal;
      const margen = f.ingresos - costoTotal;
      return {
        producto_id: f.producto_id, variante_id: f.variante_id,
        nombre: f.nombre_tamanio ? `${f.nombre} · ${f.nombre_tamanio}` : f.nombre,
        unidades_vendidas: f.unidades_vendidas, ingresos: f.ingresos,
        costo_unitario: Math.round(costoUnitario), costo_total: costoTotal,
        margen, margen_pct: f.ingresos > 0 ? Math.round((margen / f.ingresos) * 1000) / 10 : null,
        costo_desconocido: false,
      };
    });

    res.json({
      desde, hasta, items,
      resumen: { ingresos_totales: ingresosTotales, costo_total_conocido: costoTotalConocido, items_con_costo_desconocido: itemsConCostoDesconocido },
    });
  } catch (error) {
    console.error('Error al calcular rentabilidad:', error);
    res.status(500).json({ error: 'Error interno al calcular rentabilidad' });
  }
});

export default router;
