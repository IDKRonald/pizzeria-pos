// src/components/estadisticas/TabCaja.jsx
// Caja: abrir, registrar salidas y cerrar con un cierre guiado de tres pasos
// (contar billetes + monedas → revisar diferencia y pendientes → confirmar).
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCajaAbierta } from '../../hooks/useCajaAbierta';
import { abrirCaja, cerrarCaja, getCajaHistorial, registrarMovimientoCaja } from '../../lib/api';
import { miles } from '../../lib/venta';

const ETIQUETA_SALIDA = { retiro: 'Retiro', gasto: 'Gasto', pago_domiciliario: 'Pago a domiciliario' };
const PASOS = ['Contar', 'Revisar', 'Confirmar'];

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };
const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });
const soloDigitos = (v) => v.replace(/\D/g, '');

function describirDiferencia(diferencia) {
  if (diferencia === 0) return { titulo: 'La caja cuadra', corto: 'Cuadra', ayuda: 'Todo en orden.', color: '#4FB38A', fondo: 'rgba(79,179,138,0.12)' };
  if (diferencia > 0) return { titulo: `Sobran ${formatCOP(diferencia)}`, corto: `Sobran ${formatCOP(diferencia)}`, ayuda: 'Revisa si falta registrar una venta en efectivo.', color: '#F2B33D', fondo: 'rgba(242,179,61,0.12)' };
  return { titulo: `Faltan ${formatCOP(-diferencia)}`, corto: `Faltan ${formatCOP(-diferencia)}`, ayuda: 'Revisa si falta registrar un gasto o un retiro.', color: '#E8554E', fondo: 'rgba(232,85,78,0.12)' };
}

