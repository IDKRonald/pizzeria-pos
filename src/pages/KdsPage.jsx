// src/pages/KdsPage.jsx
// Cocina: tres columnas por estado, del pedido más antiguo al más nuevo.
// Los cancelados salen de las columnas y quedan en una franja arriba hasta que el cocinero los confirma.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useDialogos } from '../context/DialogosContext';
import { getPedidosCocina, actualizarEstadoPedido } from '../lib/api';
import socket from '../lib/socket';

const COLUMNAS = [
  { estado: 'pendiente', titulo: 'Por empezar', ayuda: 'Nuevos, del más antiguo al más reciente', color: '#8FB8FF', fondo: '#1C2333', accion: 'Empezar a preparar', siguiente: 'en_preparacion', vacio: 'No hay pedidos nuevos.' },
  { estado: 'en_preparacion', titulo: 'En preparación', ayuda: 'Ya los estás cocinando', color: '#F2B33D', fondo: '#2A2416', accion: 'Marcar listo', siguiente: 'listo', vacio: 'Nada en preparación.' },
  { estado: 'listo', titulo: 'Listos para entregar', ayuda: 'Esperando al mesero o al domiciliario', color: '#4FB38A', fondo: '#16271F', accion: 'Entregado', siguiente: 'entregado', vacio: 'Nada esperando entrega.' },
];

const COLOR_DESTINO = { mesa: '#8FB8FF', domicilio: '#FFB37A', mostrador: '#9EE3C4' };

const fecha = (s) => (s ? new Date(String(s).replace(' ', 'T')) : new Date());
const hora = (s) => fecha(s).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

function destinoPedido(p) {
  if (p.tipo === 'domicilio') return 'Domicilio';
  if (p.tipo === 'mesa') return `Mesa ${p.mesa_numero ?? ''}`.trim();
  return p.mesa_numero ? `Para llevar · Mesa ${p.mesa_numero}` : 'Para llevar';
}

const firmaItems = (p) => (p.items || []).map((i) => `${i.cantidad}|${i.nombre_display}|${i.notas || ''}`).sort().join('§');

