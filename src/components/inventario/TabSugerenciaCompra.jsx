// src/components/inventario/TabSugerenciaCompra.jsx
import { useState, useEffect, useCallback } from 'react';
import { getSugerenciaCompra } from '../../lib/api';

function construirMensaje(grupo) {
  const lineas = grupo.items.map((i) => `- ${i.nombre}: ${i.cantidad_sugerida} ${i.unidad}`);
  return `Hola ${grupo.proveedor_nombre}, necesito hacer un pedido:\n\n${lineas.join('\n')}\n\n¡Gracias!`;
}

function waLinkConMensaje(telefono, mensaje) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (!digitos) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

export default function TabSugerenciaCompra() {
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    getSugerenciaCompra().then((d) => { setGrupos(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Sugerencia de compra</h2>
      <p className="text-xs" style={{ color: '#64748b' }}>
        Insumos que ya llegaron a su stock mínimo, agrupados por proveedor, con la cantidad sugerida para llegar al stock máximo.
      </p>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : grupos.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>✓ Ningún insumo está en su punto de reorden por ahora.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {grupos.map((g) => (
            <div key={g.proveedor_id || 'sin_proveedor'} className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-white">{g.proveedor_nombre}</p>
                {g.proveedor_telefono && (
                  <a href={waLinkConMensaje(g.proveedor_telefono, construirMensaje(g))} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#059669' }}>
                    💬 Enviar pedido
                  </a>
                )}
              </div>
              {!g.proveedor_id && (
                <p className="text-[11px] mb-2" style={{ color: '#f87171' }}>Sin proveedor asignado — asígnalo en Insumos para poder enviar el pedido por WhatsApp.</p>
              )}
              <div className="space-y-1">
                {g.items.map((i) => (
                  <div key={i.insumo_id} className="flex items-center justify-between text-sm">
                    <span style={{ color: '#e2e8f0' }}>{i.nombre}</span>
                    <span className="font-bold" style={{ color: '#fbbf24' }}>
                      {i.cantidad_sugerida} {i.unidad} <span className="text-xs font-normal" style={{ color: '#64748b' }}>(quedan {i.stock_actual})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
