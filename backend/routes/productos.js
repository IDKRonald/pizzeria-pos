// backend/routes/productos.js
// Endpoints para productos y categorías del menú

import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

/**
 * Exige que el usuario que hace la petición sea admin.
 * Mismo patrón que routes/mesas.js e routes/inventario.js.
 */
function requireAdmin(req, res, next) {
  const usuario_id = req.body?.usuario_id || req.query?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error: 'usuario_id es requerido' });
  const usuario = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario_id);
  if (!usuario || usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede editar la carta' });
  }
  next();
}

/**
 * GET /api/categorias
 * Retorna todas las categorías ordenadas
 */
router.get('/categorias', (_req, res) => {
  const categorias = db.prepare(
    `SELECT id, nombre, emoji, orden FROM categorias ORDER BY orden ASC`
  ).all();
  res.json(categorias);
});

/** POST /api/categorias — crear categoría (admin) */
router.post('/categorias', requireAdmin, (req, res) => {
  const { nombre, emoji = '📦', orden = 0 } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre es obligatorio' });
  try {
    const r = db.prepare('INSERT INTO categorias (nombre, emoji, orden) VALUES (?, ?, ?)').run(nombre, emoji, orden);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: `Ya existe una categoría llamada "${nombre}"` });
    }
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error interno al crear categoría' });
  }
});

/** PUT /api/categorias/:id — editar categoría (admin) */
router.put('/categorias/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const cat = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
  const nombre = req.body.nombre ?? cat.nombre;
  const emoji = req.body.emoji ?? cat.emoji;
  const orden = req.body.orden ?? cat.orden;
  try {
    db.prepare('UPDATE categorias SET nombre = ?, emoji = ?, orden = ? WHERE id = ?').run(nombre, emoji, orden, id);
    res.json({ message: 'Categoría actualizada' });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error interno al actualizar categoría' });
  }
});

/** DELETE /api/categorias/:id — eliminar categoría vacía (admin) */
router.delete('/categorias/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const cat = db.prepare('SELECT id FROM categorias WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
  const conProductos = db.prepare('SELECT COUNT(*) as n FROM productos WHERE categoria_id = ?').get(id);
  if (conProductos.n > 0) {
    return res.status(409).json({ error: 'No se puede eliminar: hay productos en esta categoría' });
  }
  try {
    db.prepare('DELETE FROM categorias WHERE id = ?').run(id);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error interno al eliminar categoría' });
  }
});

/**
 * GET /api/productos
 * Retorna todos los productos activos con variantes anidadas.
 * Estructura: [{ id, nombre, descripcion, precio, categoria, imagen,
 *                tiene_variantes, precio_desde, variantes: [...] }]
 */
router.get('/productos', (_req, res) => {
  // Traer productos con nombre de categoría
  const productos = db.prepare(`
    SELECT
      p.id, p.nombre, p.descripcion, p.precio,
      c.nombre AS categoria,
      p.imagen, p.tiene_variantes, p.precio_desde
    FROM productos p
    JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1
    ORDER BY c.orden ASC, p.nombre ASC
  `).all();

  // Traer todas las variantes en un solo query
  const variantes = db.prepare(`
    SELECT id, producto_id, nombre_tamanio, precio
    FROM producto_variantes
    ORDER BY precio ASC
  `).all();

  // Agrupar variantes por producto_id
  const varMap = {};
  for (const v of variantes) {
    if (!varMap[v.producto_id]) varMap[v.producto_id] = [];
    varMap[v.producto_id].push({
      idVariante: `var_${v.id}`,
      nombreTamanio: v.nombre_tamanio,
      precio: v.precio,
    });
  }

  // Combos: qué producto ofrece un slot de selección (ej. "elige tu gaseosa")
  // y qué productos activos de esa categoría son las opciones válidas.
  const combos = db.prepare(`
    SELECT cs.producto_id, cs.nombre_slot, cs.categoria_opciones_id
    FROM combo_slots cs
  `).all();
  const opcionesPorCategoria = {};
  for (const c of combos) {
    if (opcionesPorCategoria[c.categoria_opciones_id]) continue;
    opcionesPorCategoria[c.categoria_opciones_id] = db.prepare(`
      SELECT id, nombre, precio, imagen FROM productos
      WHERE categoria_id = ? AND activo = 1 AND tiene_variantes = 0
      ORDER BY nombre ASC
    `).all(c.categoria_opciones_id).map((op) => ({
      id: `prod_${op.id}`, nombre: op.nombre, precio: op.precio, imagen: op.imagen,
    }));
  }
  const comboMap = {};
  for (const c of combos) {
    comboMap[c.producto_id] = {
      nombreSlot: c.nombre_slot,
      opciones: opcionesPorCategoria[c.categoria_opciones_id] || [],
    };
  }

  // Ensamblar respuesta
  const resultado = productos.map((p) => ({
    id: `prod_${p.id}`,
    nombre: p.nombre,
    desc: p.descripcion,
    precio: p.precio,
    categoria: p.categoria,
    imagen: p.imagen,
    precioDesde: p.precio_desde,
    variantes: p.tiene_variantes ? (varMap[p.id] || []) : undefined,
    esCombo: !!comboMap[p.id],
    comboSlot: comboMap[p.id],
  }));

  res.json(resultado);
});

