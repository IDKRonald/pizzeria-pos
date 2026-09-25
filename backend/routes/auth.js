// backend/routes/auth.js
// Autenticación por PIN — acceso rápido tipo caja registradora

import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

/**
 * POST /api/auth/login
 * Body: { pin: "0000" }
 * Responde: { id, nombre, rol } o 401
 */
router.post('/login', (req, res) => {
  const { pin } = req.body;

  if (!pin || typeof pin !== 'string' || pin.length !== 4) {
    return res.status(400).json({ error: 'PIN debe ser de 4 dígitos' });
  }

  const usuario = db.prepare(
    `SELECT id, nombre, rol FROM usuarios WHERE pin = ? AND activo = 1`
  ).get(pin);

  if (!usuario) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  res.json(usuario);
});

export default router;
