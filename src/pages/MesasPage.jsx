// src/pages/MesasPage.jsx
// Diagrama del salón: mesero selecciona mesa y toma pedido; admin además
// puede añadir, arrastrar, eliminar y fusionar mesas.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import socket from '../lib/socket';
import { getMesas, crearMesa, actualizarMesa, eliminarMesa, fusionarMesas } from '../lib/api';
import PanelDetalleMesa from '../components/PanelDetalleMesa';

const ESTADO_ESTILO = {
  libre:          { bg: 'rgba(100,116,139,0.14)', border: 'rgba(100,116,139,0.45)', text: '#94a3b8', label: 'Libre' },
  ocupada:        { bg: 'rgba(59,130,246,0.16)',  border: 'rgba(59,130,246,0.55)',  text: '#60a5fa', label: 'Ocupada' },
  en_preparacion: { bg: 'rgba(249,115,22,0.16)',  border: 'rgba(249,115,22,0.55)',  text: '#fb923c', label: 'En cocina' },
  lista:          { bg: 'rgba(16,185,129,0.16)',  border: 'rgba(16,185,129,0.55)',  text: '#34d399', label: 'Lista' },
  por_pagar:      { bg: 'rgba(168,85,247,0.16)',  border: 'rgba(168,85,247,0.55)',  text: '#c084fc', label: 'Por pagar' },
};

const MESA_W = 108;
const MESA_H = 92;

