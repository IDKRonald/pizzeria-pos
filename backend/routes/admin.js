// backend/routes/admin.js
// Utilidades administrativas de alto riesgo (solo admin).
import { Router } from 'express';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import db from '../db/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'db', 'don_penolinni.db');
const BACKUPS_DIR = join(__dirname, '..', 'db', 'backups');

const router = Router();

function requireAdmin(req, res, next) {
  const usuario_id = req.body?.usuario_id || req.query?.usuario_id;
  if (!usuario_id) return res.status(401).json({ error: 'usuario_id es requerido' });
  const usuario = db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuario_id);
  if (!usuario || usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede hacer esto' });
  }
  next();
}

/**
 * POST /api/admin/reset-datos-prueba (admin)
 * Borra TODO el historial transaccional (pedidos, pagos, movimientos de
 * inventario, cierres de caja) y deja mesas libres — pensado para limpiar
 * datos de prueba antes de abrir al público. NO toca productos, categorías,
 * insumos configurados, proveedores ni usuarios.
 * Body: { usuario_id, revertir_stock: boolean, confirmar: 'BORRAR' }
 */
router.post('/reset-datos-prueba', requireAdmin, (req, res) => {
  const { revertir_stock = true, confirmar } = req.body;
  if (confirmar !== 'BORRAR') {
    return res.status(400).json({ error: 'Falta confirmación. Envía confirmar: "BORRAR".' });
  }

  try {
    // ── Respaldo de seguridad antes de tocar nada ──
    if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
    db.pragma('wal_checkpoint(TRUNCATE)');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(BACKUPS_DIR, `pre-reset-${stamp}.db`);
    copyFileSync(DB_PATH, backupPath);

    const resultado = db.transaction(() => {
      const conteoPedidos = db.prepare('SELECT COUNT(*) n FROM pedidos').get().n;

      if (revertir_stock) {
        const deltas = db.prepare(`
          SELECT insumo_id, SUM(cantidad) as delta
          FROM movimientos_inventario
          GROUP BY insumo_id
        `).all();
        const ajustar = db.prepare('UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?');
        for (const d of deltas) ajustar.run(d.delta, d.insumo_id);
      }

      db.exec(`
        DELETE FROM pagos;
        DELETE FROM movimientos_inventario;
        DELETE FROM detalle_pedido;
        DELETE FROM pedidos;
        DELETE FROM cierres_caja;
        UPDATE mesas SET estado = 'libre', grupo_id = NULL;
        DELETE FROM mesa_grupos;
        DELETE FROM sqlite_sequence WHERE name IN
          ('pedidos','detalle_pedido','pagos','movimientos_inventario','cierres_caja','mesa_grupos');
      `);

      return { pedidos_eliminados: conteoPedidos };
    })();

    const io = req.app.get('io');
    if (io) io.emit('datos_reseteados', {});

    res.json({
      message: 'Datos de prueba eliminados correctamente.',
      backup: backupPath,
      ...resultado,
    });
  } catch (error) {
    console.error('Error al resetear datos de prueba:', error);
    res.status(500).json({ error: 'Error interno al resetear datos de prueba' });
  }
});

export default router;
