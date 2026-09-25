// src/components/CheckoutSidebar.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CartItem from './CartItem';

/**
 * Sidebar derecho: lista del carrito, tipo de pago, domicilio, totales y botones.
 * Usa CSS custom properties para soporte de temas claro/oscuro.
 */
const formatCOP = (valor) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const TIPOS_PAGO = [
  { value: 'efectivo',        label: '💵 Efectivo' },
  { value: 'transferencia',   label: '📲 Transferencia / Nequi' },
  { value: 'tarjeta_debito',  label: '💳 Tarjeta Débito' },
  { value: 'tarjeta_credito', label: '💳 Tarjeta Crédito' },
];

export default function CheckoutSidebar({
  cart,
  onIncrementar,
  onDecrementar,
  onCancelar,
  onCobrar,
  onEnviarCocina,
  isProcesando = false,
  tipoPago,
  setTipoPago,
  esDomicilio,
  setEsDomicilio,
  costoDomicilio,
  setCostoDomicilio,
  conPropina,
  setConPropina,
  mesa,
  setMesa,
  mesaInfo = null,
  edicionBloqueada = false,
  cajaCerrada = false,
  puedeAbrirCaja = false,
  onIrACaja,
  imprimirCopia,
  setImprimirCopia,
  montoEntregado,
  setMontoEntregado,
  isDrawer = false,
  onCerrar,
  facturarAhorita,
  setFacturarAhorita,
  montoAbonar,
  setMontoAbonar,
  saldoRestante = 0,
}) {
  const { usuario } = useAuth();
  const handleMesaKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    }
  };
  const subtotal   = cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const propina    = conPropina ? Math.round(subtotal * 0.10) : 0;
  const domicilio  = esDomicilio ? (parseInt(String(costoDomicilio).replace(/\D/g, '')) || 0) : 0;
  const total      = subtotal + propina + domicilio;
  const totalItems = cart.reduce((acc, item) => acc + item.cantidad, 0);

  const formatDomicilio = (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) setCostoDomicilio('');
    else setCostoDomicilio(parseInt(raw, 10).toLocaleString('es-CO'));
  };

  const formatMontoAbonar = (e) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (!raw) setMontoAbonar('');
    else setMontoAbonar(parseInt(raw, 10).toLocaleString('es-CO'));
  };

  const formatMonto = (e) => {
    let raw = e.target.value.replace(/\D/g, ''); // Solo números
    if (!raw) setMontoEntregado('');
    else {
      // Remover ceros iniciales si los hay, menos el propio cero
      raw = parseInt(raw, 10).toString();
      // Formatear como moneda para mejor visual
      setMontoEntregado(parseInt(raw, 10).toLocaleString('es-CO'));
    }
  };

  const parseMontoNumerico = () => parseInt(montoEntregado.toString().replace(/\D/g, '')) || 0;
  const numEntregado = parseMontoNumerico();
  const devuelta = numEntregado >= total ? numEntregado - total : 0;

  return (
    <aside
      id="checkout-sidebar"
      className="no-print flex flex-col h-full w-full"
      style={{
        background: 'var(--bg-surf3)',
        borderLeft: isDrawer ? 'none' : '1px solid var(--border-1)',
      }}
    >
      {/* ── Handle para el drawer móvil ── */}
      {isDrawer && (
        <div
          className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          <div className="w-12 h-1 rounded-full mx-auto" style={{ background: 'var(--border-3)' }} />
          <button
            onClick={onCerrar}
            aria-label="Cerrar carrito"
            className="absolute right-4 top-3.5 w-8 h-8 flex items-center justify-center
                       rounded-full text-sm font-bold"
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}
          >
            ✕
          </button>
        </div>
      )}
      {/* ── Encabezado ── */}
      <div
        className="px-5 py-4"
        style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-surf4)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
              Orden Actual
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {totalItems === 0
                ? 'Sin productos'
                : `${totalItems} ${totalItems === 1 ? 'producto' : 'productos'}`}
            </p>
          </div>
          {totalItems > 0 && (
            <span className="flex items-center justify-center w-8 h-8 rounded-full
                             bg-orange-500 text-white text-sm font-bold">
              {totalItems}
            </span>
          )}
        </div>
      </div>

      {/* ── Lista de ítems ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {cart.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full gap-3"
            style={{ color: 'var(--text-4)' }}
          >
            <span className="text-5xl">🛒</span>
            <p className="text-sm font-medium">El carrito está vacío</p>
            <p className="text-xs text-center">Agrega productos desde la cuadrícula</p>
          </div>
        ) : (
          cart.map((item) => (
            <CartItem
              key={item.id}
              item={item}
              onIncrementar={onIncrementar}
              onDecrementar={onDecrementar}
            />
          ))
        )}
      </div>

      {/* ── Bloque inferior ── */}
      <div
        className="px-5 py-4 space-y-3"
        style={{ borderTop: '1px solid var(--border-1)', background: 'var(--bg-surf4)' }}
      >
        {/* Toggle Facturar */}
        <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)' }}>
          <span className="text-xs font-bold text-white uppercase tracking-wider">¿Facturar / Abonar ahora?</span>
          <button
            onClick={() => setFacturarAhorita(!facturarAhorita)}
            className={`w-10 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${facturarAhorita ? 'bg-emerald-500' : 'bg-gray-600'}`}
          >
            <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${facturarAhorita ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* ── Ajustes Compactos ── */}
        {facturarAhorita && (
          <div className="grid grid-cols-2 gap-2 animate-[fadeIn_0.2s_ease-out]">
            {/* Tipo de pago */}
            <div>
              <label htmlFor="select-tipo-pago" className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                Pago
              </label>
              <select
                id="select-tipo-pago"
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-medium focus:outline-none transition-colors duration-150 cursor-pointer"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
              >
                {TIPOS_PAGO.map((tp) => (
                  <option key={tp.value} value={tp.value}>{tp.label}</option>
                ))}
              </select>
            </div>
            {/* Monto a Abonar */}
            <div>
              <label htmlFor="input-abono" className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                Abono
              </label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-4)' }}>$</span>
                <input
                  id="input-abono"
                  type="text"
                  inputMode="numeric"
                  value={montoAbonar}
                  onChange={formatMontoAbonar}
                  placeholder={saldoRestante.toLocaleString('es-CO')}
                  className="w-full pl-6 pr-2 py-1.5 rounded-lg text-xs font-medium focus:outline-none transition-colors duration-150"
                  style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-2)'; }}
                />
              </div>
            </div>
          </div>
        )}

        {!esDomicilio && (
          <div className="grid grid-cols-1 gap-2">
            {mesaInfo ? (
              /* Mesa fijada desde el diagrama — solo lectura */
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                  Mesa
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}>
                  🪑 {mesaInfo.nombre ? `${mesaInfo.nombre} · ` : ''}Mesa {mesaInfo.numero}
                  {mesaInfo.grupoNombre ? ` (${mesaInfo.grupoNombre})` : ''}
                </div>
              </div>
            ) : (
              /* Input Mesa */
              <div>
                <label htmlFor="input-mesa" className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
                  Mesa #
                </label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs select-none" style={{ color: 'var(--text-4)' }}>🪑</span>
                  <input
                    id="input-mesa"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={mesa}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val)) setMesa(val);
                    }}
                    onKeyDown={handleMesaKeyDown}
                    placeholder="Ej. 12"
                    className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs font-medium focus:outline-none transition-colors duration-150"
                    style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {edicionBloqueada && (
          <div className="px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            🔒 Cocina ya tomó este pedido — no se puede modificar. Vuelve al diagrama para agregar un pedido adicional.
          </div>
        )}

        {facturarAhorita && cajaCerrada && (
          <div className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            <span>🔒 La caja está cerrada — {puedeAbrirCaja ? 'ábrela para poder cobrar.' : 'pídele a un cajero o admin que la abra.'}</span>
            {puedeAbrirCaja && onIrACaja && (
              <button type="button" onClick={onIrACaja}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0"
                style={{ background: 'rgba(239,68,68,0.25)', color: '#fff' }}>
                Abrir caja
              </button>
            )}
          </div>
        )}

        {/* Input Costo Domicilio (solo si es domicilio) */}
        {esDomicilio && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <label htmlFor="input-costo-domicilio" className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
              🛵 Costo del Domicilio
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-4)' }}>$</span>
              <input
                id="input-costo-domicilio"
                type="text"
                inputMode="numeric"
                value={costoDomicilio}
                onChange={formatDomicilio}
                placeholder="Ej. 5.000"
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-sm font-bold focus:outline-none transition-colors duration-150"
                style={{ background: 'var(--bg-surf6)', border: '1px solid rgba(249,115,22,0.5)', color: 'var(--text-1)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.8)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.5)'; }}
              />
            </div>
          </div>
        )}

        {/* Input Monto Entregado (Solo Efectivo) */}
        {facturarAhorita && tipoPago === 'efectivo' && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <label htmlFor="input-monto" className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
              Efectivo Recibido
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-4)' }}>$</span>
              <input
                id="input-monto"
                type="text"
                inputMode="numeric"
                value={montoEntregado}
                onChange={formatMonto}
                placeholder={(parseInt(String(montoAbonar).replace(/\D/g, '')) || saldoRestante).toLocaleString('es-CO')}
                className="w-full pl-7 pr-2 py-1.5 rounded-lg text-sm font-bold focus:outline-none transition-colors duration-150"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-2)'; }}
              />
            </div>
            {(() => {
              const numAbonoActual = parseInt(String(montoAbonar).replace(/\D/g, '')) || saldoRestante;
              if (numEntregado > 0 && numEntregado < numAbonoActual) {
                 return <p className="text-[10px] mt-1 text-red-400 font-bold">⚠️ Faltan {formatCOP(numAbonoActual - numEntregado)}</p>;
              }
              if (numEntregado > 0 && numEntregado >= numAbonoActual) {
                 return <p className="text-xs mt-1 text-emerald-400 font-bold">Cambio: {formatCOP(numEntregado - numAbonoActual)}</p>;
              }
              return null;
            })()}
          </div>
        )}

        {/* ── Botones de Ajuste Rápidos ── */}
        <div className="grid grid-cols-3 gap-2">
          {/* Domicilio toggle */}
          <button
            onClick={() => {
              setEsDomicilio((prev) => !prev);
              if (esDomicilio) {
                setCostoDomicilio('');
              } else {
                setMesa('');
              }
            }}
            className="flex flex-col items-center justify-center p-2 rounded-xl transition-all shadow-sm border border-transparent focus:outline-none"
            style={{
              background: esDomicilio ? 'rgb(249,115,22)' : 'var(--bg-surf6)',
              color: esDomicilio ? '#fff' : 'var(--text-3)',
              borderColor: esDomicilio ? 'transparent' : 'var(--border-2)',
            }}
          >
            <span className="text-lg leading-none mb-1">🛵</span>
            <span className="text-[10px] font-extrabold tracking-wide uppercase leading-none">Domicilio</span>
          </button>

          <button
            onClick={() => setConPropina((prev) => !prev)}
            className="flex flex-col items-center justify-center p-2 rounded-xl transition-all shadow-sm border border-transparent focus:outline-none"
            style={{
              background: conPropina ? 'rgb(249,115,22)' : 'var(--bg-surf6)',
              color: conPropina ? '#fff' : 'var(--text-3)',
              borderColor: conPropina ? 'transparent' : 'var(--border-2)',
            }}
          >
            <span className="text-lg leading-none mb-1">🤝</span>
            <span className="text-[10px] font-extrabold tracking-wide uppercase leading-none">Propina</span>
          </button>

          <button
            onClick={() => setImprimirCopia((prev) => !prev)}
            className="flex flex-col items-center justify-center p-2 rounded-xl transition-all shadow-sm border border-transparent focus:outline-none"
            style={{
              background: imprimirCopia ? 'rgb(5,150,105)' : 'var(--bg-surf6)',
              color: imprimirCopia ? '#fff' : 'var(--text-3)',
              borderColor: imprimirCopia ? 'transparent' : 'var(--border-2)',
            }}
          >
            <span className="text-lg leading-none mb-1">🖨️</span>
            <span className="text-[10px] font-extrabold tracking-wide uppercase leading-none">+ Copia</span>
          </button>
        </div>

        {/* Totales */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-3)' }}>
            <span>Subtotal</span>
            <span className="font-medium" style={{ color: 'var(--text-2)' }}>
              {formatCOP(subtotal)}
            </span>
          </div>
          {conPropina && (
            <div className="flex justify-between text-sm" style={{ color: 'rgb(249,115,22)' }}>
              <span>Propina (10%)</span>
              <span className="font-medium">{formatCOP(propina)}</span>
            </div>
          )}
          {esDomicilio && domicilio > 0 && (
            <div className="flex justify-between text-sm" style={{ color: 'rgb(249,115,22)' }}>
              <span>🛵 Domicilio</span>
              <span className="font-medium">{formatCOP(domicilio)}</span>
            </div>
          )}
          <div
            className="border-t pt-2 mt-1"
            style={{ borderColor: 'var(--border-2)' }}
          />
          <div className="flex justify-between items-center">
            <span className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
              Total a Cobrar
            </span>
            <span className="text-2xl font-extrabold text-emerald-400 tabular-nums">
              {formatCOP(total)}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-2 pt-1">
          {facturarAhorita ? (
            <button
              id="btn-cobrar"
              onClick={onCobrar}
              disabled={cart.length === 0 || isProcesando || edicionBloqueada || cajaCerrada || (parseInt(String(montoAbonar).replace(/\D/g, '')) === 0 && saldoRestante === 0)}
              className="flex-1 py-3.5 rounded-xl font-bold text-base shadow-lg text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, rgb(5,150,105), rgb(4,120,87))' }}
            >
              {isProcesando ? 'Cobrando...' : '💵 Registrar Pago'}
            </button>
          ) : (
            <button
              id="btn-enviar"
              onClick={onEnviarCocina}
              disabled={cart.length === 0 || isProcesando || edicionBloqueada}
              className="flex-1 py-3.5 rounded-xl font-bold text-base shadow-lg text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgb(249,115,22)' }}
            >
              {isProcesando ? 'Guardando...' : '👨‍🍳 Guardar / Enviar a Cocina'}
            </button>
          )}
          <button
            id="btn-cancelar"
            aria-label="Cancelar orden y vaciar carrito"
            onClick={onCancelar}
            disabled={cart.length === 0 || isProcesando}
            className="w-full py-2.5 rounded-xl font-semibold text-sm
                       bg-transparent hover:bg-red-700/15 active:scale-95
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-red-400 hover:text-red-300 transition-all duration-150"
            style={{ border: '1px solid rgba(185,28,28,0.5)' }}
          >
            <span className="flex items-center justify-center gap-2">
              ✕ Cancelar Orden
              <kbd
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-md opacity-50"
                style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.3)' }}
              >
                Esc
              </kbd>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
