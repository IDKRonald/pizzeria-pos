// src/components/CheckoutSidebar.jsx
import { useState } from 'react';
import CartItem from './CartItem';
import { formatCOP, parseMonto, tipoOrden, aplicarTipoOrden } from '../lib/venta';

// eslint-disable-next-line react-refresh/only-export-components -- lo reutiliza ModalCobro
export const TIPOS_PAGO = [
  { value: 'efectivo',        label: 'Efectivo',              icono: 'efectivo' },
  { value: 'transferencia',   label: 'Transferencia / Nequi', icono: 'transferencia' },
  { value: 'tarjeta_debito',  label: 'Tarjeta Débito',        icono: 'tarjeta' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito',       icono: 'tarjeta' },
];

const TIPOS_ORDEN = [
  { value: 'mesa',      label: 'Mesa' },
  { value: 'llevar',    label: 'Para llevar' },
  { value: 'domicilio', label: 'Domicilio' },
];

const svgProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

const estiloInput = {
  minHeight: 44, background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)',
};

const estiloAviso = {
  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--text-1)',
};

/**
 * Panel de orden: tipo de orden, mesa/domicilio, líneas, totales y acciones.
 * El pago (forma, abono, efectivo, copia, WhatsApp) vive en ModalCobro.
 */
