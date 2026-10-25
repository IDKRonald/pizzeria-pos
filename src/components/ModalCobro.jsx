// src/components/ModalCobro.jsx
import { useEffect, useRef } from 'react';
import { TIPOS_PAGO } from './CheckoutSidebar';
import {
  formatCOP, parseMonto, billetesRapidos, calcularCambio, puedeConfirmarCobro,
} from '../lib/venta';

const svgProps = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

function Icono({ nombre }) {
  if (nombre === 'efectivo') {
    return (<svg {...svgProps}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>);
  }
  if (nombre === 'transferencia') {
    return (<svg {...svgProps}><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg>);
  }
  if (nombre === 'cerrar') {
    return (<svg {...svgProps}><path d="M6 6l12 12M18 6L6 18" /></svg>);
  }
  return (<svg {...svgProps}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>);
}

// Deja solo dígitos con separador de miles (o vacío).
const formatearInput = (setter) => (e) => {
  const hay = e.target.value.replace(/\D/g, '') !== '';
  setter(hay ? parseMonto(e.target.value).toLocaleString('es-CO') : '');
};

function Interruptor({ etiqueta, activo, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onChange(!activo)}
      className="flex items-center justify-between gap-3 w-full px-3 rounded-lg text-sm font-semibold"
      style={{ minHeight: 44, background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
    >
      <span>{etiqueta}</span>
      <span
        className="relative inline-block rounded-full shrink-0"
        style={{ width: 40, height: 22, background: activo ? 'var(--accent)' : 'var(--border-3)' }}
      >
        <span
          className="absolute top-0.5 rounded-full bg-white transition-all"
          style={{ width: 18, height: 18, left: activo ? 20 : 2 }}
        />
      </span>
    </button>
  );
}

function CampoMonto({ id, etiqueta, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-3)' }}>
        {etiqueta}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-3)' }}>$</span>
        <input
          id={id} type="text" inputMode="numeric" value={value} onChange={onChange}
          placeholder={placeholder}
          className="w-full pl-7 pr-3 rounded-lg text-base font-bold focus:outline-none"
          style={{ minHeight: 44, background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
        />
      </div>
    </div>
  );
}

/** Modal de cobro: forma de pago, abono, efectivo recibido y confirmación. */
export default function ModalCobro({
  abierto, onCerrar, total, saldoRestante = 0,
  tipoPago, setTipoPago, esDomicilio, costoDomicilio, setCostoDomicilio,
  facturarAhorita, setFacturarAhorita, montoAbonar, setMontoAbonar,
  montoEntregado, setMontoEntregado, imprimirCopia, setImprimirCopia,
  enviarWhatsapp, setEnviarWhatsapp, isProcesando = false, onConfirmar,
}) {
  const dialogoRef = useRef(null);
  // Ref para que un onCerrar inline no reinicie el efecto de foco en cada render.
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; });

  // Al abrir: foco en el primer botón de pago; Esc cierra; Tab queda atrapado.
  useEffect(() => {
    if (!abierto) return undefined;
    const previo = document.activeElement;
    dialogoRef.current?.querySelector('[data-pago]')?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrarRef.current(); return; }
      if (e.key !== 'Tab' || !dialogoRef.current) return;
      const foco = [...dialogoRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled])',
      )];
      if (!foco.length) return;
      const primero = foco[0];
      const ultimo = foco[foco.length - 1];
      const dentro = dialogoRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === primero || !dentro)) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) {
        e.preventDefault(); primero.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previo?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;

  // Mismo significado que PosPage.handleCobrar: sin abono escrito se paga el saldo restante;
  // si no se factura ahora no se paga nada en este momento.
  const hayAbono = String(montoAbonar ?? '').replace(/\D/g, '') !== '';
  const aPagar = facturarAhorita ? (hayAbono ? parseMonto(montoAbonar) : saldoRestante) : 0;
  const recibido = parseMonto(montoEntregado);
  const esEfectivo = tipoPago === 'efectivo';
  const puede = puedeConfirmarCobro({ tipoPago, recibido, aPagar, isProcesando });

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-overlay)' }}    >
      <div
        ref={dialogoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cobro-titulo"
        className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--bg-surf3)', border: '1px solid var(--border-2)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="modal-cobro-titulo" className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>Cobrar</h2>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Total {formatCOP(total)}</p>
          </div>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar cobro"
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 44, height: 44, background: 'var(--bg-surf6)', color: 'var(--text-2)' }}
          >
            <Icono nombre="cerrar" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Forma de pago">
          {TIPOS_PAGO.map((tp) => {
            const activo = tipoPago === tp.value;
            return (
              <button
                key={tp.value} type="button" data-pago aria-pressed={activo}
                onClick={() => setTipoPago(tp.value)}
                className="flex items-center gap-2 px-3 rounded-lg text-sm font-semibold text-left"
                style={{
                  minHeight: 44,
                  background: activo ? 'var(--accent)' : 'var(--bg-surf6)',
                  color: activo ? 'var(--on-accent)' : 'var(--text-1)',
                  border: `1px solid ${activo ? 'var(--accent)' : 'var(--border-2)'}`,
                }}
              >
                <Icono nombre={tp.icono} />
                <span>{tp.label}</span>
              </button>
            );
          })}
        </div>

        <Interruptor etiqueta="Facturar ahora" activo={facturarAhorita} onChange={setFacturarAhorita} />

        {facturarAhorita ? (
          <>
            <CampoMonto
              id="modal-abono" etiqueta="Abono" value={montoAbonar}
              onChange={formatearInput(setMontoAbonar)}
              placeholder={saldoRestante.toLocaleString('es-CO')}
            />
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Saldo restante: {formatCOP(Math.max(0, saldoRestante - aPagar))}
            </p>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            No se registra pago ahora. Saldo pendiente: {formatCOP(saldoRestante)}
          </p>
        )}

        {esEfectivo && facturarAhorita && (
          <div className="space-y-2">
            <CampoMonto
              id="modal-recibido" etiqueta="Recibido" value={montoEntregado}
              onChange={formatearInput(setMontoEntregado)}
              placeholder={aPagar.toLocaleString('es-CO')}
            />
            <div className="flex flex-wrap gap-2">
              {billetesRapidos(aPagar).map((b) => (
                <button
                  key={b} type="button" onClick={() => setMontoEntregado(b.toLocaleString('es-CO'))}
                  className="px-3 rounded-lg text-sm font-semibold"
                  style={{ minHeight: 44, background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                >
                  {formatCOP(b)}
                </button>
              ))}
            </div>
            <p className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
              Cambio · {formatCOP(calcularCambio(recibido, aPagar))}
            </p>
          </div>
        )}

        {esDomicilio && (
          <CampoMonto
            id="modal-domicilio" etiqueta="Costo del domicilio" value={costoDomicilio}
            onChange={formatearInput(setCostoDomicilio)} placeholder="Ej. 5.000"
          />
        )}

        <div className="space-y-2">
          <Interruptor etiqueta="Imprimir copia" activo={imprimirCopia} onChange={setImprimirCopia} />
          <Interruptor etiqueta="Enviar por WhatsApp" activo={enviarWhatsapp} onChange={setEnviarWhatsapp} />
        </div>

        <button
          type="button" onClick={onConfirmar} disabled={!puede}
          className="w-full rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 48, background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          {isProcesando ? 'Cobrando...' : `Confirmar cobro · ${formatCOP(aPagar)}`}
        </button>
      </div>
    </div>
  );
}
