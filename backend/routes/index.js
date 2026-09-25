// backend/routes/index.js
// Router base — endpoints REST del API

import { Router } from 'express';
import db from '../db/connection.js';
import authRouter from './auth.js';
import productosRouter from './productos.js';
import pedidosRouter from './pedidos.js';
import mesasRouter from './mesas.js';
import inventarioRouter from './inventario.js';
import combosRouter from './combos.js';
import cajaRouter from './caja.js';
import estadisticasRouter from './estadisticas.js';
import uploadsRouter from './uploads.js';

const router = Router();

// ── Health check ─────────────────────────────────────────────
// GET /api/health → Verifica que el servidor y la BD están activos
router.get('/health', (_req, res) => {
  try {
    const row = db.prepare(`SELECT COUNT(*) as productos FROM productos`).get();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: {
        connected: true,
        productos: row.productos,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
});

// ── Rutas de módulos ─────────────────────────────────────────
router.use('/auth', authRouter);
router.use('/pedidos', pedidosRouter);
router.use('/mesas', mesasRouter);
router.use('/inventario', inventarioRouter);
router.use('/combos', combosRouter);
router.use('/caja', cajaRouter);
router.use('/estadisticas', estadisticasRouter);
router.use('/uploads', uploadsRouter);
router.use('/', productosRouter);   // /api/productos, /api/categorias

export default router;