/**
 * GET /api/productos/admin/todos
 * Datos crudos (ids sin prefijo, categoria_id, incluye inactivos) para el editor de carta.
 */
router.get('/productos/admin/todos', (_req, res) => {
  try {
    const productos = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      ORDER BY c.orden ASC, p.nombre ASC
    `).all();
    const variantes = db.prepare('SELECT * FROM producto_variantes ORDER BY precio ASC').all();
    const varMap = {};
    for (const v of variantes) (varMap[v.producto_id] ||= []).push(v);
    res.json(productos.map((p) => ({ ...p, variantes: varMap[p.id] || [] })));
  } catch (error) {
    console.error('Error al listar productos (admin):', error);
    res.status(500).json({ error: 'Error interno al obtener productos' });
  }
});

/** POST /api/productos — crear producto (admin) */
router.post('/productos', requireAdmin, (req, res) => {
  const {
    nombre, descripcion = null, categoria_id, imagen = '🍽️',
    tiene_variantes = false, precio = null, variantes = [],
  } = req.body;
  if (!nombre || !categoria_id) {
    return res.status(400).json({ error: 'nombre y categoria_id son obligatorios' });
  }
  if (tiene_variantes && variantes.length === 0) {
    return res.status(400).json({ error: 'Un producto con tamaños necesita al menos una variante' });
  }
  if (!tiene_variantes && (precio === null || precio === undefined)) {
    return res.status(400).json({ error: 'precio es obligatorio si el producto no tiene tamaños' });
  }

  try {
    const crear = db.transaction(() => {
      const precioDesde = tiene_variantes ? Math.min(...variantes.map((v) => v.precio)) : null;
      const r = db.prepare(`
        INSERT INTO productos (nombre, descripcion, precio, categoria_id, imagen, tiene_variantes, precio_desde)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(nombre, descripcion, tiene_variantes ? null : precio, categoria_id, imagen, tiene_variantes ? 1 : 0, precioDesde);
      const producto_id = r.lastInsertRowid;

      if (tiene_variantes) {
        const insVar = db.prepare('INSERT INTO producto_variantes (producto_id, nombre_tamanio, precio) VALUES (?, ?, ?)');
        for (const v of variantes) insVar.run(producto_id, v.nombre_tamanio, v.precio);
      }
      return producto_id;
    });
    res.status(201).json({ id: crear() });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error interno al crear producto' });
  }
});

/** PUT /api/productos/:id — editar datos base del producto (admin) */
router.put('/productos/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const prod = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

  const nombre = req.body.nombre ?? prod.nombre;
  const descripcion = req.body.descripcion ?? prod.descripcion;
  const categoria_id = req.body.categoria_id ?? prod.categoria_id;
  const imagen = req.body.imagen ?? prod.imagen;
  const activo = req.body.activo !== undefined ? (req.body.activo ? 1 : 0) : prod.activo;
  // El precio de un producto con variantes se maneja por tamaño, no aquí.
  const precio = prod.tiene_variantes ? prod.precio : (req.body.precio ?? prod.precio);

  try {
    db.prepare(`
      UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, categoria_id = ?, imagen = ?, activo = ?
      WHERE id = ?
    `).run(nombre, descripcion, precio, categoria_id, imagen, activo, id);
    res.json({ message: 'Producto actualizado' });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error interno al actualizar producto' });
  }
});

