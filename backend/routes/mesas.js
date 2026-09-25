// backend/routes/mesas.js
import { Router } from 'express';
import db from '../db/connection.js';
import { obtenerMiembrosGrupo, sincronizarEstadoMesa } from '../db/mesa-helpers.js';

const router = Router();

const ESTADOS_NO_TERMINALES = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

/**
 * Exige que el usuario que hace la petición sea admin.
 * No hay sesión/token real en este proyecto — el rol se valida consultando
 * la BD por el usuario_id que manda el cliente, nunca confiando en un rol
 * que el cliente afirme tener directamente.
 */
function requireAdmin(req, res, next) {
  const usuario_id = req.body?.usuario_id || req.query?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error: 'usuario_id es requerido' });
  const usuario = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario_id);
  if (!usuario || usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede editar el salón' });
  }
  next();
}

function serializarMesas() {
  const mesas = db.prepare('SELECT * FROM mesas ORDER BY numero ASC').all();
  const grupos = db.prepare('SELECT * FROM mesa_grupos').all();
  const gruposPorId = Object.fromEntries(grupos.map((g) => [g.id, g]));

  const numerosPorGrupo = {};
  for (const m of mesas) {
    if (!m.grupo_id) continue;
    (numerosPorGrupo[m.grupo_id] ||= []).push(m.numero);
  }

  const conteoActivos = db.prepare(`
    SELECT mesa_id, COUNT(*) as n FROM pedidos
    WHERE estado IN (${ESTADOS_NO_TERMINALES.map(() => '?').join(',')}) AND mesa_id IS NOT NULL
    GROUP BY mesa_id
  `).all(...ESTADOS_NO_TERMINALES);
  const conteoPorMesa = Object.fromEntries(conteoActivos.map((r) => [r.mesa_id, r.n]));

  return mesas.map((m) => {
    const grupo = m.grupo_id ? gruposPorId[m.grupo_id] : null;
    // Los pedidos activos de una mesa fusionada pueden estar en cualquier miembro,
    // no solo en la principal — se suman todos para reflejar la cuenta compartida.
    const miembros = grupo ? mesas.filter((x) => x.grupo_id === m.grupo_id).map((x) => x.id) : [m.id];
    const pedidosActivos = miembros.reduce((acc, id) => acc + (conteoPorMesa[id] || 0), 0);

    return {
      ...m,
      grupo: grupo
        ? { id: grupo.id, nombre: grupo.nombre, mesa_principal_id: grupo.mesa_principal_id, miembros: numerosPorGrupo[grupo.id] || [] }
        : null,
      pedidos_activos: pedidosActivos,
    };
  });
}

/** GET /api/mesas — diagrama completo con info de grupo y pedidos activos */
router.get('/', (_req, res) => {
  try {
    res.json(serializarMesas());
  } catch (error) {
    console.error('Error al listar mesas:', error);
    res.status(500).json({ error: 'Error interno al obtener mesas' });
  }
});

/** GET /api/mesas/:id/pedidos — historial de la mesa (o su grupo completo) */
router.get('/:id/pedidos', (req, res) => {
  const { id } = req.params;
  try {
    const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(id);
    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    const miembros = obtenerMiembrosGrupo(mesa.id);
    const placeholders = miembros.map(() => '?').join(',');
    const pedidos = db.prepare(`
      SELECT * FROM pedidos WHERE mesa_id IN (${placeholders}) ORDER BY created_at DESC
    `).all(...miembros);

    const getItems = db.prepare('SELECT * FROM detalle_pedido WHERE pedido_id = ?');
    for (const p of pedidos) p.items = getItems.all(p.id);

    const grupo = mesa.grupo_id ? db.prepare('SELECT * FROM mesa_grupos WHERE id = ?').get(mesa.grupo_id) : null;

    res.json({ mesa, grupo, pedidos });
  } catch (error) {
    console.error('Error al obtener historial de mesa:', error);
    res.status(500).json({ error: 'Error interno al obtener historial de mesa' });
  }
});

