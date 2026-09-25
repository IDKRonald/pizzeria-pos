// src/pages/KdsPage.jsx
// Kitchen Display System (Cocina) — Recibe pedidos en tiempo real

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getPedidosPendientes, actualizarEstadoPedido } from '../lib/api';
import socket from '../lib/socket';

const formatCOP = (v) =>
  (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const formatHora = (isoStr) => {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export default function KdsPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [pedidos, setPedidos] = useState([]);
  const [horaActual, setHoraActual] = useState(new Date());
  const [pedidoDetalle, setPedidoDetalle] = useState(null); // Modal detalle

  // Reloj en vivo
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar pedidos iniciales
  useEffect(() => {
    let mounted = true;
    getPedidosPendientes()
      .then((data) => {
        if (mounted) {
          const activos = (data || []).filter(p => ['pendiente', 'en_preparacion', 'listo'].includes(p.estado));
          setPedidos(activos);
        }
      })
      .catch((err) => console.error('Error cargando pedidos KDS:', err));
    return () => { mounted = false; };
  }, []);

  // WebSockets: Unirse a sala_cocina + escuchar eventos
  useEffect(() => {
    // Unirse a sala_cocina para recibir todos los pedidos nuevos del sistema
    socket.emit('unirse_sala', 'cocina');

    const onNuevoPedido = (pedido) => {
      if (['pendiente', 'en_preparacion', 'listo'].includes(pedido.estado)) {
        setPedidos((prev) => {
          // Evitar duplicados si el pedido ya existe
          if (prev.find(p => p.id === pedido.id)) return prev;
          return [...prev, { ...pedido, recibidoEn: Date.now() }];
        });
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      }
    };

    const onPedidoActualizado = (updatedData) => {
      const { id, estado } = updatedData;
      if (['entregado', 'pagado', 'cancelado'].includes(estado)) {
        setPedidos((prev) => prev.filter((p) => p.id !== id));
        // Si el modal estaba abierto con este pedido, cerrarlo
        setPedidoDetalle((prev) => (prev?.id === id ? null : prev));
      } else {
        setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, ...updatedData } : p));
        // Actualizar el modal si estaba abierto
        setPedidoDetalle((prev) => (prev?.id === id ? { ...prev, ...updatedData } : prev));
      }
    };

    socket.on('nuevo_pedido', onNuevoPedido);
    socket.on('pedido_actualizado', onPedidoActualizado);
    return () => {
      socket.off('nuevo_pedido', onNuevoPedido);
      socket.off('pedido_actualizado', onPedidoActualizado);
    };
  }, []);

  // Avanzar estado del pedido
  const handleAvanzarEstado = useCallback(async (pedido) => {
    let siguiente = 'en_preparacion';
    if (pedido.estado === 'en_preparacion') siguiente = 'listo';
    else if (pedido.estado === 'listo') siguiente = 'entregado';

    // Optimistic UI update
    if (siguiente === 'entregado') {
      setPedidos((prev) => prev.filter(p => p.id !== pedido.id));
      setPedidoDetalle(null);
    } else {
      setPedidos((prev) => prev.map(p => p.id === pedido.id ? { ...p, estado: siguiente } : p));
      setPedidoDetalle((prev) => (prev?.id === pedido.id ? { ...prev, estado: siguiente } : prev));
    }

    try {
      await actualizarEstadoPedido(pedido.id, siguiente);
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  }, []);

  // Cancelar un pedido ya enviado a cocina (solo admin) — para emergencias de
  // último momento, ej. el cliente se tuvo que ir. Si ya estaba pagado, revierte
  // el descuento de inventario automáticamente (lo hace el backend).
  const handleCancelar = useCallback(async (pedido) => {
    if (!confirm(`¿Cancelar el pedido ${pedido.numero_orden}? Esta acción no se puede deshacer.`)) return;

    setPedidos((prev) => prev.filter(p => p.id !== pedido.id));
    setPedidoDetalle((prev) => (prev?.id === pedido.id ? null : prev));

    try {
      await actualizarEstadoPedido(pedido.id, 'cancelado');
    } catch (err) {
      console.error('Error al cancelar pedido:', err);
      alert('No se pudo cancelar el pedido: ' + (err?.message || 'error desconocido'));
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0f' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid #1e1e2d', background: '#13131b' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/hub')}
            className="w-10 h-10 rounded-xl flex items-center justify-center
                       text-xl transition-colors duration-150 active:scale-95"
            style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}
          >←</button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600
                            flex items-center justify-center text-xl shadow-md">👨‍🍳</div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-none">Cocina (KDS)</h1>
              <p className="text-xs mt-1" style={{ color: '#64748b' }}>
                {pedidos.length} {pedidos.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-orange-400">
            {horaActual.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          <p className="text-xs" style={{ color: '#64748b' }}>{usuario?.nombre}</p>
        </div>
      </header>

      {/* Main Board */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {pedidos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
                 style={{ background: '#13131b', border: '1px dashed #2a2a3a' }}>
              🍳
            </div>
            <p className="text-xl font-bold text-white">Sin pedidos pendientes</p>
            <p className="text-sm" style={{ color: '#64748b' }}>Esperando comandas...</p>
          </div>
        ) : (
          <div className="flex gap-6 h-full items-start">
            {pedidos.map((pedido) => (
              <TicketKDS
                key={pedido.id}
                pedido={pedido}
                onAvanzar={handleAvanzarEstado}
                onVerDetalle={() => setPedidoDetalle(pedido)}
                onCancelar={usuario?.rol === 'admin' ? handleCancelar : null}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal de detalles del pedido */}
      {pedidoDetalle && (
        <ModalDetalleKDS
          pedido={pedidoDetalle}
          onCerrar={() => setPedidoDetalle(null)}
          onAvanzar={handleAvanzarEstado}
          onCancelar={usuario?.rol === 'admin' ? handleCancelar : null}
        />
      )}
    </div>
  );
}

// ── Ticket individual ────────────────────────────────────────────────────────

function TicketKDS({ pedido, onAvanzar, onVerDetalle, onCancelar }) {
  const [minutos, setMinutos] = useState(0);

  // Actualizar timer
  useEffect(() => {
    const update = () => {
      const diffMs = Date.now() - pedido.recibidoEn;
      setMinutos(Math.floor(diffMs / 60000));
    };
    update();
    const timer = setInterval(update, 10000); // Cada 10s
    return () => clearInterval(timer);
  }, [pedido.recibidoEn]);

  // Colores de alerta según el tiempo
  let alertColor = 'text-emerald-400';
  let bgColor = '#13131b';
  let borderColor = '#2a2a3a';

  if (minutos >= 15) {
    alertColor = 'text-red-400';
    borderColor = 'rgba(239,68,68,0.5)';
    bgColor = 'rgba(239,68,68,0.05)';
  } else if (minutos >= 8) {
    alertColor = 'text-amber-400';
    borderColor = 'rgba(245,158,11,0.5)';
  }

  // Total calculado: del payload o suma de items
  const totalCalculado = pedido.total
    || (pedido.items || []).reduce((acc, it) => acc + (it.subtotal || it.precio_unitario * it.cantidad || 0), 0);

  return (
    <div className="shrink-0 w-[320px] max-h-full flex flex-col rounded-2xl shadow-xl overflow-hidden animate-[fadeIn_0.3s_ease-out]"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}>

      {/* Ticket Header */}
      <div className="px-4 py-3 flex justify-between items-start"
           style={{ borderBottom: '1px dashed #2a2a3a', background: 'rgba(0,0,0,0.2)' }}>
        <div>
          <h2 className="text-xl font-black text-white">{pedido.numero_orden}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-bold ${alertColor}`}>⏱️ {minutos} min</span>
            <span className="text-xs" style={{ color: '#64748b' }}>{formatHora(pedido.timestamp)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {pedido.tipo === 'mesa' ? (
            <div className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs font-bold uppercase">
              Mesa {pedido.mesa_id}
            </div>
          ) : pedido.tipo === 'domicilio' ? (
            <div className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded text-xs font-bold uppercase">
              🛵 Domicilio
            </div>
          ) : (
            <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-xs font-bold uppercase">
              Para llevar
            </div>
          )}
          {/* Total visible en el ticket */}
          <span className="text-xs font-bold text-white/60">
            {(0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).replace('0', totalCalculado.toLocaleString('es-CO'))}
          </span>
        </div>
      </div>

      {/* Ticket Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {pedido.items.map((item, idx) => (
          <div key={idx} className="flex gap-3 text-base">
            <div className="font-black text-orange-400">{item.cantidad}x</div>
            <div className="flex-1">
              <p className="font-bold text-white leading-tight">{item.nombre_display}</p>
              {item.notas && (
                <p className="text-xs text-red-400 font-bold mt-0.5 bg-red-400/10 inline-block px-1.5 py-0.5 rounded">
                  ⚠️ {item.notas}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2" style={{ borderTop: '1px solid #2a2a3a' }}>
        {/* Botón detalles */}
        <button
          onClick={onVerDetalle}
          className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a3a', color: '#94a3b8' }}
        >
          🔍 Ver detalles y monto
        </button>
        {/* Botón avanzar estado */}
        <button
          onClick={() => onAvanzar(pedido)}
          className="w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg active:scale-95 transition-all"
          style={{
            background: pedido.estado === 'pendiente'
              ? 'linear-gradient(135deg, rgb(249,115,22), rgb(234,88,12))'
              : pedido.estado === 'en_preparacion'
              ? 'linear-gradient(135deg, rgb(16,185,129), rgb(5,150,105))'
              : 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))'
          }}
        >
          {pedido.estado === 'pendiente' ? '👨‍🍳 Iniciar Preparación' :
           pedido.estado === 'en_preparacion' ? '✅ Marcar como Listo' :
           '🛎️ Entregar'}
        </button>
        {/* Cancelación de último momento — solo visible para admin */}
        {onCancelar && (
          <button
            onClick={() => onCancelar(pedido)}
            className="w-full py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
          >
            🗑️ Cancelar pedido
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modal de detalles del pedido ─────────────────────────────────────────────

function ModalDetalleKDS({ pedido, onCerrar, onAvanzar, onCancelar }) {
  const subtotalItems = (pedido.items || []).reduce(
    (acc, it) => acc + (it.subtotal || it.precio_unitario * it.cantidad || 0), 0
  );
  const subtotal  = pedido.subtotal  ?? subtotalItems;
  const propina   = pedido.propina   ?? 0;
  const domicilio = pedido.costo_domicilio ?? 0;
  const total     = pedido.total     ?? (subtotalItems + propina + domicilio);

  const estadoBadge = {
    pendiente:      { label: 'Pendiente',      cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    en_preparacion: { label: 'En preparación', cls: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    listo:          { label: 'Listo',          cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  }[pedido.estado] || { label: pedido.estado, cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-[fadeIn_0.2s_ease-out]"
        style={{ background: '#13131b', border: '1px solid #2a2a3a', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-5 py-4"
             style={{ borderBottom: '1px solid #2a2a3a', background: 'rgba(0,0,0,0.3)' }}>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-white">{pedido.numero_orden}</h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${estadoBadge.cls}`}>
                {estadoBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: '#64748b' }}>
              {pedido.tipo === 'mesa' && <span>🪑 Mesa {pedido.mesa_id}</span>}
              {pedido.tipo === 'domicilio' && <span>🛵 Domicilio</span>}
              {pedido.tipo === 'mostrador' && <span>🏪 Para llevar</span>}
              {pedido.timestamp && <span>· {new Date(pedido.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          </div>
          <button
            onClick={onCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold flex-shrink-0"
            style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}
          >✕</button>
        </div>

        {/* Items detallados */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>
            Ítems del pedido
          </p>
          {(pedido.items || []).map((item, idx) => {
            const itemSubtotal = item.subtotal || item.precio_unitario * item.cantidad || 0;
            return (
              <div key={idx} className="flex items-start gap-3 py-2.5 rounded-xl px-3"
                   style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e2d' }}>
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center
                                text-sm font-black text-orange-400 flex-shrink-0">
                  {item.cantidad}x
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm leading-tight">{item.nombre_display}</p>
                  {item.notas && (
                    <p className="text-xs text-red-400 font-bold mt-1 bg-red-400/10 px-1.5 py-0.5 rounded inline-block">
                      ⚠️ {item.notas}
                    </p>
                  )}
                  {item.precio_unitario > 0 && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>
                      {item.cantidad} × {formatCOP(item.precio_unitario)}
                    </p>
                  )}
                </div>
                {itemSubtotal > 0 && (
                  <span className="text-sm font-bold text-white/80 flex-shrink-0">
                    {formatCOP(itemSubtotal)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Totales */}
        <div className="px-5 py-4 space-y-2" style={{ borderTop: '1px solid #2a2a3a', background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex justify-between text-sm" style={{ color: '#64748b' }}>
            <span>Subtotal</span>
            <span className="font-medium text-white/70">{formatCOP(subtotal)}</span>
          </div>
          {propina > 0 && (
            <div className="flex justify-between text-sm text-orange-400">
              <span>Propina (10%)</span>
              <span className="font-medium">{formatCOP(propina)}</span>
            </div>
          )}
          {domicilio > 0 && (
            <div className="flex justify-between text-sm text-orange-400">
              <span>🛵 Costo domicilio</span>
              <span className="font-medium">{formatCOP(domicilio)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid #2a2a3a' }}>
            <span className="text-base font-bold text-white">Total</span>
            <span className="text-2xl font-extrabold text-emerald-400 tabular-nums">
              {formatCOP(total)}
            </span>
          </div>
        </div>

        {/* Acción */}
        <div className="px-5 pb-5">
          <button
            onClick={() => onAvanzar(pedido)}
            className="w-full py-3.5 rounded-xl font-bold text-base text-white shadow-lg active:scale-95 transition-all"
            style={{
              background: pedido.estado === 'pendiente'
                ? 'linear-gradient(135deg, rgb(249,115,22), rgb(234,88,12))'
                : pedido.estado === 'en_preparacion'
                ? 'linear-gradient(135deg, rgb(16,185,129), rgb(5,150,105))'
                : 'linear-gradient(135deg, rgb(59,130,246), rgb(37,99,235))'
            }}
          >
            {pedido.estado === 'pendiente' ? '👨‍🍳 Iniciar Preparación' :
             pedido.estado === 'en_preparacion' ? '✅ Marcar como Listo' :
             '🛎️ Entregar pedido'}
          </button>
          {/* Cancelación de último momento — solo visible para admin */}
          {onCancelar && (
            <button
              onClick={() => onCancelar(pedido)}
              className="w-full mt-2 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
            >
              🗑️ Cancelar pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
