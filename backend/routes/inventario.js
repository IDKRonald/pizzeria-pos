// backend/routes/inventario.js
import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

/**
 * Exige que el usuario que hace la petición sea admin.
 * Mismo patrón que routes/mesas.js: no hay sesión/token, así que el rol
 * se valida consultando la BD por el usuario_id que manda el cliente.
 */
function requireAdmin(req, res, next) {
  const usuario_id = req.body?.usuario_id || req.query?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error: 'usuario_id es requerido' });
  const usuario = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario_id);
  if (!usuario || usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede editar el inventario' });
  }
  next();
}

/** Inserta un movimiento y actualiza insumos.stock_actual en una sola operación. */
function aplicarMovimiento({ insumo_id, tipo, cantidad, pedido_id = null, usuario_id = null, notas = null }) {
  const insumo = db.prepare('SELECT stock_actual FROM insumos WHERE id = ?').get(insumo_id);
  if (!insumo) throw new Error(`Insumo ${insumo_id} no encontrado`);
  const nuevoStock = insumo.stock_actual + cantidad;
  db.prepare('UPDATE insumos SET stock_actual = ? WHERE id = ?').run(nuevoStock, insumo_id);
  db.prepare(`
    INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, stock_resultante, pedido_id, usuario_id, notas)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(insumo_id, tipo, cantidad, nuevoStock, pedido_id, usuario_id, notas);
  return nuevoStock;
}

// ── Insumos ─────────────────────────────────────────────────

router.get('/insumos', (req, res) => {
  const { proveedor_id, modo_descuento, bajo_stock, activo } = req.query;
  try {
    const condiciones = [];
    const params = [];
    if (proveedor_id)   { condiciones.push('i.proveedor_id = ?');   params.push(proveedor_id); }
    if (modo_descuento) { condiciones.push('i.modo_descuento = ?'); params.push(modo_descuento); }
    if (bajo_stock === '1') condiciones.push('i.stock_actual <= i.stock_min');
    if (activo !== undefined) { condiciones.push('i.activo = ?'); params.push(activo === '1' ? 1 : 0); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const insumos = db.prepare(`
      SELECT i.*, p.nombre as proveedor_nombre, p.telefono as proveedor_telefono
      FROM insumos i
      LEFT JOIN proveedores p ON p.id = i.proveedor_id
      ${where}
      ORDER BY i.nombre ASC
    `).all(...params);
    res.json(insumos);
  } catch (error) {
    console.error('Error al listar insumos:', error);
    res.status(500).json({ error: 'Error interno al obtener insumos' });
  }
});

router.post('/insumos', requireAdmin, (req, res) => {
  const {
    nombre, unidad = 'unidad', stock_actual = 0, stock_min = 0, stock_max = 0,
    precio_compra = 0, modo_descuento = 'manual', proveedor_id = null,
  } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });

  try {
    const crear = db.transaction(() => {
      // Se inserta en 0 y el stock inicial entra como un movimiento real, para que
      // movimientos_inventario sea siempre la única fuente de verdad de cada cambio.
      const r = db.prepare(`
        INSERT INTO insumos (nombre, unidad, stock_actual, stock_min, stock_max, precio_compra, modo_descuento, proveedor_id)
        VALUES (?, ?, 0, ?, ?, ?, ?, ?)
      `).run(nombre, unidad, stock_min, stock_max, precio_compra, modo_descuento, proveedor_id);
      const insumo_id = r.lastInsertRowid;
      if (Number(stock_actual) > 0) {
        aplicarMovimiento({
          insumo_id, tipo: 'ajuste_manual', cantidad: Number(stock_actual),
          usuario_id: req.body.usuario_id, notas: 'Stock inicial al crear el insumo',
        });
      }
      return insumo_id;
    });
    res.status(201).json({ id: crear() });
  } catch (error) {
    console.error('Error al crear insumo:', error);
    res.status(500).json({ error: 'Error interno al crear insumo' });
  }
});

router.put('/insumos/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const insumo = db.prepare('SELECT * FROM insumos WHERE id = ?').get(id);
  if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });

  // stock_actual NUNCA se edita directo aquí — solo vía /ajuste, para que
  // movimientos_inventario siga siendo la única fuente de verdad de cada cambio.
  const campos = ['nombre', 'unidad', 'stock_min', 'stock_max', 'precio_compra', 'modo_descuento', 'proveedor_id', 'activo'];
  const valores = campos.map((c) => (req.body[c] !== undefined ? req.body[c] : insumo[c]));

  try {
    db.prepare(`
      UPDATE insumos SET nombre=?, unidad=?, stock_min=?, stock_max=?, precio_compra=?, modo_descuento=?, proveedor_id=?, activo=?
      WHERE id = ?
    `).run(...valores, id);
    res.json({ message: 'Insumo actualizado' });
  } catch (error) {
    console.error('Error al actualizar insumo:', error);
    res.status(500).json({ error: 'Error interno al actualizar insumo' });
  }
});

router.delete('/insumos/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const insumo = db.prepare('SELECT id FROM insumos WHERE id = ?').get(id);
  if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });

  const enReceta = db.prepare('SELECT COUNT(*) as n FROM recetas WHERE insumo_id = ?').get(id);
  if (enReceta.n > 0) {
    return res.status(409).json({ error: 'No se puede eliminar: este insumo tiene recetas asociadas' });
  }
  const conMovimientos = db.prepare('SELECT COUNT(*) as n FROM movimientos_inventario WHERE insumo_id = ?').get(id);
  if (conMovimientos.n > 0) {
    return res.status(409).json({ error: 'No se puede eliminar: este insumo tiene historial de movimientos. Desactívalo en su lugar.' });
  }

  try {
    db.prepare('DELETE FROM insumos WHERE id = ?').run(id);
    res.json({ message: 'Insumo eliminado' });
  } catch (error) {
    console.error('Error al eliminar insumo:', error);
    res.status(500).json({ error: 'Error interno al eliminar insumo' });
  }
});

/** Ajuste manual de stock: { delta, motivo, usuario_id } */
router.post('/insumos/:id/ajuste', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { delta, motivo = null, usuario_id } = req.body;
  if (delta === undefined || isNaN(Number(delta)) || Number(delta) === 0) {
    return res.status(400).json({ error: 'delta debe ser un número distinto de cero' });
  }
  const insumo = db.prepare('SELECT id FROM insumos WHERE id = ?').get(id);
  if (!insumo) return res.status(404).json({ error: 'Insumo no encontrado' });

  try {
    const ajustar = db.transaction(() =>
      aplicarMovimiento({ insumo_id: id, tipo: 'ajuste_manual', cantidad: Number(delta), usuario_id, notas: motivo })
    );
    const nuevoStock = ajustar();
    res.json({ message: 'Stock ajustado', stock_actual: nuevoStock });
  } catch (error) {
    console.error('Error al ajustar stock:', error);
    res.status(500).json({ error: 'Error interno al ajustar stock' });
  }
});

// ── Movimientos (auditoría, solo lectura) ───────────────────

router.get('/movimientos', (req, res) => {
  const { insumo_id, tipo, desde, hasta } = req.query;
  try {
    const condiciones = [];
    const params = [];
    if (insumo_id) { condiciones.push('m.insumo_id = ?'); params.push(insumo_id); }
    if (tipo)      { condiciones.push('m.tipo = ?');      params.push(tipo); }
    if (desde)     { condiciones.push('m.created_at >= ?'); params.push(desde); }
    if (hasta)     { condiciones.push('m.created_at <= ?'); params.push(hasta); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const movimientos = db.prepare(`
      SELECT m.*, i.nombre as insumo_nombre, i.unidad as insumo_unidad,
             u.nombre as usuario_nombre, p.numero_orden
      FROM movimientos_inventario m
      LEFT JOIN insumos i   ON i.id = m.insumo_id
      LEFT JOIN usuarios u  ON u.id = m.usuario_id
      LEFT JOIN pedidos p   ON p.id = m.pedido_id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT 200
    `).all(...params);
    res.json(movimientos);
  } catch (error) {
    console.error('Error al listar movimientos:', error);
    res.status(500).json({ error: 'Error interno al obtener movimientos' });
  }
});

// ── Proveedores ──────────────────────────────────────────────

router.get('/proveedores', (_req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM proveedores ORDER BY nombre ASC').all());
  } catch (error) {
    console.error('Error al listar proveedores:', error);
    res.status(500).json({ error: 'Error interno al obtener proveedores' });
  }
});

router.post('/proveedores', requireAdmin, (req, res) => {
  const { nombre, telefono = null } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  try {
    const r = db.prepare('INSERT INTO proveedores (nombre, telefono) VALUES (?, ?)').run(nombre, telefono);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ error: 'Error interno al crear proveedor' });
  }
});

router.put('/proveedores/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const proveedor = db.prepare('SELECT * FROM proveedores WHERE id = ?').get(id);
  if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const nombre = req.body.nombre !== undefined ? req.body.nombre : proveedor.nombre;
  const telefono = req.body.telefono !== undefined ? req.body.telefono : proveedor.telefono;
  try {
    db.prepare('UPDATE proveedores SET nombre = ?, telefono = ? WHERE id = ?').run(nombre, telefono, id);
    res.json({ message: 'Proveedor actualizado' });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ error: 'Error interno al actualizar proveedor' });
  }
});

router.delete('/proveedores/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const proveedor = db.prepare('SELECT id FROM proveedores WHERE id = ?').get(id);
  if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const conInsumos = db.prepare('SELECT COUNT(*) as n FROM insumos WHERE proveedor_id = ?').get(id);
  if (conInsumos.n > 0) {
    return res.status(409).json({ error: 'No se puede eliminar: hay insumos asignados a este proveedor' });
  }
  try {
    db.prepare('DELETE FROM proveedores WHERE id = ?').run(id);
    res.json({ message: 'Proveedor eliminado' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ error: 'Error interno al eliminar proveedor' });
  }
});

// ── Recetas ──────────────────────────────────────────────────

router.get('/recetas', (req, res) => {
  const { producto_id, variante_id, insumo_id } = req.query;
  try {
    const condiciones = [];
    const params = [];
    if (producto_id) { condiciones.push('r.producto_id = ?'); params.push(producto_id); }
    if (variante_id) { condiciones.push('r.variante_id = ?'); params.push(variante_id); }
    if (insumo_id)   { condiciones.push('r.insumo_id = ?');   params.push(insumo_id); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const recetas = db.prepare(`
      SELECT r.*, i.nombre as insumo_nombre, i.unidad as insumo_unidad, i.modo_descuento,
             p.nombre as producto_nombre, v.nombre_tamanio
      FROM recetas r
      JOIN insumos i ON i.id = r.insumo_id
      JOIN productos p ON p.id = r.producto_id
      LEFT JOIN producto_variantes v ON v.id = r.variante_id
      ${where}
      ORDER BY p.nombre ASC
    `).all(...params);
    res.json(recetas);
  } catch (error) {
    console.error('Error al listar recetas:', error);
    res.status(500).json({ error: 'Error interno al obtener recetas' });
  }
});

router.post('/recetas', requireAdmin, (req, res) => {
  const { producto_id, variante_id = null, insumo_id, cantidad } = req.body;
  if (!producto_id || !insumo_id || !cantidad || Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'producto_id, insumo_id y cantidad (> 0) son obligatorios' });
  }
  try {
    const r = db.prepare(`
      INSERT INTO recetas (producto_id, variante_id, insumo_id, cantidad) VALUES (?, ?, ?, ?)
    `).run(producto_id, variante_id, insumo_id, cantidad);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (error) {
    console.error('Error al crear receta:', error);
    res.status(500).json({ error: 'Error interno al crear receta' });
  }
});

router.delete('/recetas/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const result = db.prepare('DELETE FROM recetas WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Receta no encontrada' });
    res.json({ message: 'Receta eliminada' });
  } catch (error) {
    console.error('Error al eliminar receta:', error);
    res.status(500).json({ error: 'Error interno al eliminar receta' });
  }
});

// ── Importación inicial desde Excel ─────────────────────────
// Body: { usuario_id, filas: [{ nombre, unidad, stock_actual, stock_min, stock_max, precio_compra, proveedor, modo_descuento }] }

router.post('/importar', requireAdmin, (req, res) => {
  const { usuario_id, filas = [] } = req.body;
  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: 'filas es obligatorio y no puede estar vacío' });
  }

  const buscarOCrearProveedor = db.prepare('SELECT id FROM proveedores WHERE nombre = ? COLLATE NOCASE');
  const crearProveedor = db.prepare('INSERT INTO proveedores (nombre) VALUES (?)');
  const insertInsumo = db.prepare(`
    INSERT INTO insumos (nombre, unidad, stock_actual, stock_min, stock_max, precio_compra, modo_descuento, proveedor_id)
    VALUES (?, ?, 0, ?, ?, ?, ?, ?)
  `);

  const resultado = { creados: 0, proveedoresCreados: 0, errores: [] };

  const importar = db.transaction(() => {
    filas.forEach((fila, idx) => {
      const nombre = String(fila.nombre || '').trim();
      if (!nombre) {
        resultado.errores.push({ fila: idx + 1, error: 'nombre vacío' });
        return;
      }
      const stock_actual = Number(fila.stock_actual) || 0;
      const stock_min = Number(fila.stock_min) || 0;
      const stock_max = Number(fila.stock_max) || 0;
      const precio_compra = Number(fila.precio_compra) || 0;
      const unidad = String(fila.unidad || 'unidad').trim();
      const modo_descuento = fila.modo_descuento === 'automatico' ? 'automatico' : 'manual';

      let proveedor_id = null;
      const nombreProveedor = String(fila.proveedor || '').trim();
      if (nombreProveedor) {
        const existente = buscarOCrearProveedor.get(nombreProveedor);
        if (existente) {
          proveedor_id = existente.id;
        } else {
          proveedor_id = crearProveedor.run(nombreProveedor).lastInsertRowid;
          resultado.proveedoresCreados++;
        }
      }

      const r = insertInsumo.run(nombre, unidad, stock_min, stock_max, precio_compra, modo_descuento, proveedor_id);
      if (stock_actual > 0) {
        aplicarMovimiento({
          insumo_id: r.lastInsertRowid, tipo: 'importacion_inicial', cantidad: stock_actual,
          usuario_id, notas: 'Carga inicial desde Excel',
        });
      }
      resultado.creados++;
    });
  });

  try {
    importar();
    res.status(201).json(resultado);
  } catch (error) {
    console.error('Error al importar insumos:', error);
    res.status(500).json({ error: 'Error interno al importar insumos' });
  }
});

// ── Sugerencia de compra ────────────────────────────────────
// Insumos que ya llegaron a su stock mínimo, agrupados por proveedor, con
// la cantidad sugerida para llegar al stock máximo (patrón clásico de
// punto de reorden: se pide cuando toca mínimo, se pide hasta el máximo).

router.get('/sugerencia-compra', (_req, res) => {
  try {
    const insumos = db.prepare(`
      SELECT i.id, i.nombre, i.unidad, i.stock_actual, i.stock_min, i.stock_max,
             i.proveedor_id, p.nombre as proveedor_nombre, p.telefono as proveedor_telefono
      FROM insumos i
      LEFT JOIN proveedores p ON p.id = i.proveedor_id
      WHERE i.activo = 1 AND i.stock_actual <= i.stock_min AND i.stock_max > i.stock_actual
      ORDER BY p.nombre ASC, i.nombre ASC
    `).all();

    const grupos = {};
    for (const i of insumos) {
      const clave = i.proveedor_id || 'sin_proveedor';
      if (!grupos[clave]) {
        grupos[clave] = {
          proveedor_id: i.proveedor_id,
          proveedor_nombre: i.proveedor_nombre || 'Sin proveedor asignado',
          proveedor_telefono: i.proveedor_telefono || null,
          items: [],
        };
      }
      grupos[clave].items.push({
        insumo_id: i.id,
        nombre: i.nombre,
        unidad: i.unidad,
        stock_actual: i.stock_actual,
        cantidad_sugerida: Math.round((i.stock_max - i.stock_actual) * 100) / 100,
      });
    }

    res.json(Object.values(grupos));
  } catch (error) {
    console.error('Error al calcular sugerencia de compra:', error);
    res.status(500).json({ error: 'Error interno al calcular sugerencia de compra' });
  }
});

export default router;