/** POST /api/mesas — crear mesa nueva (admin) */
router.post('/', requireAdmin, (req, res) => {
  const { numero, nombre = null, x = 0, y = 0, capacidad = 4 } = req.body;
  if (!numero) return res.status(400).json({ error: 'numero es obligatorio' });
  try {
    const r = db.prepare('INSERT INTO mesas (numero, nombre, x, y, capacidad) VALUES (?, ?, ?, ?, ?)')
      .run(numero, nombre, x, y, capacidad);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: `Ya existe una mesa con el número ${numero}` });
    }
    console.error('Error al crear mesa:', error);
    res.status(500).json({ error: 'Error interno al crear mesa' });
  }
});

/** PUT /api/mesas/:id — mover / renombrar / cambiar capacidad (admin) */
router.put('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(id);
  if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

  const nombre    = req.body.nombre    !== undefined ? req.body.nombre    : mesa.nombre;
  const x         = req.body.x         !== undefined ? req.body.x         : mesa.x;
  const y         = req.body.y         !== undefined ? req.body.y         : mesa.y;
  const capacidad = req.body.capacidad !== undefined ? req.body.capacidad : mesa.capacidad;

  try {
    db.prepare('UPDATE mesas SET nombre = ?, x = ?, y = ?, capacidad = ? WHERE id = ?')
      .run(nombre, x, y, capacidad, id);
    res.json({ message: 'Mesa actualizada' });
  } catch (error) {
    console.error('Error al actualizar mesa:', error);
    res.status(500).json({ error: 'Error interno al actualizar mesa' });
  }
});

/** PATCH /api/mesas/:id/liberar — override manual para destrabar un estado (admin) */
router.patch('/:id/liberar', requireAdmin, (req, res) => {
  const { id } = req.params;
  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(id);
  if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

  try {
    const miembros = obtenerMiembrosGrupo(mesa.id);
    const updateMesa = db.prepare('UPDATE mesas SET estado = ? WHERE id = ?');
    const liberar = db.transaction(() => {
      for (const mid of miembros) updateMesa.run('libre', mid);
      if (mesa.grupo_id) db.prepare('UPDATE mesa_grupos SET estado = ? WHERE id = ?').run('libre', mesa.grupo_id);
    });
    liberar();

    const io = req.app.get('io');
    if (io) for (const mid of miembros) io.emit('mesa_actualizada', { id: mid, mesa_id: mid, estado: 'libre' });

    res.json({ message: 'Mesa liberada manualmente' });
  } catch (error) {
    console.error('Error al liberar mesa:', error);
    res.status(500).json({ error: 'Error interno al liberar mesa' });
  }
});

/** DELETE /api/mesas/:id — eliminar (admin), preserva historial */
router.delete('/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const mesa = db.prepare('SELECT * FROM mesas WHERE id = ?').get(id);
  if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

  if (mesa.grupo_id) {
    return res.status(409).json({ error: 'Esta mesa está fusionada — sepárala del grupo antes de eliminarla' });
  }
  const conPedidos = db.prepare('SELECT COUNT(*) as n FROM pedidos WHERE mesa_id = ?').get(id);
  if (conPedidos.n > 0) {
    return res.status(409).json({ error: 'No se puede eliminar: esta mesa tiene historial de pedidos' });
  }

  try {
    db.prepare('DELETE FROM mesas WHERE id = ?').run(id);
    res.json({ message: 'Mesa eliminada' });
  } catch (error) {
    console.error('Error al eliminar mesa:', error);
    res.status(500).json({ error: 'Error interno al eliminar mesa' });
  }
});

