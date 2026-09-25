// backend/routes/uploads.js
// Subida de imágenes para productos y categorías.
// Las imágenes se guardan en backend/uploads/ y se sirven como estáticos
// por Express en /uploads/<filename>.

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { UPLOADS_DIR } from '../paths.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpg, png, webp, gif, avif)'));
  },
});

const router = Router();

/**
 * POST /api/uploads/imagen
 * Sube una imagen y devuelve la URL pública: { url: "/uploads/<filename>" }
 */
router.post('/imagen', upload.single('imagen'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });
  const url = `/uploads/${req.file.filename}`;
  res.status(201).json({ url });
});

export default router;