export default function TabCaja() {
  const { usuario } = useAuth();
  const { caja, totales, pendientes, movimientos, cajaAbierta, cargandoCaja, refrescarCaja } = useCajaAbierta();
  const [salida, setSalida] = useState({ tipo: 'gasto', monto: '', nota: '' });
  const puedeOperar = ['admin', 'cajero'].includes(usuario.rol);

  const [montoInicial, setMontoInicial] = useState('');
  const [notasApertura, setNotasApertura] = useState('');
  const [paso, setPaso] = useState(1);
  const [billetes, setBilletes] = useState('');
  const [monedas, setMonedas] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [cierreHecho, setCierreHecho] = useState(null); // diferencia del último cierre, para el aviso
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const [historial, setHistorial] = useState([]);
  const cargarHistorial = useCallback(() => {
    getCajaHistorial({ limite: 15 }).then(setHistorial).catch(() => {});
  }, []);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial, cajaAbierta]);

  const contado = (Number(billetes) || 0) + (Number(monedas) || 0);
  const diferencia = contado - (totales?.monto_esperado_efectivo || 0);
  const dif = describirDiferencia(diferencia);

  const handleAbrir = async (e) => {
    e.preventDefault();
    setProcesando(true); setError(null);
    try {
      await abrirCaja({ monto_inicial: Number(montoInicial) || 0, notas: notasApertura || null }, usuario.id);
      setMontoInicial(''); setNotasApertura(''); setCierreHecho(null);
      refrescarCaja();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleSalida = async (e) => {
    e.preventDefault();
    const monto = Number(soloDigitos(String(salida.monto)));
    if (!monto) return;
    setProcesando(true); setError(null);
    try {
      await registrarMovimientoCaja({ tipo: salida.tipo, monto, nota: salida.nota || null }, usuario.id);
      setSalida({ tipo: salida.tipo, monto: '', nota: '' });
      refrescarCaja();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleCerrar = async (e) => {
    e.preventDefault();
    if (paso !== 3 || (billetes === '' && monedas === '')) return;
    setProcesando(true); setError(null);
    try {
      await cerrarCaja(caja.id, { monto_final: contado, notas: notasCierre || null }, usuario.id);
      setCierreHecho(diferencia);
      setBilletes(''); setMonedas(''); setNotasCierre(''); setPaso(1);
      refrescarCaja();
      cargarHistorial();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargandoCaja) {
    return <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const botonPrincipal = { background: 'var(--accent)', color: '#1A0E05' };
  const botonSecundario = { border: '1px solid #2a2a3a' };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Caja</h2>

      {error && <p role="alert" className="text-sm text-red-400">⚠️ {error}</p>}

      {cierreHecho !== null && !cajaAbierta && (
        <div role="status" className="p-4 rounded-xl flex flex-col gap-1" style={{ background: 'rgba(79,179,138,0.12)', border: '1px solid rgba(79,179,138,0.5)' }}>
          <span className="text-lg font-extrabold" style={{ color: '#4FB38A' }}>Caja cerrada</span>
          <span className="text-sm" style={{ color: '#e2e8f0' }}>
            Se guardó el cuadre {cierreHecho === 0 ? 'sin diferencia' : `con ${cierreHecho > 0 ? 'sobrante' : 'faltante'} de ${formatCOP(Math.abs(cierreHecho))}`}. Para tomar pedidos de nuevo, abre una caja.
          </span>
        </div>
      )}

      {cajaAbierta ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr] items-start">
          <aside aria-label="Resumen del turno" className="p-5 rounded-xl space-y-4" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <div>
              <p className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#4FB38A' }} />Caja abierta
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                Desde {new Date(caja.fecha_apertura).toLocaleString('es-CO')} · {caja.usuario_nombre}
              </p>
            </div>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
              <dt style={{ color: '#94a3b8' }}>Base inicial</dt><dd className="text-right font-semibold text-white">{formatCOP(caja.monto_inicial)}</dd>
              <dt style={{ color: '#94a3b8' }}>Efectivo vendido</dt><dd className="text-right font-semibold" style={{ color: '#4FB38A' }}>+ {formatCOP(totales.total_efectivo)}</dd>
              <dt style={{ color: '#94a3b8' }}>Salidas de efectivo</dt><dd className="text-right font-semibold" style={{ color: '#F08A84' }}>− {formatCOP(totales.total_salidas)}</dd>
              <dt className="pt-2 font-bold text-white" style={{ borderTop: '1px solid #2a2a3a' }}>Efectivo esperado</dt>
              <dd className="pt-2 text-right text-lg font-extrabold text-white" style={{ borderTop: '1px solid #2a2a3a' }}>{formatCOP(totales.monto_esperado_efectivo)}</dd>
            </dl>
            <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm p-3 rounded-lg" style={{ background: '#1a1a26' }}>
              <dt style={{ color: '#94a3b8' }}>Transferencias (no van en la caja)</dt><dd className="text-right font-semibold text-white">{formatCOP(totales.total_transferencia)}</dd>
              <dt style={{ color: '#94a3b8' }}>Tarjetas y otros</dt><dd className="text-right font-semibold text-white">{formatCOP(totales.total_general - totales.total_efectivo - totales.total_transferencia)}</dd>
              <dt style={{ color: '#94a3b8' }}>Total vendido</dt><dd className="text-right font-bold text-white">{formatCOP(totales.total_general)}</dd>
            </dl>

            {/* Salidas de efectivo: retiros, gastos y pagos a domiciliarios (estos últimos los registra el cobro). */}
            <div className="pt-3 space-y-3" style={{ borderTop: '1px solid #2a2a3a' }}>
              <p className="text-sm font-bold text-white">Salidas de efectivo</p>
              {movimientos.length === 0 ? (
                <p className="text-xs" style={{ color: '#64748b' }}>No hay salidas registradas en esta caja.</p>
              ) : (
                <ul className="text-sm space-y-1.5" style={{ color: '#e2e8f0' }}>
                  {movimientos.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <span>
                        {new Date(m.created_at.replace(' ', 'T')).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })} · {ETIQUETA_SALIDA[m.tipo]}
                        {m.numero_orden ? ` · ${m.numero_orden}` : ''}{m.nota && m.tipo !== 'pago_domiciliario' ? ` · ${m.nota}` : ''}
                      </span>
                      <span className="font-bold shrink-0" style={{ color: '#F08A84' }}>− {formatCOP(m.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {puedeOperar && (
                <form onSubmit={handleSalida} className="space-y-2">
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Tipo de salida
                      <select value={salida.tipo} onChange={(e) => setSalida((s) => ({ ...s, tipo: e.target.value }))}
                        className="block w-full mt-1 px-3 rounded-lg text-sm min-h-[44px]" style={inputStyle}>
                        <option value="gasto">Gasto</option>
                        <option value="retiro">Retiro</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Valor
                      <input required inputMode="numeric" value={miles(salida.monto)} placeholder="$ 0"
                        onChange={(e) => setSalida((s) => ({ ...s, monto: soloDigitos(e.target.value) }))}
                        className="block w-full mt-1 px-3 rounded-lg text-sm min-h-[44px]" style={inputStyle} />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold" style={{ color: '#94a3b8' }}>Motivo
                    <input value={salida.nota} placeholder="Ej: compra de hielo"
                      onChange={(e) => setSalida((s) => ({ ...s, nota: e.target.value }))}
                      className="block w-full mt-1 px-3 rounded-lg text-sm min-h-[44px]" style={inputStyle} />
                  </label>
                  <button type="submit" disabled={procesando || !salida.monto}
                    className="w-full min-h-[44px] rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: '#2a2a3a' }}>
                    Registrar salida
                  </button>
                </form>
              )}
            </div>
          </aside>

          {puedeOperar ? (
            <form onSubmit={handleCerrar} className="p-5 rounded-xl space-y-5" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-extrabold text-white">Cerrar la caja</h3>
                <ol aria-label="Pasos del cierre" className="flex flex-wrap gap-2">
                  {PASOS.map((t, i) => {
                    const n = i + 1;
                    const actual = n === paso;
                    return (
                      <li key={t} aria-current={actual ? 'step' : undefined}
                        className="inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm font-semibold"
                        style={actual ? botonPrincipal : { border: '1px solid #2a2a3a', color: n < paso ? '#4FB38A' : '#94a3b8' }}>
                        <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-extrabold"
                          style={{ background: actual ? 'rgba(0,0,0,0.15)' : '#1e1e2d' }}>{n < paso ? '✓' : n}</span>
                        {t}
                      </li>
                    );
                  })}
                </ol>
              </div>

              {paso === 1 && (
                <section className="space-y-4">
                  <p className="text-sm" style={{ color: '#cbd5e1' }}>Cuenta el efectivo de la caja y escribe cuánto hay en billetes y cuánto en monedas. El sistema los suma.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[['Billetes', billetes, setBilletes], ['Monedas', monedas, setMonedas]].map(([label, valor, setValor]) => (
                      <label key={label} className="text-sm font-semibold text-white">{label}
                        <span className="relative block mt-1.5">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold" style={{ color: '#64748b' }}>$</span>
                          <input inputMode="numeric" value={miles(valor)} placeholder="0"
                            onChange={(e) => setValor(soloDigitos(e.target.value))}
                            className="w-full h-14 pl-8 pr-3 rounded-xl text-2xl font-bold tabular-nums" style={inputStyle} />
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#1a1a26' }}>
                    <span className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Efectivo contado</span>
                    <span className="text-2xl font-extrabold text-white tabular-nums">{formatCOP(contado)}</span>
                  </div>
                  <button type="button" onClick={() => setPaso(2)} disabled={billetes === '' && monedas === ''}
                    className="w-full h-14 rounded-xl text-lg font-extrabold disabled:opacity-40" style={botonPrincipal}>
                    Siguiente: revisar
                  </button>
                </section>
              )}

              {paso === 2 && (
                <section className="space-y-4">
                  <div role="status" className="p-4 rounded-xl flex flex-col gap-1" style={{ background: dif.fondo, border: `1px solid ${dif.color}` }}>
                    <span className="text-2xl font-extrabold" style={{ color: dif.color }}>{dif.titulo}</span>
                    <span className="text-sm" style={{ color: '#e2e8f0' }}>
                      Contaste {formatCOP(contado)} · esperado {formatCOP(totales.monto_esperado_efectivo)}. {dif.ayuda}
                    </span>
                  </div>
                  {pendientes.length > 0 && (
                    <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(242,179,61,0.08)', border: '1px solid rgba(242,179,61,0.4)' }}>
                      <p className="text-sm font-bold" style={{ color: '#F2B33D' }}>
                        {pendientes.length === 1 ? '1 pedido queda con saldo' : `${pendientes.length} pedidos quedan con saldo`}
                      </p>
                      <ul className="text-sm space-y-1" style={{ color: '#e2e8f0' }}>
                        {pendientes.map((p) => (
                          <li key={p.id} className="flex justify-between gap-2">
                            <span>{p.numero_orden} · {p.tipo === 'domicilio' ? 'Domicilio' : p.tipo === 'mesa' ? `Mesa ${p.mesa_numero}` : p.mesa_numero ? `Para llevar · Mesa ${p.mesa_numero}` : 'Para llevar'}</span>
                            <span>debe <b>{formatCOP(p.total - p.monto_pagado)}</b></span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs" style={{ color: '#94a3b8' }}>Cóbralos antes de cerrar, o déjalos pendientes para el siguiente turno.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPaso(1)} className="h-14 rounded-xl font-bold text-white" style={botonSecundario}>Volver a contar</button>
                    <button type="button" onClick={() => setPaso(3)} className="h-14 rounded-xl font-extrabold" style={botonPrincipal}>Siguiente: confirmar</button>
                  </div>
                </section>
              )}

              {paso === 3 && (
                <section className="space-y-4">
                  <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm p-4 rounded-xl" style={{ background: '#1a1a26' }}>
                    <dt style={{ color: '#94a3b8' }}>Efectivo contado</dt><dd className="text-right font-bold text-white">{formatCOP(contado)}</dd>
                    <dt style={{ color: '#94a3b8' }}>Diferencia</dt><dd className="text-right font-bold" style={{ color: dif.color }}>{dif.corto}</dd>
                    <dt style={{ color: '#94a3b8' }}>Pedidos con saldo</dt>
                    <dd className="text-right font-bold text-white">{pendientes.length === 0 ? 'Ninguno' : `${pendientes.length} (quedan pendientes)`}</dd>
                  </dl>
                  <label className="block text-sm font-semibold text-white">Nota del cierre (opcional)
                    <input value={notasCierre} onChange={(e) => setNotasCierre(e.target.value)} placeholder="Ej: faltante por un billete roto"
                      className="block w-full mt-1.5 px-3 min-h-[44px] rounded-lg text-sm" style={inputStyle} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPaso(2)} className="h-14 rounded-xl font-bold text-white" style={botonSecundario}>Atrás</button>
                    <button type="submit" disabled={procesando} className="h-14 rounded-xl font-extrabold text-white disabled:opacity-50" style={{ background: '#dc2626' }}>
                      {procesando ? 'Cerrando…' : 'Cerrar la caja'}
                    </button>
                  </div>
                </section>
              )}
            </form>
          ) : (
            <p className="text-sm" style={{ color: '#64748b' }}>Solo un cajero o administrador puede cerrar la caja.</p>
          )}
        </div>
      ) : puedeOperar ? (
        <form onSubmit={handleAbrir} className="p-5 rounded-xl space-y-3 max-w-sm" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
          <p className="text-sm font-bold text-white">Abrir caja</p>
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Base inicial en efectivo</label>
            <input required inputMode="numeric" value={miles(montoInicial)} onChange={(e) => setMontoInicial(soloDigitos(e.target.value))} placeholder="Ej: 100.000" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Notas (opcional)</label>
            <input value={notasApertura} onChange={(e) => setNotasApertura(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
          <button type="submit" disabled={procesando} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'rgb(249,115,22)' }}>
            {procesando ? 'Abriendo...' : '🔓 Abrir caja'}
          </button>
        </form>
      ) : (
        <p className="text-sm" style={{ color: '#64748b' }}>La caja está cerrada. Pídele a un cajero o admin que la abra.</p>
      )}

      {/* Historial */}
      <div>
        <h3 className="text-sm font-bold text-white mb-2">Historial de cierres</h3>
        {historial.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748b' }}>Aún no hay cierres registrados.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#1a1a26' }}>
                  {['Apertura', 'Cierre', 'Usuario', 'Base', 'Ventas', 'Diferencia'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id} style={{ borderTop: '1px solid #2a2a3a' }}>
                    <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{new Date(h.fecha_apertura).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{new Date(h.fecha_cierre).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2" style={{ color: '#e2e8f0' }}>{h.usuario_nombre}</td>
                    <td className="px-3 py-2" style={{ color: '#e2e8f0' }}>{formatCOP(h.monto_inicial)}</td>
                    <td className="px-3 py-2 text-emerald-400 font-semibold">{formatCOP(h.total_ventas)}</td>
                    <td className="px-3 py-2 font-bold" style={{ color: h.diferencia === 0 ? '#34d399' : '#f87171' }}>{formatCOP(h.diferencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
