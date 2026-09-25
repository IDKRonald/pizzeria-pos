// backend/server.js
// Entry point — Express + Socket.io + SQLite
// Ejecutar: node server.js (o npm run dev para --watch)

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import db from './db/connection.js';            // Inicializa BD + schema
import './db/seed.js';                          // Seed automático si BD vacía
import apiRouter from './routes/index.js';
import { registerSocketHandlers } from './sockets/handlers.js';

const PORT = process.env.PORT || 3001;

// ── Express ──────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',   // Vite dev server
    'http://localhost:4173',   // Vite preview
    /^http:\/\/192\.168\./,    // Red local (celulares/tablets)
  ],
  credentials: true,
}));
app.use(express.json());

// ── Rutas API ────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── Archivos estáticos (imágenes subidas) ────────────────────
// GET /uploads/<filename> → devuelve la imagen guardada en backend/uploads/
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── HTTP + Socket.io ─────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      /^http:\/\/192\.168\./,
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Registrar handlers de WebSocket
registerSocketHandlers(io);

// Hacer 'io' accesible desde los controladores de Express
app.set('io', io);

// ── Arranque ─────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  const walMode = db.pragma('journal_mode', { simple: true });
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🍕 Don Peñolinni POS — Backend Server     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║   Puerto:     ${PORT}                          ║`);
  console.log(`║   SQLite WAL: ${walMode}                          ║`);
  console.log(`║   API:        http://localhost:${PORT}/api       ║`);
  console.log(`║   WebSocket:  ws://localhost:${PORT}             ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

// Exportar para testing futuro
export { app, io, httpServer };
