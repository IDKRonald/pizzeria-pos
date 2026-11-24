// src/components/estadisticas/TabCaja.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCajaAbierta } from '../../hooks/useCajaAbierta';
import { abrirCaja, cerrarCaja, getCajaHistorial, registrarMovimientoCaja } from '../../lib/api';

const ETIQUETA_SALIDA = { retiro: 'Retiro', gasto: 'Gasto', pago_domiciliario: 'Pago a domiciliario' };

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };
const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function TabCaja() {
  const { usuario } = useAuth();
  const { caja, totales, pendientes, movimientos, cajaAbierta, cargandoCaja, refrescarCaja } = useCajaAbierta();
  const [salida, setSalida] = useState({ tipo: 'gasto', monto: '', nota: '' });
  const [revisados, setRevisados] = useState(false);
  const puedeOperar = ['admin', 'cajero'].includes(usuario.rol);

  const [montoInicial, setMontoInicial] = useState('');
  const [notasApertura, setNotasApertura] = useState('');
  const [montoFinal, setMontoFinal] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  const [historial, setHistorial] = useState([]);
  const cargarHistorial = useCallback(() => {
    getCajaHistorial({ limite: 15 }).then(setHistorial).catch(() => {});
  }, []);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial, cajaAbierta]);

  const handleAbrir = async (e) => {
    e.preventDefault();
    setProcesando(true); setError(null);
    try {
      await abrirCaja({ monto_inicial: Number(montoInicial) || 0, notas: notasApertura || null }, usuario.id);
      setMontoInicial(''); setNotasApertura('');
      refrescarCaja();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const handleSalida = async (e) => {
    e.preventDefault();
    const monto = Number(String(salida.monto).replace(/\D/g, ''));
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
    if (montoFinal === '' || (pendientes.length > 0 && !revisados)) return;
    setProcesando(true); setError(null);
    try {
      await cerrarCaja(caja.id, { monto_final: Number(montoFinal), notas: notasCierre || null }, usuario.id);
      setMontoFinal(''); setNotasCierre(''); setRevisados(false);
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

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Caja</h2>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cajaAbierta ? (
        <div className="p-5 rounded-xl space-y-4" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Caja abierta</p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                Desde {new Date(caja.fecha_apertura).toLocaleString('es-CO')} · {caja.usuario_nombre}
              </p>
            </div>
            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>● Activa</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div><p className="text-[11px] uppercase font-bold" style={{ color: '#64748b' }}>Base inicial</p><p className="text-base font-bold text-white">{formatCOP(caja.monto_inicial)}</p></div>
            <div><p className="text-[11px] uppercase font-bold" style={{ color: '#64748b' }}>Efectivo vendido</p><p className="text-base font-bold text-emerald-400">{formatCOP(totales.total_efectivo)}</p></div>
            <div><p className="text-[11px] uppercase font-bold" style={{ color: '#64748b' }}>Transferencias</p><p className="text-base font-bold text-blue-400">{formatCOP(totales.total_transferencia)}</p></div>
            <div><p className="text-[11px] uppercase font-bold" style={{ color: '#64748b' }}>Tarjetas y otros</p><p className="text-base font-bold text-blue-400">{formatCOP(totales.total_general - totales.total_efectivo - totales.total_transferencia)}</p></div>
            <div><p className="text-[11px] uppercase font-bold" style={{ color: '#64748b' }}>Salidas de efectivo</p><p className="text-base font-bold text-red-400">− {formatCOP(totales.total_salidas)}</p></div>
            <div><p className="text-[11px] uppercase font-bold" style={{ color: '#64748b' }}>Efectivo esperado</p><p className="text-base font-bold text-amber-400">{formatCOP(totales.monto_esperado_efectivo)}</p></div>
          </div>

          <p className="text-xs" style={{ color: '#64748b' }}>Efectivo esperado = base inicial + efectivo vendido − salidas de efectivo.</p>

          {/* Salidas de efectivo: retiros, gastos y pagos a domiciliarios (estos últimos los registra el cobro). */}
          <div className="pt-3 space-y-3" style={{ borderTop: '1px solid #2a2a3a' }}>
            <p className="text-sm font-bold text-white">Salidas de efectivo</p>
            {movimientos.length === 0 ? (
              <p className="text-xs" style={{ color: '#64748b' }}>No hay salidas registradas en esta caja.</p>
            ) : (
              <ul className="text-xs space-y-1" style={{ color: '#e2e8f0' }}>
                {movimientos.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span>
                      {new Date(m.created_at.replace(' ', 'T')).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · {ETIQUETA_SALIDA[m.tipo]}
                      {m.numero_orden ? ` · #${m.numero_orden}` : ''}{m.nota && m.tipo !== 'pago_domiciliario' ? ` · ${m.nota}` : ''}
                    </span>
                    <span className="font-bold text-red-400">− {formatCOP(m.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
            {puedeOperar && (
              <form onSubmit={handleSalida} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_2fr_auto] gap-2 items-end">
                <label className="text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>Tipo
                  <select value={salida.tipo} onChange={(e) => setSalida((s) => ({ ...s, tipo: e.target.value }))}
                    className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={inputStyle}>
                    <option value="gasto">Gasto</option>
                    <option value="retiro">Retiro</option>
                  </select>
                </label>
                <label className="text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>Valor
                  <input required inputMode="numeric" value={salida.monto} placeholder="Ej: 20000"
                    onChange={(e) => setSalida((s) => ({ ...s, monto: e.target.value.replace(/\D/g, '') }))}
                    className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={inputStyle} />
                </label>
                <label className="text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>Nota
                  <input value={salida.nota} placeholder="Ej: compra de hielo"
                    onChange={(e) => setSalida((s) => ({ ...s, nota: e.target.value }))}
                    className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={inputStyle} />
                </label>
                <button type="submit" disabled={procesando || !salida.monto}
                  className="min-h-[44px] px-4 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: '#2a2a3a' }}>
                  Registrar salida
                </button>
              </form>
            )}
          </div>

          {puedeOperar && (
            <form onSubmit={handleCerrar} className="pt-3 space-y-3" style={{ borderTop: '1px solid #2a2a3a' }}>
              <p className="text-sm font-bold text-white">Cerrar caja</p>
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Efectivo contado físicamente</label>
                <input required type="number" value={montoFinal} onChange={(e) => setMontoFinal(e.target.value)}
                  placeholder={String(totales.monto_esperado_efectivo)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                {montoFinal !== '' && (
                  <p className="text-xs mt-1" style={{ color: Number(montoFinal) - totales.monto_esperado_efectivo === 0 ? '#34d399' : '#f87171' }}>
                    {Number(montoFinal) - totales.monto_esperado_efectivo === 0
                      ? '✓ Cuadra exacto'
                      : `Diferencia: ${formatCOP(Number(montoFinal) - totales.monto_esperado_efectivo)}`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Notas (opcional)</label>
                <input value={notasCierre} onChange={(e) => setNotasCierre(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              {pendientes.length > 0 && (
                <div role="alert" className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}>
                  <p className="text-sm font-bold" style={{ color: '#fbbf24' }}>
                    {pendientes.length === 1 ? 'Hay 1 pedido sin pagar completo' : `Hay ${pendientes.length} pedidos sin pagar completo`}
                  </p>
                  <ul className="text-xs space-y-1" style={{ color: '#e2e8f0' }}>
                    {pendientes.map((p) => (
                      <li key={p.id} className="flex justify-between gap-2">
                        <span>#{p.numero_orden} · {p.mesa_numero ? `Mesa ${p.mesa_numero}` : p.tipo === 'domicilio' ? 'Domicilio' : 'Para llevar'}</span>
                        <span>Total {formatCOP(p.total)} · abonado {formatCOP(p.monto_pagado)} · <b>debe {formatCOP(p.total - p.monto_pagado)}</b></span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 text-xs font-semibold min-h-[44px] cursor-pointer" style={{ color: '#e2e8f0' }}>
                    <input type="checkbox" checked={revisados} onChange={(e) => setRevisados(e.target.checked)} className="w-5 h-5" />
                    Los revisé y quiero cerrar de todas formas
                  </label>
                </div>
              )}
              <button type="submit" disabled={procesando || (pendientes.length > 0 && !revisados)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'rgb(220,38,38)' }}>
                {procesando ? 'Cerrando...' : '🔒 Cerrar caja'}
              </button>
            </form>
          )}
        </div>
      ) : puedeOperar ? (
        <form onSubmit={handleAbrir} className="p-5 rounded-xl space-y-3 max-w-sm" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
          <p className="text-sm font-bold text-white">Abrir caja</p>
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Base inicial en efectivo</label>
            <input required type="number" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} placeholder="Ej: 100000" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
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
