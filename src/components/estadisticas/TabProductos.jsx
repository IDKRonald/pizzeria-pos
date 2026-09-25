// src/components/estadisticas/TabProductos.jsx
import { useState, useCallback } from 'react';
import { getProductosMasVendidos } from '../../lib/api';
import SelectorRango from './SelectorRango';

const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function TabProductos() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(({ desde, hasta }) => {
    setCargando(true);
    getProductosMasVendidos({ desde, hasta, limite: 20 })
      .then((d) => { setProductos(d.productos); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Productos más vendidos</h2>
      <SelectorRango onChange={cargar} />

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : productos.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>Sin ventas registradas en este período.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1a1a26' }}>
                {['#', 'Producto', 'Unidades', 'Ingresos'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productos.map((p, idx) => (
                <tr key={`${p.producto_id}-${p.variante_id}`} style={{ borderTop: '1px solid #2a2a3a' }}>
                  <td className="px-3 py-2" style={{ color: '#64748b' }}>{idx + 1}</td>
                  <td className="px-3 py-2 font-semibold text-white">
                    {p.nombre}{p.nombre_tamanio ? ` · ${p.nombre_tamanio}` : ''}
                  </td>
                  <td className="px-3 py-2 font-bold" style={{ color: '#fbbf24' }}>{p.unidades_vendidas}</td>
                  <td className="px-3 py-2 font-bold text-emerald-400">{formatCOP(p.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
