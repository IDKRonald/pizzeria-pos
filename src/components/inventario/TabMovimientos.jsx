// src/components/inventario/TabMovimientos.jsx
import { useState, useEffect, useCallback } from 'react';
import { getMovimientos, getInsumos } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };

const TIPO_ESTILO = {
  venta:               { label: 'Venta',              color: '#f87171' },
  ajuste_manual:        { label: 'Ajuste manual',       color: '#fbbf24' },
  importacion_inicial:  { label: 'Importación inicial',  color: '#60a5fa' },
  reversion:            { label: 'Reversión',            color: '#34d399' },
};

export default function TabMovimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtroInsumo, setFiltroInsumo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const cargar = useCallback(() => {
    setCargando(true);
    const filtros = {};
    if (filtroInsumo) filtros.insumo_id = filtroInsumo;
    if (filtroTipo) filtros.tipo = filtroTipo;
    getMovimientos(filtros).then((d) => { setMovimientos(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, [filtroInsumo, filtroTipo]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { getInsumos().then(setInsumos).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Movimientos de inventario</h2>

      <div className="flex flex-wrap gap-2">
        <select value={filtroInsumo} onChange={(e) => setFiltroInsumo(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option value="">Todos los insumos</option>
          {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_ESTILO).map(([v, t]) => <option key={v} value={v}>{t.label}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : movimientos.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>Sin movimientos registrados todavía.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1a1a26' }}>
                {['Fecha', 'Insumo', 'Tipo', 'Cantidad', 'Stock resultante', 'Pedido', 'Usuario', 'Nota'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const tipo = TIPO_ESTILO[m.tipo] || { label: m.tipo, color: '#94a3b8' };
                return (
                  <tr key={m.id} style={{ borderTop: '1px solid #2a2a3a' }}>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#94a3b8' }}>
                      {new Date(m.created_at).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">{m.insumo_nombre}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: `${tipo.color}22`, color: tipo.color }}>{tipo.label}</span>
                    </td>
                    <td className="px-3 py-2 font-bold" style={{ color: m.cantidad >= 0 ? '#34d399' : '#f87171' }}>
                      {m.cantidad >= 0 ? '+' : ''}{m.cantidad} {m.insumo_unidad}
                    </td>
                    <td className="px-3 py-2" style={{ color: '#e2e8f0' }}>{m.stock_resultante}</td>
                    <td className="px-3 py-2" style={{ color: '#64748b' }}>{m.numero_orden || '—'}</td>
                    <td className="px-3 py-2" style={{ color: '#64748b' }}>{m.usuario_nombre || '—'}</td>
                    <td className="px-3 py-2" style={{ color: '#64748b' }}>{m.notas || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
