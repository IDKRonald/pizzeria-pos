// backend/routes/caja.js
import { Router } from 'express';
import db from '../db/connection.js';
import { hayCajaAbierta, obtenerCajaAbierta, calcularTotalesPeriodo } from '../db/caja-helpers.js';

const router = Router();

function requireCajero(req, res, next) {
  const usuario_id = req.body?.usuario_id || req.query?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error: 'usuario_id es requerido' });
  const usuario = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario_id);
  if (!usuario || !['admin', 'cajero'].includes(usuario.rol)) {
    return res.status(403).json({ error: 'Solo un administrador o cajero puede abrir/cerrar caja' });
  }
  next();
}

/** GET /api/caja/actual — la caja abierta (si hay) + totales en vivo desde que abrió */
router.get('/actual', (_req, res) => {
  try {
    const caja = obtenerCajaAbierta();
    if (!caja) return res.json({ caja: null, totales: null });

    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hastaStr = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
    const totales = calcularTotalesPeriodo(caja.fecha_apertura, hastaStr);
    totales.monto_esperado_efectivo = caja.monto_inicial + totales.total_efectivo;

    res.json({ caja, totales });
  } catch (error) {
    console.error('Error al obtener caja actual:', error);
    res.status(500).json({ error: 'Error interno al obtener caja actual' });
  }
});

/** POST /api/caja/abrir — { usuario_id, monto_inicial, notas } (admin/cajero) */
router.post('/abrir', requireCajero, (req, res) => {
  const { usuario_id, monto_inicial = 0, notas = null } = req.body;
  if (hayCajaAbierta()) {
    return res.status(409).json({ error: 'Ya hay una caja abierta' });
  }
  try {
    const r = db.prepare(`
      INSERT INTO cierres_caja (usuario_id, monto_inicial, notas) VALUES (?, ?, ?)
    `).run(usuario_id, monto_inicial, notas);

    const io = req.app.get('io');
    if (io) io.to('sala_caja').emit('caja_actualizada', { caja: obtenerCajaAbierta() });

    res.status(201).json({ id: r.lastInsertRowid });
  } catch (error) {
    console.error('Error al abrir caja:', error);
    res.status(500).json({ error: 'Error interno al abrir caja' });
  }
});

/** POST /api/caja/:id/cerrar — { usuario_id, monto_final, notas } (admin/cajero) */
router.post('/:id/cerrar', requireCajero, (req, res) => {
  const { id } = req.params;
  const { monto_final, notas = null } = req.body;

  if (monto_final === undefined || monto_final === null || isNaN(Number(monto_final))) {
    return res.status(400).json({ error: 'monto_final es obligatorio (efectivo contado físicamente)' });
  }

  const caja = db.prepare('SELECT * FROM cierres_caja WHERE id = ?').get(id);
  if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });
  if (caja.fecha_cierre) return res.status(409).json({ error: 'Esta caja ya fue cerrada' });

  try {
    const ahora = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hastaStr = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
    const totales = calcularTotalesPeriodo(caja.fecha_apertura, hastaStr);
    const diferencia = Number(monto_final) - (caja.monto_inicial + totales.total_efectivo);

    db.prepare(`
      UPDATE cierres_caja
      SET fecha_cierre = datetime('now','localtime'), monto_final = ?, total_ventas = ?,
          total_efectivo = ?, total_transferencias = ?, total_tarjeta_debito = ?, total_tarjeta_credito = ?,
          diferencia = ?, notas = ?
      WHERE id = ?
    `).run(
      Number(monto_final), totales.total_general, totales.total_efectivo, totales.total_transferencia,
      totales.total_tarjeta_debito, totales.total_tarjeta_credito, diferencia, notas, id
    );

    const io = req.app.get('io');
    if (io) io.to('sala_caja').emit('caja_actualizada', { caja: null });

    res.json({ message: 'Caja cerrada', diferencia, totales });
  } catch (error) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ error: 'Error interno al cerrar caja' });
  }
});

/** GET /api/caja/historial?desde=&hasta=&limite= — cajas ya cerradas */
router.get('/historial', (req, res) => {
  const { desde, hasta, limite = 30 } = req.query;
  try {
    const condiciones = ['c.fecha_cierre IS NOT NULL'];
    const params = [];
    if (desde) { condiciones.push('c.fecha_apertura >= ?'); params.push(desde); }
    if (hasta) { condiciones.push('c.fecha_apertura <= ?'); params.push(hasta); }

    const historial = db.prepare(`
      SELECT c.*, u.nombre as usuario_nombre
      FROM cierres_caja c
      JOIN usuarios u ON u.id = c.usuario_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY c.fecha_apertura DESC
      LIMIT ?
    `).all(...params, Number(limite));

    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial de caja:', error);
    res.status(500).json({ error: 'Error interno al obtener historial de caja' });
  }
});

export default router;
