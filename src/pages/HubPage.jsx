// src/pages/HubPage.jsx
// Panel principal de navegación — acceso a todos los módulos del POS

import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

const MODULOS = [
  {
    id: 'pos',
    titulo: 'Punto de Venta',
    desc: 'Venta directa / mostrador',
    emoji: '🛒',
    ruta: '/pos',
    color: 'from-emerald-500 to-emerald-700',
    shadow: 'rgba(16,185,129,0.25)',
    roles: ['admin', 'cajero'],
  },
  {
    id: 'tomar-pedido',
    titulo: 'Tomar Pedido',
    desc: 'Ver salón y tomar pedidos por mesa',
    emoji: '🪑',
    ruta: '/mesas',
    color: 'from-emerald-500 to-emerald-700',
    shadow: 'rgba(16,185,129,0.25)',
    roles: ['mesero'],
  },
  {
    id: 'mesas',
    titulo: 'Gestor de Mesas',
    desc: 'Distribución del salón y fusión de mesas',
    emoji: '🪑',
    ruta: '/mesas',
    color: 'from-blue-500 to-blue-700',
    shadow: 'rgba(59,130,246,0.25)',
    roles: ['admin', 'cajero'],
  },
  {
    id: 'kds',
    titulo: 'Cocina (KDS)',
    desc: 'Pantalla de pedidos en cocina',
    emoji: '👨‍🍳',
    ruta: '/kds',
    color: 'from-orange-500 to-red-600',
    shadow: 'rgba(249,115,22,0.25)',
    roles: ['admin', 'cajero', 'mesero', 'cocina'],
  },
  {
    id: 'inventario',
    titulo: 'Inventario',
    desc: 'Stock, insumos y proveedores',
    emoji: '📦',
    ruta: '/inventario',
    color: 'from-violet-500 to-purple-700',
    shadow: 'rgba(139,92,246,0.25)',
    roles: ['admin'],
  },
  {
    id: 'estadisticas',
    titulo: 'Estadísticas',
    desc: 'Reportes y cierre de caja',
    emoji: '📊',
    ruta: '/estadisticas',
    color: 'from-amber-500 to-amber-700',
    shadow: 'rgba(245,158,11,0.25)',
    roles: ['admin', 'cajero'],
  },
];

export default function HubPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const modulosVisibles = MODULOS.filter((m) => m.roles.includes(usuario.rol));

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(145deg, #0a0a12 0%, #0f0f1a 50%, #0a0a12 100%)' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid #1e1e2d' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600
                          flex items-center justify-center text-xl shadow-md">🍕</div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">Don Peñolinni POS</h1>
            <p className="text-xs" style={{ color: '#64748b' }}>Panel de Control</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{usuario.nombre}</p>
            <p className="text-xs capitalize" style={{ color: '#64748b' }}>{usuario.rol}</p>
          </div>
          <button onClick={() => { logout(); navigate('/', { replace: true }); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150
                       active:scale-95"
            style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Grid de módulos */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
          {modulosVisibles.map((mod) => (
            <button key={mod.id}
              onClick={() => navigate(mod.ruta)}
              className="group relative flex flex-col items-center justify-center
                         p-8 sm:p-10 rounded-2xl
                         transition-all duration-200
                         active:scale-[0.97] select-none"
              style={{
                background: '#13131b',
                border: '1px solid #2a2a3a',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)';
                e.currentTarget.style.boxShadow = `0 8px 32px ${mod.shadow}`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#2a2a3a';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Emoji icon con gradiente de fondo */}
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${mod.color}
                              flex items-center justify-center text-3xl
                              mb-4 shadow-lg transition-transform duration-200
                              group-hover:scale-110`}>
                {mod.emoji}
              </div>
              <h2 className="text-lg font-bold text-white mb-1">{mod.titulo}</h2>
              <p className="text-sm" style={{ color: '#64748b' }}>{mod.desc}</p>
            </button>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs" style={{ color: '#2a2a3a' }}>
        Don Peñolinni POS v2.0 — {new Date().getFullYear()}
      </footer>
    </div>
  );
}
