// src/components/estadisticas/TabRentabilidad.jsx
import { useState, useCallback } from 'react';
import { getRentabilidad } from '../../lib/api';
import SelectorRango from './SelectorRango';

const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function TabRentabilidad() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(({ desde, hasta }) => {
    setCargando(true);
    getRentabilidad({ desde, hasta }).then((d) => { setDatos(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Rentabilidad</h2>
      <p className="text-xs" style={{ color: '#64748b' }}>
        Solo se puede calcular el costo real de los productos que tienen una receta con insumos en modo <strong style={{ color: '#34d399' }}>automático</strong>.
        Todo lo demás (la mayoría de platos con ingredientes servidos a mano) aparece marcado como "costo no disponible" — no se muestra un margen falso.
      </p>
      <SelectorRango onChange={cargar} />

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : datos && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Ingresos totales</p>
              <p className="text-xl font-extrabold text-emerald-400 mt-1">{formatCOP(datos.resumen.ingresos_totales)}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Costo conocido</p>
              <p className="text-xl font-extrabold text-orange-400 mt-1">{formatCOP(datos.resumen.costo_total_conocido)}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Ítems sin costo conocido</p>
              <p className="text-xl font-extrabold mt-1" style={{ color: '#94a3b8' }}>{datos.resumen.items_con_costo_desconocido}</p>
            </div>
          </div>

          {datos.items.length === 0 ? (
            <p className="text-sm" style={{ color: '#64748b' }}>Sin ventas registradas en este período.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#1a1a26' }}>
                    {['Producto', 'Unidades', 'Ingresos', 'Costo', 'Margen', '%'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.items.map((it) => (
                    <tr key={`${it.producto_id}-${it.variante_id}`} style={{ borderTop: '1px solid #2a2a3a' }}>
                      <td className="px-3 py-2 font-semibold text-white">{it.nombre}</td>
                      <td className="px-3 py-2" style={{ color: '#e2e8f0' }}>{it.unidades_vendidas}</td>
                      <td className="px-3 py-2 text-emerald-400 font-semibold">{formatCOP(it.ingresos)}</td>
                      {it.costo_desconocido ? (
                        <td colSpan={3} className="px-3 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>
                            costo no disponible
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2" style={{ color: '#fbbf24' }}>{formatCOP(it.costo_total)}</td>
                          <td className="px-3 py-2 font-bold" style={{ color: it.margen >= 0 ? '#34d399' : '#f87171' }}>{formatCOP(it.margen)}</td>
                          <td className="px-3 py-2" style={{ color: it.margen >= 0 ? '#34d399' : '#f87171' }}>{it.margen_pct}%</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