/** DELETE /api/productos/:id — eliminar producto sin historial (admin); si tiene historial, se sugiere desactivar */
router.delete('/productos/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const prod = db.prepare('SELECT id FROM productos WHERE id = ?').get(id);
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

  const enVentas = db.prepare('SELECT COUNT(*) as n FROM detalle_pedido WHERE producto_id = ?').get(id);
  if (enVentas.n > 0) {
    return res.status(409).json({ error: 'Este producto tiene historial de ventas — desactívalo en lugar de eliminarlo' });
  }
  try {
    db.prepare('DELETE FROM productos WHERE id = ?').run(id); // variantes/recetas/combo_slots caen en cascada
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error interno al eliminar producto' });
  }
});

function recalcularPrecioDesde(producto_id) {
  const min = db.prepare('SELECT MIN(precio) as m FROM producto_variantes WHERE producto_id = ?').get(producto_id);
  db.prepare('UPDATE productos SET precio_desde = ? WHERE id = ?').run(min.m ?? null, producto_id);
}

/** POST /api/productos/:id/variantes — agregar un tamaño (admin) */
router.post('/productos/:id/variantes', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_tamanio, precio } = req.body;
  if (!nombre_tamanio || precio === undefined) {
    return res.status(400).json({ error: 'nombre_tamanio y precio son obligatorios' });
  }
  const prod = db.prepare('SELECT id FROM productos WHERE id = ?').get(id);
  if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });

  try {
    const agregar = db.transaction(() => {
      const r = db.prepare('INSERT INTO producto_variantes (producto_id, nombre_tamanio, precio) VALUES (?, ?, ?)').run(id, nombre_tamanio, precio);
      db.prepare('UPDATE productos SET tiene_variantes = 1, precio = NULL WHERE id = ?').run(id);
      recalcularPrecioDesde(id);
      return r.lastInsertRowid;
    });
    res.status(201).json({ id: agregar() });
  } catch (error) {
    console.error('Error al agregar variante:', error);
    res.status(500).json({ error: 'Error interno al agregar variante' });
  }
});

/** PUT /api/variantes/:id — editar nombre/precio de un tamaño (admin) */
router.put('/variantes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const variante = db.prepare('SELECT * FROM producto_variantes WHERE id = ?').get(id);
  if (!variante) return res.status(404).json({ error: 'Variante no encontrada' });
  const nombre_tamanio = req.body.nombre_tamanio ?? variante.nombre_tamanio;
  const precio = req.body.precio ?? variante.precio;

  try {
    db.transaction(() => {
      db.prepare('UPDATE producto_variantes SET nombre_tamanio = ?, precio = ? WHERE id = ?').run(nombre_tamanio, precio, id);
      recalcularPrecioDesde(variante.producto_id);
    })();
    res.json({ message: 'Variante actualizada' });
  } catch (error) {
    console.error('Error al actualizar variante:', error);
    res.status(500).json({ error: 'Error interno al actualizar variante' });
  }
});

/** DELETE /api/variantes/:id — quitar un tamaño sin historial de ventas (admin) */
router.delete('/variantes/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const variante = db.prepare('SELECT * FROM producto_variantes WHERE id = ?').get(id);
  if (!variante) return res.status(404).json({ error: 'Variante no encontrada' });

  const enVentas = db.prepare('SELECT COUNT(*) as n FROM detalle_pedido WHERE variante_id = ?').get(id);
  if (enVentas.n > 0) {
    return res.status(409).json({ error: 'Este tamaño tiene historial de ventas — no se puede eliminar' });
  }
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM producto_variantes WHERE id = ?').run(id);
      recalcularPrecioDesde(variante.producto_id);
    })();
    res.json({ message: 'Variante eliminada' });
  } catch (error) {
    console.error('Error al eliminar variante:', error);
    res.status(500).json({ error: 'Error interno al eliminar variante' });
  }
});

export default router;
