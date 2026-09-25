// backend/sockets/handlers.js
// Handlers de eventos Socket.io para comunicación en tiempo real.
// Salas: sala_cocina, sala_caja, sala_mesas

/**
 * Registra todos los event handlers de WebSocket.
 * @param {import('socket.io').Server} io - Instancia de Socket.io
 */
export function registerSocketHandlers(io) {

  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // ── Unirse a una sala según el rol ──────────────────────
    // El cliente emite: socket.emit('unirse_sala', 'cocina')
    socket.on('unirse_sala', (sala) => {
      const salaName = `sala_${sala}`;
      socket.join(salaName);
      console.log(`  📍 ${socket.id} se unió a ${salaName}`);
    });

    // ── nuevo_pedido ────────────────────────────────────────
    // Emitido por: POS / Toma de Pedidos
    // Destino: KDS (cocina) + actualización de mesa
    socket.on('nuevo_pedido', (data) => {
      console.log(`  📝 Nuevo pedido: #${data.numero_orden}`);
      io.to('sala_cocina').emit('nuevo_pedido', data);
      io.to('sala_mesas').emit('mesa_actualizada', {
        mesa_id: data.mesa_id,
        estado: 'ocupada',
      });
      // También notificar a caja para que vea el pedido en cola
      io.to('sala_caja').emit('nuevo_pedido', data);
    });

    // ── pedido_en_preparacion ───────────────────────────────
    // Emitido por: KDS (cocina toca "Preparando")
    // Destino: Caja y Meseros
    socket.on('pedido_en_preparacion', (data) => {
      console.log(`  🔥 Pedido en preparación: #${data.numero_orden}`);
      io.to('sala_caja').emit('pedido_en_preparacion', data);
      io.to('sala_mesas').emit('mesa_actualizada', {
        mesa_id: data.mesa_id,
        estado: 'en_preparacion',
      });
    });

    // ── pedido_listo ────────────────────────────────────────
    // Emitido por: KDS (cocina toca "Listo")
    // Destino: Caja y Meseros — notificación de servir
    socket.on('pedido_listo', (data) => {
      console.log(`  ✅ Pedido listo: #${data.numero_orden}`);
      io.to('sala_caja').emit('pedido_listo', data);
      io.to('sala_mesas').emit('mesa_actualizada', {
        mesa_id: data.mesa_id,
        estado: 'lista',
      });
    });

    // ── mesa_actualizada ────────────────────────────────────
    // Emitido por: Gestor de mesas (drag & drop, cambio manual)
    // Destino: Broadcast a todos
    socket.on('mesa_actualizada', (data) => {
      console.log(`  🪑 Mesa actualizada: #${data.mesa_id} → ${data.estado}`);
      socket.broadcast.emit('mesa_actualizada', data);
    });

    // ── alerta_inventario ───────────────────────────────────
    // Emitido por: Backend al detectar stock bajo
    // Destino: Caja (para alertar al momento de vender)
    socket.on('alerta_inventario', (data) => {
      console.log(`  ⚠️  Alerta inventario: ${data.insumo} — stock bajo`);
      io.to('sala_caja').emit('alerta_inventario', data);
    });

    // ── Desconexión ─────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Cliente desconectado: ${socket.id} (${reason})`);
    });
  });
}
