// src/components/PanelDetalleMesa.jsx
// Panel lateral: historial de pedidos de una mesa (o de todo su grupo si está
// fusionada) y las acciones para tomar/editar/cobrar desde el diagrama.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getPedidosDeMesa, separarMesas, liberarMesa } from '../lib/api';

const formatCOP = (v) =>
  (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const ESTADO_BADGE = {
  pendiente:      { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500/30',    icon: '⏳' },
  en_preparacion: { bg: 'bg-orange-500/20',  text: 'text-orange-400',  border: 'border-orange-500/30',  icon: '🔥' },
  listo:          { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: '✅' },
  entregado:      { bg: 'bg-purple-500/20',  text: 'text-purple-400',  border: 'border-purple-500/30',  icon: '🍽️' },
  pagado:         { bg: 'bg-gray-500/20',    text: 'text-gray-400',    border: 'border-gray-500/30',    icon: '💵' },
  cancelado:      { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500/30',     icon: '✕' },
};

function TarjetaPedido({ pedido, accion }) {
  const badge = ESTADO_BADGE[pedido.estado] || ESTADO_BADGE.pendiente;
  return (
    <div className="p-3 rounded-xl" style={{ background: '#1e1e2d', border: '1px solid #2a2a3a' }}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2">
          <span className="font-black text-white">{pedido.numero_orden}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
            {badge.icon} {pedido.estado.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <span className="text-sm font-extrabold text-emerald-400">{formatCOP(pedido.total)}</span>
      </div>
      <p className="text-xs mb-2" style={{ color: '#64748b' }}>
        {pedido.items.map((i) => `${i.cantidad}× ${i.nombre_display}`).join(', ')}
      </p>
      {accion}
    </div>
  );
}

export default function PanelDetalleMesa({ mesaId, puedeEditar, onCerrar, onCambio }) {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    getPedidosDeMesa(mesaId)
      .then((d) => { setDatos(d); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [mesaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const irAPos = (pedido, modo) => {
    if (!datos) return;
    navigate('/pos', {
      state: {
        mesaId: datos.mesa.id,
        mesaNumero: datos.mesa.numero,
        mesaNombre: datos.mesa.nombre,
        grupoNombre: datos.grupo?.nombre || null,
        pedido: pedido || undefined,
        modo: pedido ? modo : undefined,
      },
    });
  };

  const handleSepararMesas = async () => {
    if (!datos?.grupo) return;
    if (!confirm('Al separar, el pedido compartido se queda en la mesa principal y las demás quedan libres sin ese historial. ¿Continuar?')) return;
    try {
      await separarMesas(datos.grupo.id, usuario.id);
      onCambio?.();
      onCerrar();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLiberar = async () => {
    if (!confirm('Esto fuerza el estado de la mesa a "libre" manualmente. ¿Continuar?')) return;
    try {
      await liberarMesa(mesaId, usuario.id);
      onCambio?.();
      cargar();
    } catch (err) {
      alert(err.message);
    }
  };

  const pedidos = datos?.pedidos || [];
  const pendiente = pedidos.find((p) => p.estado === 'pendiente');
  const enCurso = pedidos.filter((p) => ['en_preparacion', 'listo', 'entregado'].includes(p.estado));
  const sinPedidosActivos = !pendiente && enCurso.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full flex flex-col shadow-2xl"
        style={{ background: '#13131b', borderLeft: '1px solid #2a2a3a' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #2a2a3a' }}>
          <div>
            <h2 className="text-lg font-bold text-white">
              {datos ? `Mesa ${datos.mesa.numero}${datos.grupo ? ` (${datos.grupo.nombre || 'fusionada'})` : ''}` : 'Mesa'}
            </h2>
            {datos?.mesa?.nombre && <p className="text-xs" style={{ color: '#64748b' }}>{datos.mesa.nombre}</p>}
          </div>
          <button onClick={onCerrar} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: '#1e1e2d', color: '#94a3b8' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cargando ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">⚠️ {error}</p>
          ) : (
            <>
              {/* Acciones principales */}
              <div className="space-y-2">
                {pendiente && (
                  <button onClick={() => irAPos(pendiente, 'editar')}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm"
                    style={{ background: 'rgb(249,115,22)' }}>
                    ✏️ Editar pedido pendiente ({pendiente.numero_orden})
                  </button>
                )}
                <button onClick={() => irAPos(null)}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: sinPedidosActivos ? 'rgb(16,185,129)' : '#1e1e2d', border: sinPedidosActivos ? 'none' : '1px solid #2a2a3a' }}>
                  {sinPedidosActivos ? '➕ Nuevo pedido' : '➕ Agregar pedido adicional'}
                </button>
              </div>

              {/* Pedidos ya en cocina / por cobrar — solo lectura + cobrar */}
              {enCurso.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
                    En curso — ya no se pueden editar
                  </h3>
                  <div className="space-y-2">
                    {enCurso.map((p) => (
                      <TarjetaPedido key={p.id} pedido={p}
                        accion={p.monto_pagado < p.total && (
                          <button onClick={() => irAPos(p, 'cobrar')}
                            className="w-full py-2 rounded-lg text-xs font-bold text-white"
                            style={{ background: 'rgb(5,150,105)' }}>
                            💵 Cobrar {p.monto_pagado > 0 ? `(faltan ${formatCOP(p.total - p.monto_pagado)})` : ''}
                          </button>
                        )} />
                    ))}
                  </div>
                </div>
              )}

              {/* Historial completo */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
                  Historial de la mesa
                </h3>
                {pedidos.length === 0 ? (
                  <p className="text-sm" style={{ color: '#64748b' }}>Sin pedidos todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {pedidos.map((p) => <TarjetaPedido key={p.id} pedido={p} />)}
                  </div>
                )}
              </div>

              {/* Acciones admin */}
              {puedeEditar && (
                <div className="pt-2 space-y-2" style={{ borderTop: '1px solid #2a2a3a' }}>
                  {datos?.grupo && (
                    <button onClick={handleSepararMesas}
                      className="w-full py-2 rounded-lg text-xs font-semibold"
                      style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}>
                      🔓 Separar mesas fusionadas
                    </button>
                  )}
                  <button onClick={handleLiberar}
                    className="w-full py-2 rounded-lg text-xs font-semibold"
                    style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}>
                    🔧 Forzar mesa a "libre" (override manual)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
