// src/pages/MesasPage.jsx
// Salón en cuadrícula: cada mesa muestra su estado, minutos y saldo. Al tocarla se abre su detalle al lado.
// Admin además puede añadir, unir y eliminar mesas.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useDialogos } from '../context/DialogosContext';
import socket from '../lib/socket';
import { getMesas, crearMesa, fusionarMesas } from '../lib/api';
import PanelDetalleMesa from '../components/PanelDetalleMesa';
import { ESTADO_MESA, fmt, etiquetaEstilo } from '../lib/mesas';

const minutosDesde = (s) => (s ? Math.max(0, Math.floor((Date.now() - new Date(String(s).replace(' ', 'T'))) / 60000)) : 0);

export default function MesasPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { avisar } = useDialogos();
  const puedeEditar = usuario.rol === 'admin';

  const [mesas, setMesas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [, setTick] = useState(0);

  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [modoFusion, setModoFusion] = useState(false);
  const [seleccionFusion, setSeleccionFusion] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formMesa, setFormMesa] = useState({ numero: '', nombre: '', capacidad: 4 });

  const cargarMesas = useCallback(() => {
    getMesas()
      .then((data) => { setMesas(data); setError(null); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => { cargarMesas(); }, [cargarMesas]);

  // Los minutos de cada mesa avanzan solos.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    socket.on('mesa_actualizada', cargarMesas);
    socket.on('pedido_actualizado', cargarMesas);
    socket.on('nuevo_pedido', cargarMesas);
    socket.on('connect', cargarMesas);
    return () => {
      socket.off('mesa_actualizada', cargarMesas);
      socket.off('pedido_actualizado', cargarMesas);
      socket.off('nuevo_pedido', cargarMesas);
      socket.off('connect', cargarMesas);
    };
  }, [cargarMesas]);

  const handleClickMesa = (mesa) => {
    if (modoFusion) {
      setSeleccionFusion((prev) => (prev.includes(mesa.id) ? prev.filter((id) => id !== mesa.id) : [...prev, mesa.id]));
      return;
    }
    setMesaSeleccionada(mesa.id);
  };

  const handleCrearMesa = async (e) => {
    e.preventDefault();
    try {
      await crearMesa({
        numero: parseInt(formMesa.numero, 10),
        nombre: formMesa.nombre || null,
        capacidad: parseInt(formMesa.capacidad, 10) || 4,
      }, usuario.id);
      setMostrarForm(false);
      setFormMesa({ numero: '', nombre: '', capacidad: 4 });
      cargarMesas();
    } catch (err) {
      avisar(err.message);
    }
  };

  const empezarFusion = (mesaId = null) => {
    setMesaSeleccionada(null);
    setModoFusion(true);
    setSeleccionFusion(mesaId ? [mesaId] : []);
  };

  const handleConfirmarFusion = async () => {
    if (seleccionFusion.length < 2) return;
    try {
      await fusionarMesas(seleccionFusion, usuario.id);
      setModoFusion(false);
      setSeleccionFusion([]);
      cargarMesas();
    } catch (err) {
      avisar(err.message);
    }
  };

  // Una mesa unida se muestra una sola vez, en su mesa principal.
  const visibles = mesas.filter((m) => !m.grupo || m.grupo.mesa_principal_id === m.id);
  const cuenta = (est) => visibles.filter((m) => est === 'todas' || m.estado === est).length;
  const filtradas = visibles.filter((m) => filtro === 'todas' || m.estado === filtro);
  const filtros = [['todas', 'Todas', '#F3F3F5'], ...Object.entries(ESTADO_MESA).map(([k, e]) => [k, e.t, e.c])];

  const botonSecundario = 'inline-flex items-center gap-2 h-11 px-4 rounded-xl text-[15px] font-bold';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#121318', color: '#F3F3F5' }}>
      <header className="flex flex-wrap items-center gap-4 px-5 py-3" style={{ background: '#1A1C22', borderBottom: '1px solid #2D313B' }}>
        <button onClick={() => navigate('/hub')} aria-label="Volver"
          className="w-11 h-11 flex items-center justify-center rounded-[10px]" style={{ border: '1px solid #2D313B' }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-extrabold">Mesas</span>
          <span className="text-sm" style={{ color: '#A4A9B6' }}>
            {modoFusion ? 'Toca las mesas que quieres unir' : 'Toca una mesa para tomar, ver o cobrar su pedido'}
          </span>
        </div>
        <div className="flex-1" />

        {modoFusion ? (
          <>
            <span className="text-sm font-semibold" style={{ color: '#C9CDD6' }}>
              {seleccionFusion.length} seleccionada{seleccionFusion.length === 1 ? '' : 's'}
            </span>
            <button onClick={handleConfirmarFusion} disabled={seleccionFusion.length < 2}
              className={`${botonSecundario} disabled:opacity-40`} style={{ background: 'var(--accent)', color: '#1A0E05' }}>
              Unir mesas
            </button>
            <button onClick={() => { setModoFusion(false); setSeleccionFusion([]); }}
              className={botonSecundario} style={{ border: '1px solid #3A3F4C' }}>Cancelar</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/pos')} className={botonSecundario} style={{ border: '1px solid #3A3F4C' }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8h12l-1 12H7z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
              Pedido para llevar
            </button>
            {puedeEditar && (
              <>
                <button onClick={() => setMostrarForm(true)} className={botonSecundario} style={{ border: '1px solid #3A3F4C' }}>＋ Añadir mesa</button>
                <button onClick={() => empezarFusion()} className={botonSecundario} style={{ border: '1px solid #3A3F4C' }}>Unir mesas</button>
              </>
            )}
          </>
        )}

        <div role="group" aria-label="Filtrar por estado" className="w-full flex flex-wrap gap-2">
          {filtros.map(([k, etiqueta, color]) => (
            <button key={k} aria-pressed={filtro === k} onClick={() => setFiltro(k)}
              className="inline-flex items-center gap-2 min-h-11 px-3.5 rounded-full text-sm font-semibold"
              style={filtro === k ? { background: '#2D313B', border: '1px solid #F3F3F5' } : { border: '1px solid #2D313B' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {etiqueta} <b>{cuenta(k)}</b>
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div role="alert" className="mx-5 mt-3 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: '#2A1616', border: '1px solid #5A2626', color: '#FFB4AE' }}>
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-wrap items-stretch">
        <main className="min-w-0 p-5" style={{ flex: '999 1 560px' }}>
          {cargando ? (
            <p className="text-center py-10" style={{ color: '#A4A9B6' }}>Cargando mesas…</p>
          ) : filtradas.length === 0 ? (
            <p className="m-0 p-7 text-center rounded-[14px]" style={{ color: '#6B7080', border: '1px dashed #2D313B' }}>
              {visibles.length === 0 ? 'Aún no hay mesas. Añádelas desde aquí si eres administrador.' : 'Ninguna mesa en este estado.'}
            </p>
          ) : (
            <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
              {filtradas.map((m) => {
                const e = ESTADO_MESA[m.estado] || ESTADO_MESA.libre;
                const elegida = modoFusion ? seleccionFusion.includes(m.id) : mesaSeleccionada === m.id;
                const numero = m.grupo ? m.grupo.miembros.join(' + ') : m.numero;
                const detalle = m.estado === 'libre' ? ''
                  : m.estado === 'por_pagar' ? `Debe ${fmt(m.saldo)}`
                  : `${minutosDesde(m.desde)} min${m.saldo > 0 ? ` · ${fmt(m.saldo)}` : ''}`;
                return (
                  <button key={m.id} onClick={() => handleClickMesa(m)} aria-pressed={elegida}
                    aria-label={`Mesa ${numero}, ${e.t}`}
                    className="relative flex flex-col items-start gap-2 min-h-[140px] pl-5 pr-4 pt-4 pb-3.5 overflow-hidden text-left rounded-2xl"
                    style={{ background: e.fondo, border: `2px solid ${elegida ? 'var(--accent)' : 'transparent'}`, boxShadow: elegida ? '0 0 0 3px rgba(244,122,42,0.3)' : 'none' }}>
                    <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: e.c }} />
                    <span className="flex items-baseline justify-between gap-2 w-full">
                      <span className="text-[34px] font-extrabold leading-none">{numero}</span>
                      <span className="text-sm truncate" style={{ color: '#A4A9B6' }}>{m.grupo?.nombre || m.nombre || ''}</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-sm font-bold" style={etiquetaEstilo(e.c)}>{e.t}</span>
                    <span className="text-[15px] min-h-5" style={{ color: '#C9CDD6' }}>{detalle}</span>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        {mesaSeleccionada && !modoFusion && (
          <PanelDetalleMesa
            key={mesaSeleccionada}
            mesaId={mesaSeleccionada}
            estado={mesas.find((m) => m.id === mesaSeleccionada)?.estado}
            puedeEditar={puedeEditar}
            onCerrar={() => setMesaSeleccionada(null)}
            onCambio={cargarMesas}
            onUnir={() => empezarFusion(mesaSeleccionada)}
          />
        )}
      </div>

      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMostrarForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleCrearMesa}
            className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background: '#1A1C22', border: '1px solid #2D313B' }}>
            <h3 className="text-lg font-extrabold">Nueva mesa</h3>
            {[
              ['numero', 'Número', 'number', true],
              ['nombre', 'Nombre (opcional)', 'text', false],
              ['capacidad', 'Capacidad', 'number', true],
            ].map(([campo, label, tipo, req]) => (
              <label key={campo} className="block">
                <span className="block text-sm font-semibold mb-1" style={{ color: '#A4A9B6' }}>{label}</span>
                <input required={req} type={tipo} min={tipo === 'number' ? 1 : undefined} value={formMesa[campo]}
                  placeholder={campo === 'nombre' ? 'Ej. Terraza 3' : undefined}
                  onChange={(e) => setFormMesa((f) => ({ ...f, [campo]: e.target.value }))}
                  className="w-full h-11 px-3 rounded-[10px] text-base" style={{ background: '#20232B', border: '1px solid #3A3F4C', color: '#F3F3F5' }} />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 h-11 rounded-xl font-extrabold" style={{ background: 'var(--accent)', color: '#1A0E05' }}>Crear</button>
              <button type="button" onClick={() => setMostrarForm(false)} className="flex-1 h-11 rounded-xl font-semibold" style={{ border: '1px solid #3A3F4C' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