export default function MesasPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const puedeEditar = usuario.rol === 'admin';

  const [mesas, setMesas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [modoFusion, setModoFusion] = useState(false);
  const [seleccionFusion, setSeleccionFusion] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formMesa, setFormMesa] = useState({ numero: '', nombre: '', capacidad: 4 });

  const dragRef = useRef(null);

  const cargarMesas = useCallback(() => {
    getMesas()
      .then((data) => { setMesas(data); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargarMesas(); }, [cargarMesas]);

  /* ── Sincronía en vivo ── */
  useEffect(() => {
    const onMesaActualizada = (data) => {
      const id = data.id ?? data.mesa_id;
      setMesas((prev) => prev.map((m) => m.id === id ? { ...m, estado: data.estado } : m));
    };
    const onCambioPedido = () => cargarMesas(); // conteos de pedidos activos pueden cambiar
    const onReconectar = () => cargarMesas();   // resync tras una desconexión
    socket.on('mesa_actualizada', onMesaActualizada);
    socket.on('pedido_actualizado', onCambioPedido);
    socket.on('nuevo_pedido', onCambioPedido);
    socket.on('connect', onReconectar);
    return () => {
      socket.off('mesa_actualizada', onMesaActualizada);
      socket.off('pedido_actualizado', onCambioPedido);
      socket.off('nuevo_pedido', onCambioPedido);
      socket.off('connect', onReconectar);
    };
  }, [cargarMesas]);

  /* ── Selección / clic ── */
  const handleClickMesa = useCallback((mesa) => {
    if (modoFusion) {
      setSeleccionFusion((prev) =>
        prev.includes(mesa.id) ? prev.filter((id) => id !== mesa.id) : [...prev, mesa.id]);
      return;
    }
    setMesaSeleccionada(mesa.id);
  }, [modoFusion]);

  /* ── Arrastrar (solo admin, fuera de modo fusión) ── */
  const handlePointerDown = (e, mesa) => {
    if (!puedeEditar || modoFusion) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: mesa.id, startX: e.clientX, startY: e.clientY, origX: mesa.x, origY: mesa.y, moved: false };
  };

  const handlePointerMove = (e, mesa) => {
    if (!dragRef.current || dragRef.current.id !== mesa.id) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    const nx = Math.max(0, dragRef.current.origX + dx);
    const ny = Math.max(0, dragRef.current.origY + dy);
    setMesas((prev) => prev.map((m) => m.id === mesa.id ? { ...m, x: nx, y: ny } : m));
  };

  const handlePointerUp = (e, mesa) => {
    if (!dragRef.current || dragRef.current.id !== mesa.id) return;
    const { moved } = dragRef.current;
    dragRef.current = null;
    if (moved) {
      const actual = mesas.find((m) => m.id === mesa.id);
      actualizarMesa(mesa.id, { x: actual.x, y: actual.y }, usuario.id).catch((err) => setError(err.message));
    } else {
      handleClickMesa(mesa);
    }
  };

  /* ── Crear mesa ── */
  const handleCrearMesa = async (e) => {
    e.preventDefault();
    try {
      await crearMesa({
        numero: parseInt(formMesa.numero, 10),
        nombre: formMesa.nombre || null,
        capacidad: parseInt(formMesa.capacidad, 10) || 4,
        x: 40 + Math.random() * 120,
        y: 40 + Math.random() * 120,
      }, usuario.id);
      setMostrarForm(false);
      setFormMesa({ numero: '', nombre: '', capacidad: 4 });
      cargarMesas();
    } catch (err) {
      setError(err.message);
    }
  };

  /* ── Eliminar mesa ── */
  const handleEliminarMesa = async (mesa) => {
    if (!confirm(`¿Eliminar la mesa ${mesa.numero}?`)) return;
    try {
      await eliminarMesa(mesa.id, usuario.id);
      cargarMesas();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ── Fusionar mesas seleccionadas ── */
  const handleConfirmarFusion = async () => {
    if (seleccionFusion.length < 2) return;
    try {
      await fusionarMesas(seleccionFusion, usuario.id);
      setModoFusion(false);
      setSeleccionFusion([]);
      cargarMesas();
    } catch (err) {
      alert(err.message);
    }
  };

  const canvasW = Math.max(760, ...mesas.map((m) => m.x + MESA_W + 40), 0);
  const canvasH = Math.max(560, ...mesas.map((m) => m.y + MESA_H + 40), 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-main, #0a0a12)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 flex-wrap gap-3"
        style={{ background: '#13131b', borderBottom: '1px solid #2a2a3a' }}>
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate('/hub')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
            style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}>←</button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-lg">🪑</div>
          <div>
            <h1 className="text-base font-extrabold text-white leading-none">
              {puedeEditar ? 'Gestor de Mesas' : 'Tomar Pedido'}
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>
              {puedeEditar ? 'Distribución del salón' : 'Selecciona una mesa para ver o tomar el pedido'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!puedeEditar && (
            <button onClick={() => navigate('/pos')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
              style={{ background: 'rgb(249,115,22)' }}>
              🛍️ Pedido para llevar / mostrador
            </button>
          )}

          {puedeEditar && !modoFusion && (
            <>
              <button onClick={() => setMostrarForm(true)}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#e2e8f0' }}>
                ＋ Añadir mesa
              </button>
              <button onClick={() => { setModoFusion(true); setSeleccionFusion([]); }}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#e2e8f0' }}>
                🔗 Fusionar mesas
              </button>
            </>
          )}

          {puedeEditar && modoFusion && (
            <>
              <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>
                {seleccionFusion.length} seleccionada{seleccionFusion.length === 1 ? '' : 's'}
              </span>
              <button onClick={handleConfirmarFusion} disabled={seleccionFusion.length < 2}
                className="px-3.5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'rgb(16,185,129)' }}>
                ✓ Confirmar fusión
              </button>
              <button onClick={() => { setModoFusion(false); setSeleccionFusion([]); }}
                className="px-3.5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#94a3b8' }}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </header>

      {/* Leyenda de estados */}
      <div className="flex flex-wrap gap-3 px-4 sm:px-6 py-2.5" style={{ borderBottom: '1px solid #1e1e2d' }}>
        {Object.entries(ESTADO_ESTILO).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: s.text }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.text }} />
            {s.label}
          </div>
        ))}
      </div>

      {error && (
        <div className="mx-4 sm:mx-6 mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Diagrama */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {cargando ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm" style={{ color: '#64748b' }}>Cargando salón...</p>
          </div>
        ) : (
          <div style={{ position: 'relative', width: canvasW, height: canvasH }}>
            {mesas.map((mesa) => {
              const estilo = ESTADO_ESTILO[mesa.estado] || ESTADO_ESTILO.libre;
              const seleccionadaFusion = seleccionFusion.includes(mesa.id);
              const arrastrable = puedeEditar && !modoFusion;

              return (
                <div key={mesa.id}
                  onPointerDown={(e) => handlePointerDown(e, mesa)}
                  onPointerMove={(e) => handlePointerMove(e, mesa)}
                  onPointerUp={(e) => handlePointerUp(e, mesa)}
                  onClick={() => { if (!arrastrable) handleClickMesa(mesa); }}
                  className="group select-none"
                  style={{
                    position: 'absolute', left: mesa.x, top: mesa.y,
                    width: MESA_W, height: MESA_H,
                    borderRadius: 16,
                    background: estilo.bg,
                    border: `2px solid ${seleccionadaFusion ? '#f97316' : estilo.border}`,
                    boxShadow: seleccionadaFusion ? '0 0 0 3px rgba(249,115,22,0.35)' : 'none',
                    cursor: arrastrable ? 'grab' : 'pointer',
                    touchAction: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    transition: 'box-shadow 0.15s',
                  }}
                  title={mesa.grupo ? `Fusionada: ${mesa.grupo.miembros.join(' + ')}` : undefined}
                >
                  {puedeEditar && !modoFusion && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEliminarMesa(mesa); }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      style={{ background: '#ef4444', color: '#fff' }}
                      title="Eliminar mesa"
                    >✕</button>
                  )}
                  <span className="text-lg font-black" style={{ color: estilo.text }}>
                    {mesa.grupo ? mesa.grupo.miembros.join('+') : mesa.numero}
                  </span>
                  {mesa.nombre && (
                    <span className="text-[10px] font-medium truncate px-2" style={{ color: '#94a3b8', maxWidth: MESA_W - 10 }}>
                      {mesa.nombre}
                    </span>
                  )}
                  <span className="text-[10px] font-bold mt-0.5" style={{ color: estilo.text }}>
                    {estilo.label}
                  </span>
                  {mesa.pedidos_activos > 0 && (
                    <span className="absolute -bottom-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white"
                      style={{ background: 'rgb(249,115,22)' }}>
                      {mesa.pedidos_activos} pedido{mesa.pedidos_activos === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Formulario nueva mesa */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMostrarForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleCrearMesa}
            className="w-full max-w-xs rounded-2xl p-5 space-y-3"
            style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">Nueva mesa</h3>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Número</label>
              <input required type="number" min="1" value={formMesa.numero}
                onChange={(e) => setFormMesa((f) => ({ ...f, numero: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' }} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Nombre (opcional)</label>
              <input type="text" value={formMesa.nombre}
                onChange={(e) => setFormMesa((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Terraza 3"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' }} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Capacidad</label>
              <input required type="number" min="1" value={formMesa.capacidad}
                onChange={(e) => setFormMesa((f) => ({ ...f, capacidad: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' }} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Crear</button>
              <button type="button" onClick={() => setMostrarForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1e1e2d', color: '#94a3b8' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Panel de detalle de mesa */}
      {mesaSeleccionada && (
        <PanelDetalleMesa
          mesaId={mesaSeleccionada}
          puedeEditar={puedeEditar}
          onCerrar={() => setMesaSeleccionada(null)}
          onCambio={cargarMesas}
        />
      )}
    </div>
  );
}
