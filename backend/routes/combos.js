// backend/routes/combos.js
import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

function requireAdmin(req, res, next) {
  const usuario_id = req.body?.usuario_id || req.query?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error: 'usuario_id es requerido' });
  const usuario = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario_id);
  if (!usuario || usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede configurar combos' });
  }
  next();
}

/** GET /api/combos — lista todos los combos configurados */
router.get('/', (_req, res) => {
  try {
    const combos = db.prepare(`
      SELECT cs.*, p.nombre as producto_nombre, c.nombre as categoria_nombre
      FROM combo_slots cs
      JOIN productos p  ON p.id = cs.producto_id
      JOIN categorias c ON c.id = cs.categoria_opciones_id
      ORDER BY p.nombre ASC
    `).all();
    res.json(combos);
  } catch (error) {
    console.error('Error al listar combos:', error);
    res.status(500).json({ error: 'Error interno al obtener combos' });
  }
});

/** POST /api/combos — marca un producto existente como combo (admin) */
router.post('/', requireAdmin, (req, res) => {
  const { producto_id, categoria_opciones_id, nombre_slot = 'Bebida' } = req.body;
  if (!producto_id || !categoria_opciones_id) {
    return res.status(400).json({ error: 'producto_id y categoria_opciones_id son obligatorios' });
  }
  const yaExiste = db.prepare('SELECT id FROM combo_slots WHERE producto_id = ?').get(producto_id);
  if (yaExiste) {
    return res.status(409).json({ error: 'Este producto ya está configurado como combo' });
  }
  try {
    const r = db.prepare(`
      INSERT INTO combo_slots (producto_id, categoria_opciones_id, nombre_slot) VALUES (?, ?, ?)
    `).run(producto_id, categoria_opciones_id, nombre_slot);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (error) {
    console.error('Error al crear combo:', error);
    res.status(500).json({ error: 'Error interno al crear combo' });
  }
});

/** PUT /api/combos/:id (admin) */
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const combo = db.prepare('SELECT * FROM combo_slots WHERE id = ?').get(id);
  if (!combo) return res.status(404).json({ error: 'Combo no encontrado' });
  const categoria_opciones_id = req.body.categoria_opciones_id ?? combo.categoria_opciones_id;
  const nombre_slot = req.body.nombre_slot ?? combo.nombre_slot;
  try {
    db.prepare('UPDATE combo_slots SET categoria_opciones_id = ?, nombre_slot = ? WHERE id = ?')
      .run(categoria_opciones_id, nombre_slot, id);
    res.json({ message: 'Combo actualizado' });
  } catch (error) {
    console.error('Error al actualizar combo:', error);
    res.status(500).json({ error: 'Error interno al actualizar combo' });
  }
});

/** DELETE /api/combos/:id (admin) — deja de ser combo, vuelve a producto normal */
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM combo_slots WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Combo no encontrado' });
    res.json({ message: 'Combo eliminado' });
  } catch (error) {
    console.error('Error al eliminar combo:', error);
    res.status(500).json({ error: 'Error interno al eliminar combo' });
  }
});

export default router;
