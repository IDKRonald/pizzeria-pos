// src/lib/socket.js
// Singleton de Socket.io client — conexión al backend en tiempo real

import { io } from 'socket.io-client';

// Misma lógica de detección que api.js
const SOCKET_URL = `http://${window.location.hostname}:3001`;

/**
 * Instancia singleton del socket.
 * autoConnect: false → se conecta manualmente después del login.
 */
const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

// Logging en desarrollo
socket.on('connect', () => {
  console.log('🔌 Socket.io conectado:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket.io desconectado:', reason);
});

socket.on('connect_error', (err) => {
  console.warn('⚠️ Socket.io error de conexión:', err.message);
});

export default socket;