const leer = (clave, def) => { try { return JSON.parse(localStorage.getItem(clave)) ?? def; } catch { return def; } };
const guardar = (clave, v) => { try { localStorage.setItem(clave, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

export default function KdsPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { avisar, confirmar } = useDialogos();
  const esAdmin = usuario?.rol === 'admin';

  const [pedidos, setPedidos] = useState([]);
  const [ahora, setAhora] = useState(() => new Date());
  const [modificados, setModificados] = useState({}); // id → momento en que cambió
  const [vistos, setVistos] = useState(() => leer('kds_cancelados_vistos', []));
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const cargar = useCallback(() => getPedidosCocina()
    .then((data) => {
      // Si los productos de un pedido cambiaron desde la última vez, se marca como modificado.
      const firmas = leer('kds_firmas', {});
      const cambios = {};
      const nuevas = {};
      for (const p of data) {
        const f = firmaItems(p);
        if (firmas[p.id] && firmas[p.id] !== f && p.estado !== 'cancelado') cambios[p.id] = Date.now();
        nuevas[p.id] = f;
      }
      guardar('kds_firmas', nuevas);
      if (Object.keys(cambios).length) setModificados((m) => ({ ...m, ...cambios }));
      setPedidos(data);
    })
    .catch((err) => console.error('Error cargando pedidos de cocina:', err)), []);

  useEffect(() => {
    cargar();
    socket.emit('unirse_sala', 'cocina');
    const onNuevo = () => {
      new Audio('/notification.mp3').play().catch(() => {});
      cargar();
    };
    socket.on('nuevo_pedido', onNuevo);
    socket.on('pedido_actualizado', cargar);
    return () => {
      socket.off('nuevo_pedido', onNuevo);
      socket.off('pedido_actualizado', cargar);
    };
  }, [cargar]);

  const avanzar = useCallback(async (pedido, siguiente) => {
    setMenu(null);
    setModificados((m) => { const resto = { ...m }; delete resto[pedido.id]; return resto; });
    setPedidos((prev) => siguiente === 'entregado'
      ? prev.filter((p) => p.id !== pedido.id)
      : prev.map((p) => (p.id === pedido.id ? { ...p, estado: siguiente } : p)));
    try {
      await actualizarEstadoPedido(pedido.id, siguiente);
    } catch (err) {
      avisar('No se pudo cambiar el estado: ' + (err?.message || 'error desconocido'));
      cargar();
    }
  }, [avisar, cargar]);

  const cancelar = useCallback(async (pedido) => {
    setMenu(null);
    if (!(await confirmar({ titulo: `Cancelar ${destinoPedido(pedido)} · ${pedido.numero_orden}`, mensaje: 'Úsalo solo si el cliente lo canceló y el cajero no lo hizo. No se puede deshacer.', aceptar: 'Marcar como cancelado', cancelar: 'Volver', peligro: true }))) return;
    try {
      await actualizarEstadoPedido(pedido.id, 'cancelado');
      cargar();
    } catch (err) {
      avisar('No se pudo cancelar el pedido: ' + (err?.message || 'error desconocido'));
    }
  }, [avisar, confirmar, cargar]);

  const entendido = (id) => {
    const nuevos = [...vistos, id].slice(-200);
    setVistos(nuevos);
    guardar('kds_cancelados_vistos', nuevos);
  };

  const cancelados = pedidos.filter((p) => p.estado === 'cancelado' && !vistos.includes(p.id));
  const activos = pedidos.filter((p) => p.estado !== 'cancelado');
  const minutos = (p) => Math.max(0, Math.floor((ahora - fecha(p.created_at)) / 60000));

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#121318', color: '#F3F3F5' }}>
      <header className="flex flex-wrap items-center gap-4 px-5 py-3" style={{ background: '#1A1C22', borderBottom: '1px solid #2D313B' }}>
        <button onClick={() => navigate('/hub')} aria-label="Volver"
          className="w-11 h-11 flex items-center justify-center rounded-[10px]" style={{ border: '1px solid #2D313B' }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-extrabold">Cocina</span>
          <span className="text-sm" style={{ color: '#A4A9B6' }}>
            {activos.length === 0 ? 'Sin pedidos por preparar' : `${activos.length} ${activos.length === 1 ? 'pedido' : 'pedidos'} por entregar`}
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3.5 text-sm" style={{ color: '#C9CDD6' }}>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: '#F2B33D' }} />8 min o más</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-[3px]" style={{ background: '#E8554E' }} />15 min o más</span>
        </div>
        <span className="text-[28px] font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
          {ahora.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </header>

      {cancelados.length > 0 && (
        <section aria-label="Pedidos cancelados" role="alert"
          className="mx-5 mt-4 flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-[14px]"
          style={{ background: '#2A1616', border: '1px solid #5A2626' }}>
          <span className="font-extrabold mr-1.5" style={{ color: '#FFB4AE' }}>Cancelados · no los prepares</span>
          {cancelados.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2 pl-3 pr-1 min-h-11 rounded-[10px] font-bold"
              style={{ background: '#3A1A1A', color: '#FFD1CE' }}>
              <span><s>{destinoPedido(c).toUpperCase()}</s> · {c.numero_orden}</span>
              <button onClick={() => entendido(c.id)} className="h-9 px-3 rounded-lg text-sm font-extrabold"
                style={{ background: '#FFD1CE', color: '#4A1D1D' }}>Entendido</button>
            </span>
          ))}
        </section>
      )}

      <main className="flex-1 grid gap-4 px-5 py-4 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {COLUMNAS.map((col) => {
          const lista = activos.filter((p) => p.estado === col.estado);
          return (
            <section key={col.estado} aria-label={col.titulo} className="flex flex-col gap-3 min-w-0">
              <div className="flex items-center justify-between gap-2.5 px-3.5 py-3 rounded-[14px]"
                style={{ background: col.fondo, borderTop: `4px solid ${col.color}` }}>
                <div className="flex flex-col gap-0.5">
                  <h2 className="m-0 text-lg font-extrabold">{col.titulo}</h2>
                  <span className="text-[13px] opacity-85">{col.ayuda}</span>
                </div>
                <span className="min-w-10 h-10 px-2.5 rounded-full inline-flex items-center justify-center font-extrabold text-lg"
                  style={{ background: col.color, color: '#121318' }}>{lista.length}</span>
              </div>

              {lista.map((p) => {
                const min = minutos(p);
                const mod = modificados[p.id];
                const colorTiempo = min >= 15 ? '#E8554E' : min >= 8 ? '#F2B33D' : '#2D313B';
                return (
                  <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl"
                    style={{ background: '#1E2129', border: `2px solid ${mod ? '#F2B33D' : colorTiempo}`, borderLeft: `8px solid ${col.color}` }}>
                    {mod && (
                      <div role="status" className="px-3.5 py-2 font-extrabold text-[15px]" style={{ background: '#3B2A0C', color: '#FFD58A' }}>
                        MODIFICADO hace {Math.max(0, Math.floor((ahora - mod) / 60000))} min · revisa los productos
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3 px-3.5 pt-3.5 pb-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[26px] font-extrabold tracking-wide leading-tight" style={{ color: COLOR_DESTINO[p.tipo] || '#F3F3F5' }}>
                          {destinoPedido(p).toUpperCase()}
                        </span>
                        <span className="text-sm" style={{ color: '#A4A9B6' }}>{p.numero_orden} · tomado {hora(p.created_at)}</span>
                      </div>
                      <span className="shrink-0 px-3 py-1.5 rounded-[10px] text-[22px] font-extrabold tabular-nums"
                        style={min >= 15 ? { background: '#E8554E', color: '#1A0505' } : min >= 8 ? { background: '#F2B33D', color: '#1A1205' } : { background: '#2D313B', color: '#F3F3F5' }}>
                        {min} min
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2 px-3.5 pb-3">
                      {(p.items || []).map((it, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <span className="text-xl font-bold leading-tight">
                            <span style={{ color: 'var(--accent)' }}>{it.cantidad}×</span> {it.nombre_display}
                          </span>
                          {it.notas && (
                            <span className="self-start px-2.5 py-1 rounded-lg text-base font-extrabold" style={{ background: '#FFF3C4', color: '#3A2A00' }}>
                              {it.notas}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 px-3.5 pb-3.5">
                      <button onClick={() => avanzar(p, col.siguiente)}
                        className="flex-1 h-14 rounded-xl text-lg font-extrabold active:scale-[0.98] transition-transform"
                        style={col.siguiente === 'entregado' ? { background: '#4FB38A', color: '#06140D' } : { background: 'var(--accent)', color: '#1A0E05' }}>
                        {col.accion}
                      </button>
                      {esAdmin && (
                        <button aria-label="Más opciones" aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)}
                          className="w-14 h-14 shrink-0 flex items-center justify-center rounded-xl" style={{ border: '1px solid #3A3F4C', color: '#C9CDD6' }}>
                          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                        </button>
                      )}
                    </div>
                    {menu === p.id && (
                      <div className="mx-3.5 mb-3.5 p-2.5 rounded-xl flex flex-col gap-1.5" style={{ border: '1px solid #3A3F4C' }}>
                        <span className="text-[13px]" style={{ color: '#A4A9B6' }}>Solo si el cliente lo canceló y el cajero no lo hizo:</span>
                        <button onClick={() => cancelar(p)} className="h-11 rounded-[10px] text-[15px] font-bold"
                          style={{ border: '1px solid #7A2F2F', color: '#F08A84' }}>Marcar como cancelado</button>
                      </div>
                    )}
                  </article>
                );
              })}

              {lista.length === 0 && (
                <p className="m-0 px-3 py-7 text-center rounded-[14px]" style={{ color: '#6B7080', border: '1px dashed #2D313B' }}>{col.vacio}</p>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
