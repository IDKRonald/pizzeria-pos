// backend/routes/index.js
// Router base — endpoints REST del API

import { Router } from 'express';
import { networkInterfaces } from 'os';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
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
import adminRouter from './admin.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// GET /api/version → versión instalada (para el banner de actualización y el actualizador)
router.get('/version', (_req, res) => {
  res.json({ version });
});

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

// GET /api/red-local → IPs LAN reales de esta PC (para el QR de "conectar dispositivo").
// Mucho más confiable que detectarla desde el navegador: Chrome/Edge suelen ocultar
// la IP real por WebRTC detrás de un nombre mDNS (*.local) por privacidad.
router.get('/red-local', (_req, res) => {
  const nombresIgnorados = /virtualbox|vmware|hyper-v|wsl|tailscale|loopback|zerotier/i;
  const candidatas = [];
  for (const [nombre, direcciones] of Object.entries(networkInterfaces())) {
    if (nombresIgnorados.test(nombre)) continue;
    for (const dir of direcciones || []) {
      if (dir.family === 'IPv4' && !dir.internal) candidatas.push({ interfaz: nombre, ip: dir.address });
    }
  }
  // Preferir rangos típicos de red doméstica/local (192.168.x / 10.x / 172.16-31.x)
  // Rangos que suelen ser redes virtuales (VirtualBox/VMware host-only), no la red real
  const esRangoVirtualComun = (ip) => /^192\.168\.56\./.test(ip) || /^192\.168\.99\./.test(ip);
  const esPrivadaComun = (ip) => /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
  const puntaje = (ip) => (esRangoVirtualComun(ip) ? 0 : esPrivadaComun(ip) ? 2 : 1);
  candidatas.sort((a, b) => puntaje(b.ip) - puntaje(a.ip));

  res.json({ ips: candidatas, port: process.env.PORT || 3001 });
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
router.use('/admin', adminRouter);
router.use('/', productosRouter);   // /api/productos, /api/categorias

export default router;
