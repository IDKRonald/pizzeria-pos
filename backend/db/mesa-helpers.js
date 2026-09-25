// backend/db/mesa-helpers.js
// Lógica compartida para mesas fusionadas (grupos) y sincronización de estado.
// Usada por routes/mesas.js y routes/pedidos.js para que el comportamiento
// sea idéntico sin importar desde qué endpoint se dispare un cambio.

import db from './connection.js';

/**
 * Devuelve el id de la mesa que debe recibir un pedido NUEVO para `mesaId`.
 * Si la mesa pertenece a un grupo (fusionada), los pedidos nuevos se anclan
 * siempre en mesa_principal_id — así todo el grupo comparte una sola cuenta.
 */
export function resolverMesaParaNuevoPedido(mesaId) {
  if (!mesaId) return mesaId;
  const mesa = db.prepare('SELECT grupo_id FROM mesas WHERE id = ?').get(mesaId);
  if (!mesa || !mesa.grupo_id) return mesaId;
  const grupo = db.prepare('SELECT mesa_principal_id FROM mesa_grupos WHERE id = ?').get(mesa.grupo_id);
  return grupo ? grupo.mesa_principal_id : mesaId;
}

/**
 * Devuelve todos los ids de mesa que comparten grupo con `mesaId` (incluyéndola).
 * Si la mesa está libre (sin grupo), devuelve solo [mesaId].
 * Se usa para buscar el historial de pedidos de una mesa fusionada: un pedido
 * puede haber quedado registrado en cualquier mesa miembro, no solo la principal.
 */
export function obtenerMiembrosGrupo(mesaId) {
  if (!mesaId) return [mesaId];
  const mesa = db.prepare('SELECT grupo_id FROM mesas WHERE id = ?').get(mesaId);
  if (!mesa || !mesa.grupo_id) return [mesaId];
  return db.prepare('SELECT id FROM mesas WHERE grupo_id = ?').all(mesa.grupo_id).map((m) => m.id);
}

const ESTADOS_NO_TERMINALES = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

/**
 * Recalcula el estado agregado de la mesa (o su grupo completo) a partir de
 * sus pedidos activos, lo escribe en todas las mesas miembro + mesa_grupos,
 * y emite `mesa_actualizada` por socket para que todos los dispositivos
 * (mesero, admin, cajero, cocina) vean el diagrama actualizado en vivo.
 *
 * Precedencia (la más alta gana): lista > en_preparacion > ocupada > por_pagar > libre.
 * Debe llamarse después de CUALQUIER escritura que pueda cambiar el estado de
 * un pedido (crear, editar, avanzar en KDS) — es la única fuente de verdad
 * para mesas.estado, reemplazando los UPDATE mesas sueltos que había antes.
 */
export function sincronizarEstadoMesa(mesaId, io) {
  if (!mesaId) return;
  const miembros = obtenerMiembrosGrupo(mesaId);
  const placeholders = miembros.map(() => '?').join(',');

  const pedidosActivos = db.prepare(`
    SELECT estado FROM pedidos
    WHERE mesa_id IN (${placeholders}) AND estado IN (${ESTADOS_NO_TERMINALES.map(() => '?').join(',')})
  `).all(...miembros, ...ESTADOS_NO_TERMINALES);

  let nuevoEstado = 'libre';
  if (pedidosActivos.some((p) => p.estado === 'listo')) nuevoEstado = 'lista';
  else if (pedidosActivos.some((p) => p.estado === 'en_preparacion')) nuevoEstado = 'en_preparacion';
  else if (pedidosActivos.some((p) => p.estado === 'pendiente')) nuevoEstado = 'ocupada';
  else if (pedidosActivos.some((p) => p.estado === 'entregado')) nuevoEstado = 'por_pagar';

  const updateMesa = db.prepare('UPDATE mesas SET estado = ? WHERE id = ?');
  const actualizar = db.transaction(() => {
    for (const id of miembros) updateMesa.run(nuevoEstado, id);
    const mesa = db.prepare('SELECT grupo_id FROM mesas WHERE id = ?').get(mesaId);
    if (mesa?.grupo_id) {
      db.prepare('UPDATE mesa_grupos SET estado = ? WHERE id = ?').run(nuevoEstado, mesa.grupo_id);
    }
  });
  actualizar();

  if (io) {
    for (const id of miembros) {
      io.emit('mesa_actualizada', { id, mesa_id: id, estado: nuevoEstado });
    }
  }

  return nuevoEstado;
}
