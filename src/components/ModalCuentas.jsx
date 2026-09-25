import { useState, useEffect } from 'react';
import { getPedidosPendientes } from '../lib/api';

const formatCOP = (valor) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function ModalCuentas({ onCerrar, onSeleccionar }) {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let mounted = true;
    getPedidosPendientes()
      .then((data) => {
        if (!mounted) return;
        // Filtrar pedidos que aún no han sido cobrados totalmente o que no han sido entregados
        const activos = (data || []).filter((p) => p.estado !== 'cancelado' && (p.estado !== 'entregado' || p.monto_pagado < p.total));
        setPedidos(activos);
      })
      .catch((err) => console.error('Error cargando cuentas:', err))
      .finally(() => {
        if (mounted) setCargando(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div
        className="w-full max-w-2xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surf3)', border: '1px solid var(--border-1)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-2)', background: 'var(--bg-surf4)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧾</span>
            <h2 className="text-xl font-bold text-white tracking-tight">Cuentas Abiertas</h2>
          </div>
          <button
            onClick={onCerrar}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium" style={{ color: 'var(--text-4)' }}>Cargando cuentas...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-4xl">😴</span>
              <p className="text-base font-bold text-white">No hay cuentas abiertas</p>
            </div>
          ) : (
            pedidos.map((pedido) => {
              // Estilos según el estado
              let stateBg = 'bg-blue-500/20';
              let stateText = 'text-blue-400';
              let stateBorder = 'border-blue-500/30';
              let stateIcon = '⏳';
              
              if (pedido.estado === 'en_preparacion') {
                stateBg = 'bg-orange-500/20'; stateText = 'text-orange-400'; stateBorder = 'border-orange-500/30'; stateIcon = '🔥';
              } else if (pedido.estado === 'listo') {
                stateBg = 'bg-emerald-500/20'; stateText = 'text-emerald-400'; stateBorder = 'border-emerald-500/30'; stateIcon = '✅';
              } else if (pedido.estado === 'entregado') {
                stateBg = 'bg-purple-500/20'; stateText = 'text-purple-400'; stateBorder = 'border-purple-500/30'; stateIcon = '🍽️';
              }

              return (
                <button
                  key={pedido.id}
                  onClick={() => onSeleccionar(pedido)}
                  className="w-full flex items-center justify-between p-4 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] focus:outline-none"
                  style={{ background: 'var(--bg-surf5)', border: '1px solid var(--border-2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-white">{pedido.numero_orden}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${stateBg} ${stateText} ${stateBorder}`}>
                        {stateIcon} {pedido.estado.replace('_', ' ').toUpperCase()}
                      </span>
                      {pedido.mesa_id ? (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/10 text-white border border-white/20">
                          🪑 MESA {pedido.mesa_numero || pedido.mesa_id}{pedido.grupo_nombre ? ` (${pedido.grupo_nombre})` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/10 text-white border border-white/20">
                          {pedido.tipo === 'domicilio' ? '🛵 DOMICILIO' : '🛍️ LLEVAR'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-4)' }}>
                      {pedido.items.length} productos · Creado a las {new Date(pedido.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  
                  <div className="text-right flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-4)' }}>Total</span>
                      <span className="text-xl font-extrabold text-emerald-400 tabular-nums leading-none">
                        {formatCOP(pedido.total)}
                      </span>
                      {pedido.monto_pagado > 0 && pedido.monto_pagado < pedido.total && (
                        <span className="text-[10px] font-bold text-red-400 mt-1">Faltan {formatCOP(pedido.total - pedido.monto_pagado)}</span>
                      )}
                      {pedido.monto_pagado >= pedido.total && (
                        <span className="text-[10px] font-bold text-emerald-400 mt-1">✓ Pagado</span>
                      )}
                    </div>
                    <span className="text-xl opacity-50">›</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