/** POST /api/mesas/merge — fusionar 2+ mesas en un solo grupo/cuenta (admin) */
router.post('/merge', requireAdmin, (req, res) => {
  const { mesa_ids = [], mesa_principal_id = null, nombre = null } = req.body;
  if (!Array.isArray(mesa_ids) || mesa_ids.length < 2) {
    return res.status(400).json({ error: 'Se requieren al menos 2 mesas para fusionar' });
  }

  const mesas = db.prepare(`SELECT * FROM mesas WHERE id IN (${mesa_ids.map(() => '?').join(',')})`).all(...mesa_ids);
  if (mesas.length !== mesa_ids.length) {
    return res.status(404).json({ error: 'Alguna de las mesas no existe' });
  }
  if (mesas.some((m) => m.grupo_id)) {
    return res.status(409).json({ error: 'Alguna de las mesas ya está fusionada en otro grupo' });
  }

  // No permitir fusionar si más de una mesa ya tiene un pedido activo propio —
  // combinar dos cuentas vivas distintas es ambiguo y debe resolverse a mano primero.
  const activos = db.prepare(`
    SELECT mesa_id, COUNT(*) as n FROM pedidos
    WHERE mesa_id IN (${mesa_ids.map(() => '?').join(',')})
      AND estado IN (${ESTADOS_NO_TERMINALES.map(() => '?').join(',')})
    GROUP BY mesa_id
  `).all(...mesa_ids, ...ESTADOS_NO_TERMINALES);

  if (activos.length > 1) {
    return res.status(409).json({ error: 'Más de una de estas mesas ya tiene un pedido activo — resuélvelo antes de fusionar' });
  }

  // Si una mesa ya tiene pedido activo, la fusión debe anclarse ahí (continuidad de la cuenta).
  const principal = activos.length === 1
    ? activos[0].mesa_id
    : (mesa_principal_id && mesa_ids.includes(mesa_principal_id) ? mesa_principal_id : mesa_ids[0]);

  try {
    const crear = db.transaction(() => {
      const r = db.prepare('INSERT INTO mesa_grupos (mesa_principal_id, nombre) VALUES (?, ?)')
        .run(principal, nombre);
      const grupoId = r.lastInsertRowid;
      const updateMesa = db.prepare('UPDATE mesas SET grupo_id = ? WHERE id = ?');
      for (const mid of mesa_ids) updateMesa.run(grupoId, mid);
      return grupoId;
    });
    const grupoId = crear();
    sincronizarEstadoMesa(principal, req.app.get('io'));
    res.status(201).json({ grupo_id: grupoId, mesa_principal_id: principal });
  } catch (error) {
    console.error('Error al fusionar mesas:', error);
    res.status(500).json({ error: 'Error interno al fusionar mesas' });
  }
});

/** POST /api/mesas/grupos/:id/unmerge — separar un grupo (admin) */
router.post('/grupos/:id/unmerge', requireAdmin, (req, res) => {
  const { id } = req.params;
  const grupo = db.prepare('SELECT * FROM mesa_grupos WHERE id = ?').get(id);
  if (!grupo) return res.status(404).json({ error: 'Grupo no encontrado' });

  try {
    const miembros = db.prepare('SELECT id FROM mesas WHERE grupo_id = ?').all(id).map((m) => m.id);
    const separar = db.transaction(() => {
      db.prepare('UPDATE mesas SET grupo_id = NULL WHERE grupo_id = ?').run(id);
      db.prepare('DELETE FROM mesa_grupos WHERE id = ?').run(id);
    });
    separar();

    // El pedido compartido (si existe) se queda en la mesa principal — las demás
    // mesas del ex-grupo vuelven a estar libres e independientes, sin ese historial.
    const io = req.app.get('io');
    for (const mid of miembros) sincronizarEstadoMesa(mid, io);

    res.json({ message: 'Mesas separadas', mesa_principal_id: grupo.mesa_principal_id });
  } catch (error) {
    console.error('Error al separar mesas:', error);
    res.status(500).json({ error: 'Error interno al separar mesas' });
  }
});

export default router;
