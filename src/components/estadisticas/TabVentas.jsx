// src/components/estadisticas/TabVentas.jsx
import { useState, useCallback } from 'react';
import { getEstadisticasVentas } from '../../lib/api';
import SelectorRango from './SelectorRango';

const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const TARJETAS = [
  { key: 'total_efectivo', label: '💵 Efectivo', color: '#34d399' },
  { key: 'total_transferencia', label: '📲 Transferencia', color: '#60a5fa' },
  { key: 'total_tarjeta_debito', label: '💳 Tarjeta Débito', color: '#fbbf24' },
  { key: 'total_tarjeta_credito', label: '💳 Tarjeta Crédito', color: '#c084fc' },
];

export default function TabVentas() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(({ desde, hasta }) => {
    setCargando(true);
    getEstadisticasVentas({ desde, hasta }).then((d) => { setDatos(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Ventas por período</h2>
      <SelectorRango onChange={cargar} />

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : datos && (
        <>
          <div className="p-5 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <p className="text-xs uppercase font-bold tracking-wider" style={{ color: '#64748b' }}>Total vendido</p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-1">{formatCOP(datos.total_general)}</p>
            <p className="text-xs mt-1" style={{ color: '#64748b' }}>{datos.cantidad_pagos} pago(s) registrado(s)</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TARJETAS.map((t) => (
              <div key={t.key} className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
                <p className="text-xs font-semibold" style={{ color: '#94a3b8' }}>{t.label}</p>
                <p className="text-xl font-extrabold mt-1" style={{ color: t.color }}>{formatCOP(datos[t.key])}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