export default function CheckoutSidebar({
  cart,
  onIncrementar,
  onDecrementar,
  onCancelar,
  onEnviarCocina,
  onAbrirCobro,
  isProcesando = false,
  esDomicilio,
  setEsDomicilio,
  costoDomicilio,
  setCostoDomicilio,
  conPropina,
  setConPropina,
  mesa,
  setMesa,
  mesas = [],
  mesaInfo = null,
  edicionBloqueada = false,
  cajaCerrada = false,
  puedeAbrirCaja = false,
  onIrACaja,
  isDrawer = false,
  onCerrar,
}) {
  // "Mesa" elegida sin número todavía: tipoOrden diría "llevar", así que se recuerda aquí.
  const [quiereMesa, setQuiereMesa] = useState(false);
  const tipoDeducido = tipoOrden({ esDomicilio, mesa });
  const tipo = tipoDeducido === 'llevar' && quiereMesa ? 'mesa' : tipoDeducido;
  const tipoBloqueado = Boolean(mesaInfo) || edicionBloqueada;

  const subtotal   = cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const propina    = conPropina ? Math.round(subtotal * 0.10) : 0;
  const domicilio  = esDomicilio ? parseMonto(costoDomicilio) : 0;
  const total      = subtotal + propina + domicilio;
  const totalItems = cart.reduce((acc, item) => acc + item.cantidad, 0);

  const elegirTipo = (nuevo) => {
    const { esDomicilio: dom, limpiarMesa } = aplicarTipoOrden(nuevo);
    setQuiereMesa(nuevo === 'mesa');
    setEsDomicilio(dom);
    if (limpiarMesa) setMesa('');
    if (!dom) setCostoDomicilio('');
  };

  const formatDomicilio = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setCostoDomicilio(raw ? parseInt(raw, 10).toLocaleString('es-CO') : '');
  };

  const handleMesaKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  };

  const sinOrden = cart.length === 0 || isProcesando || edicionBloqueada;

  return (
    <aside
      id="checkout-sidebar"
      className="no-print flex flex-col h-full w-full"
      style={{ background: 'var(--bg-surf3)', borderLeft: isDrawer ? 'none' : '1px solid var(--border-1)' }}
    >
      {/* ── Encabezado ── */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-surf4)' }}
      >
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>Orden actual</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {totalItems} {totalItems === 1 ? 'producto' : 'productos'}
          </p>
        </div>
        {isDrawer && (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar carrito"
            className="flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, background: 'var(--bg-surf6)', color: 'var(--text-2)' }}
          >
            <svg {...svgProps}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* ── Tipo de orden ── */}
        <div
          role="group"
          aria-label="Tipo de orden"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl"
          style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)' }}
        >
          {TIPOS_ORDEN.map((t) => {
            const activo = tipo === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={activo}
                disabled={tipoBloqueado}
                onClick={() => elegirTipo(t.value)}
                className="rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  minHeight: 44,
                  background: activo ? 'var(--accent)' : 'transparent',
                  color: activo ? 'var(--on-accent)' : 'var(--text-2)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Mesa ── */}
        {tipo === 'mesa' && (
          mesaInfo ? (
            <div
              className="flex items-center gap-2 px-3 rounded-lg text-sm font-bold"
              style={estiloInput}
            >
              {mesaInfo.nombre ? `${mesaInfo.nombre} · ` : ''}Mesa {mesaInfo.numero}
              {mesaInfo.grupoNombre ? ` (${mesaInfo.grupoNombre})` : ''}
            </div>
          ) : (
            <div className="space-y-2">
              {mesas.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {mesas.map((m) => {
                    const activa = mesa === String(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={activa}
                        aria-label={`Mesa ${m.numero}`}
                        disabled={edicionBloqueada}
                        onClick={() => setMesa(String(m.id))}
                        className="rounded-lg text-sm font-bold tabular-nums disabled:opacity-60"
                        style={{
                          minHeight: 44,
                          background: activa ? 'var(--accent)' : 'var(--bg-surf6)',
                          color: activa ? 'var(--on-accent)' : 'var(--text-1)',
                          border: `1px solid ${activa ? 'transparent' : 'var(--border-2)'}`,
                        }}
                      >
                        {m.numero}
                      </button>
                    );
                  })}
                </div>
              )}
              <div>
                <label htmlFor="input-mesa" className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
                  Mesa #
                </label>
                <input
                  id="input-mesa"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={mesa}
                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) setMesa(e.target.value); }}
                  onKeyDown={handleMesaKeyDown}
                  placeholder="Ej. 12"
                  className="w-full px-3 rounded-lg text-sm font-medium focus:outline-none"
                  style={estiloInput}
                />
              </div>
            </div>
          )
        )}

        {/* ── Domicilio ── */}
        {tipo === 'domicilio' && (
          <div>
            <label htmlFor="input-costo-domicilio" className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
              Costo del domicilio
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-3)' }}>$</span>
              <input
                id="input-costo-domicilio"
                type="text"
                inputMode="numeric"
                value={costoDomicilio}
                onChange={formatDomicilio}
                placeholder="Ej. 5.000"
                className="w-full pl-7 pr-3 rounded-lg text-sm font-bold focus:outline-none"
                style={estiloInput}
              />
            </div>
          </div>
        )}

        {edicionBloqueada && (
          <div className="px-3 py-2 rounded-lg text-xs font-semibold" style={estiloAviso}>
            Cocina ya tomó este pedido — no se puede modificar. Vuelve al diagrama para agregar un pedido adicional.
          </div>
        )}

        {/* ── Líneas del pedido ── */}
        <div>
          {cart.length === 0 ? (
            <p className="text-sm text-center py-8 px-4" style={{ color: 'var(--text-3)' }}>
              Toca un producto para elegir tamaño y agregarlo a la orden.
            </p>
          ) : (
            cart.map((item) => (
              <CartItem key={item.id} item={item} onIncrementar={onIncrementar} onDecrementar={onDecrementar} />
            ))
          )}
        </div>
      </div>

      {/* ── Totales y acciones ── */}
      <div
        className="px-4 py-3 space-y-2 shrink-0"
        style={{ borderTop: '1px solid var(--border-1)', background: 'var(--bg-surf4)' }}
      >
        <div className="flex justify-between text-sm" style={{ color: 'var(--text-2)' }}>
          <span>Subtotal</span>
          <span className="font-medium tabular-nums">{formatCOP(subtotal)}</span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={conPropina}
          onClick={() => setConPropina((prev) => !prev)}
          className="flex items-center justify-between gap-3 w-full text-sm"
          style={{ minHeight: 44, color: 'var(--text-2)' }}
        >
          <span className="flex items-center gap-3">
            <span
              className="relative inline-block rounded-full shrink-0"
              style={{ width: 40, height: 22, background: conPropina ? 'var(--accent)' : 'var(--border-3)' }}
            >
              <span className="absolute top-0.5 rounded-full bg-white transition-all" style={{ width: 18, height: 18, left: conPropina ? 20 : 2 }} />
            </span>
            Propina sugerida 10%
          </span>
          <span className="font-medium tabular-nums">{formatCOP(propina)}</span>
        </button>

        {esDomicilio && (
          <div className="flex justify-between text-sm" style={{ color: 'var(--text-2)' }}>
            <span>Domicilio</span>
            <span className="font-medium tabular-nums">{formatCOP(domicilio)}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--border-2)' }}>
          <span className="text-base font-bold" style={{ color: 'var(--text-1)' }}>Total</span>
          <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--text-1)' }}>{formatCOP(total)}</span>
        </div>

        {cajaCerrada && (
          <div className="px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2" style={estiloAviso}>
            <span>La caja está cerrada — {puedeAbrirCaja ? 'ábrela para poder cobrar.' : 'pídele a un cajero o admin que la abra.'}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            id="btn-enviar"
            type="button"
            onClick={onEnviarCocina}
            disabled={sinOrden}
            className="rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: 52, background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
          >
            {isProcesando ? 'Guardando...' : 'Enviar a cocina'}
          </button>
          {cajaCerrada ? (
            puedeAbrirCaja && onIrACaja ? (
              <button
                type="button"
                onClick={onIrACaja}
                className="rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{ minHeight: 52, background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                Ir a caja
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-xl font-bold text-sm opacity-50 cursor-not-allowed"
                style={{ minHeight: 52, background: 'var(--accent)', color: 'var(--on-accent)' }}
              >
                Caja cerrada
              </button>
            )
          ) : (
            <button
              id="btn-cobrar"
              type="button"
              onClick={onAbrirCobro}
              disabled={sinOrden}
              className="rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
              style={{ minHeight: 52, background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              Cobrar {formatCOP(total)}
            </button>
          )}
        </div>

        <button
          id="btn-cancelar"
          type="button"
          aria-label="Cancelar orden y vaciar carrito"
          onClick={onCancelar}
          disabled={cart.length === 0 || isProcesando}
          className="w-full text-sm font-semibold underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 44, color: 'var(--text-2)' }}
        >
          Cancelar orden
        </button>
      </div>
    </aside>
  );
}
