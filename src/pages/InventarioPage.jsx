// src/pages/InventarioPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import TabInsumos from '../components/inventario/TabInsumos';
import TabProveedores from '../components/inventario/TabProveedores';
import TabMovimientos from '../components/inventario/TabMovimientos';
import TabRecetas from '../components/inventario/TabRecetas';
import TabCombos from '../components/inventario/TabCombos';
import TabImportarExcel from '../components/inventario/TabImportarExcel';
import TabCarta from '../components/inventario/TabCarta';
import TabSugerenciaCompra from '../components/inventario/TabSugerenciaCompra';

const TABS = [
  { id: 'insumos',     label: 'Insumos',     emoji: '📦' },
  { id: 'proveedores', label: 'Proveedores', emoji: '🚚' },
  { id: 'sugerencia',  label: 'Sugerencia de Compra', emoji: '📋' },
  { id: 'movimientos', label: 'Movimientos', emoji: '📜' },
  { id: 'recetas',     label: 'Recetas',     emoji: '🧾' },
  { id: 'combos',      label: 'Combos',      emoji: '🍔' },
  { id: 'carta',       label: 'Carta',       emoji: '🍕' },
  { id: 'importar',    label: 'Importar Excel', emoji: '📥' },
];

export default function InventarioPage() {
  const navigate = useNavigate();
  const [tabActiva, setTabActiva] = useState('insumos');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f0f13' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 flex-wrap gap-3"
        style={{ background: '#13131b', borderBottom: '1px solid #2a2a3a' }}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/hub')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
            style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}>←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg">📦</div>
          <div>
            <h1 className="text-base font-extrabold text-white leading-none">Inventario</h1>
            <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>Stock, insumos y proveedores</p>
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
        {tabActiva === 'insumos' && <TabInsumos />}
        {tabActiva === 'proveedores' && <TabProveedores />}
        {tabActiva === 'sugerencia' && <TabSugerenciaCompra />}
        {tabActiva === 'movimientos' && <TabMovimientos />}
        {tabActiva === 'recetas' && <TabRecetas />}
        {tabActiva === 'combos' && <TabCombos />}
        {tabActiva === 'carta' && <TabCarta />}
        {tabActiva === 'importar' && <TabImportarExcel />}
      </main>
    </div>
  );
}
