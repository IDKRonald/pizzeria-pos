// src/components/estadisticas/TabPedidos.jsx
// Lista de pedidos del periodo, 20 por página y solo con lo esencial. El detalle de
// cada pedido (productos, abonos y quién cobró) se pide al abrirlo, para no cargar todo.
import { Fragment, useState, useCallback, useEffect } from 'react';
import { getPedidosEstadisticas, getDetallePedidoEstadisticas } from '../../lib/api';
import { ETIQUETAS_PAGO } from '../TicketImpresion';
import SelectorRango from './SelectorRango';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };
const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const fechaHora = (s) => new Date(s.replace(' ', 'T')).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const MODALIDAD = { mesa: 'Mesa', mostrador: 'Para llevar', domicilio: 'Domicilio' };
const MODO_DOMICILIO = { transferencia: 'cliente por transferencia', efectivo_local: 'cliente en efectivo en el local', domiciliario: 'pagó el domiciliario' };

function EstadoPago({ p }) {
  if (p.estado === 'cancelado') return <span className="text-xs font-bold text-red-400">Cancelado</span>;
  if (p.monto_pagado >= p.total) return <span className="text-xs font-bold text-emerald-400">Pagado</span>;
  return <span className="text-xs font-bold text-amber-400">Debe {formatCOP(p.total - p.monto_pagado)}</span>;
}

function Detalle({ id }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getDetallePedidoEstadisticas(id).then(setD).catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p className="text-xs text-red-400">⚠️ {error}</p>;
  if (!d) return <p className="text-xs" style={{ color: '#64748b' }}>Cargando…</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 text-xs" style={{ color: '#e2e8f0' }}>
      <div>
        <p className="font-bold mb-1" style={{ color: '#94a3b8' }}>Productos · tomado por {d.tomado_por || '—'}</p>
        <ul className="space-y-0.5">
          {d.items.map((i, n) => (
            <li key={n}>{i.cantidad}× {i.nombre_display} — {formatCOP(i.subtotal)}{i.notas ? <em style={{ color: '#94a3b8' }}> ({i.notas})</em> : null}</li>
          ))}
        </ul>
        {d.propina > 0 && <p className="mt-1">Propina: {formatCOP(d.propina)}</p>}
        {d.costo_domicilio > 0 && (
          <p className="mt-1">Domicilio: {formatCOP(d.costo_domicilio)}{d.domicilio_modo ? ` · ${MODO_DOMICILIO[d.domicilio_modo]}` : ''}</p>
        )}
      </div>
      <div>
        <p className="font-bold mb-1" style={{ color: '#94a3b8' }}>Pagos</p>
        {d.pagos.length === 0 ? <p style={{ color: '#64748b' }}>Sin pagos.</p> : (
          <ul className="space-y-0.5">
            {d.pagos.map((pg, n) => (
              <li key={n}>{fechaHora(pg.created_at)} · {ETIQUETAS_PAGO[pg.metodo_pago] || pg.metodo_pago} · {formatCOP(pg.monto)} · cobró {pg.cobrado_por || '—'}</li>
            ))}
          </ul>
        )}
        {d.salidas.map((s, n) => <p key={n} className="mt-1 text-red-400">Pago a domiciliario: − {formatCOP(s.monto)}</p>)}
      </div>
    </div>
  );
}

export default function TabPedidos() {
  const [rango, setRango] = useState(null);
  const [filtros, setFiltros] = useState({ tipo: '', metodo: '', estado_pago: '' });
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);

  const elegirRango = useCallback((r) => { setRango(r); setPagina(1); }, []);
  const filtrar = (campo, valor) => { setFiltros((f) => ({ ...f, [campo]: valor })); setPagina(1); };

  useEffect(() => {
    if (!rango) return;
    getPedidosEstadisticas({ ...rango, ...filtros, pagina })
      .then((d) => { setDatos(d); setError(null); setAbierto(null); })
      .catch((e) => setError(e.message));
  }, [rango, filtros, pagina]);

  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;
  const selectCls = 'px-3 py-2 rounded-lg text-sm min-h-[44px]';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Pedidos</h2>
      <SelectorRango onChange={elegirRango} />

      <div className="flex flex-wrap gap-2">
        <select aria-label="Modalidad" value={filtros.tipo} onChange={(e) => filtrar('tipo', e.target.value)} className={selectCls} style={inputStyle}>
          <option value="">Todas las modalidades</option>
          <option value="mesa">Mesa</option>
          <option value="mostrador">Para llevar</option>
          <option value="domicilio">Domicilio</option>
        </select>
        <select aria-label="Forma de pago" value={filtros.metodo} onChange={(e) => filtrar('metodo', e.target.value)} className={selectCls} style={inputStyle}>
          <option value="">Todas las formas de pago</option>
          {Object.entries(ETIQUETAS_PAGO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select aria-label="Estado de pago" value={filtros.estado_pago} onChange={(e) => filtrar('estado_pago', e.target.value)} className={selectCls} style={inputStyle}>
          <option value="">Todos los estados</option>
          <option value="pagado">Pagados</option>
          <option value="debe">Con saldo</option>
          <option value="cancelado">Cancelados</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {datos && (datos.pedidos.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>No hay pedidos con esos filtros.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
            <table className="w-full text-sm">
              <thead style={{ background: '#1a1a26' }}>
                <tr className="text-left text-[11px] uppercase" style={{ color: '#64748b' }}>
                  <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Orden</th><th className="px-3 py-2">Modalidad</th>
                  <th className="px-3 py-2">Pago</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.pedidos.map((p) => (
                  <Fragment key={p.id}>
                    <tr className="cursor-pointer" style={{ borderTop: '1px solid #1e1e2d', background: abierto === p.id ? '#1a1a26' : 'transparent' }}
                      onClick={() => setAbierto(abierto === p.id ? null : p.id)}>
                      <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{fechaHora(p.created_at)}</td>
                      <td className="px-3 py-2">
                        <button type="button" aria-expanded={abierto === p.id} className="font-bold text-white min-h-[44px]">{p.numero_orden}</button>
                      </td>
                      <td className="px-3 py-2" style={{ color: '#e2e8f0' }}>{MODALIDAD[p.tipo]}{p.mesa_numero ? ` ${p.mesa_numero}` : ''}</td>
                      <td className="px-3 py-2" style={{ color: '#e2e8f0' }}>{p.metodos ? p.metodos.split(',').map((m) => ETIQUETAS_PAGO[m] || m).join(' + ') : '—'}</td>
                      <td className="px-3 py-2 text-right font-bold text-white">{formatCOP(p.total)}</td>
                      <td className="px-3 py-2"><EstadoPago p={p} /></td>
                    </tr>
                    {abierto === p.id && (
                      <tr><td colSpan={6} className="px-3 pb-3"><Detalle id={p.id} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm" style={{ color: '#94a3b8' }}>
            <span>{datos.total} pedido{datos.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}
                className="min-h-[44px] px-4 rounded-lg disabled:opacity-40" style={inputStyle}>Anterior</button>
              <span>Página {pagina} de {paginas}</span>
              <button type="button" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}
                className="min-h-[44px] px-4 rounded-lg disabled:opacity-40" style={inputStyle}>Siguiente</button>
            </div>
          </div>
        </>
      ))}
    </div>
  );
}
