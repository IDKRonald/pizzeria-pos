// src/pages/EstadisticasPage.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import TabVentas from '../components/estadisticas/TabVentas';
import TabProductos from '../components/estadisticas/TabProductos';
import TabRentabilidad from '../components/estadisticas/TabRentabilidad';
import TabCaja from '../components/estadisticas/TabCaja';

const TABS = [
  { id: 'ventas',       label: 'Ventas',       emoji: '💰' },
  { id: 'productos',    label: 'Productos',    emoji: '🏆' },
  { id: 'rentabilidad', label: 'Rentabilidad', emoji: '📈' },
  { id: 'caja',         label: 'Caja',         emoji: '🧾' },
];

export default function EstadisticasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabInicial = new URLSearchParams(location.search).get('tab');
  const [tabActiva, setTabActiva] = useState(TABS.some((t) => t.id === tabInicial) ? tabInicial : 'ventas');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f0f13' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 flex-wrap gap-3"
        style={{ background: '#13131b', borderBottom: '1px solid #2a2a3a' }}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/hub')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
            style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}>←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-lg">📊</div>
          <div>
            <h1 className="text-base font-extrabold text-white leading-none">Estadísticas y Cierre</h1>
            <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>Reportes de ventas y cuadre de caja</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 px-4 sm:px-6 py-3" style={{ borderBottom: '1px solid #1e1e2d' }}>
        {TABS.map((t) => {
          const activa = tabActiva === t.id;
          return (
            <button key={t.id} onClick={() => setTabActiva(t.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-all"
              style={{
                background: activa ? 'rgb(249,115,22)' : '#1e1e2d',
                border: activa ? '1px solid rgb(249,115,22)' : '1px solid #2a2a3a',
                color: activa ? '#fff' : '#94a3b8',
              }}>
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {tabActiva === 'ventas' && <TabVentas />}
        {tabActiva === 'productos' && <TabProductos />}
        {tabActiva === 'rentabilidad' && <TabRentabilidad />}
        {tabActiva === 'caja' && <TabCaja />}
      </main>
    </div>
  );
}
