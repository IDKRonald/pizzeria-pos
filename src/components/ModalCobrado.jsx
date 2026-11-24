// src/components/ModalCobrado.jsx
import { useEffect, useRef } from 'react';
import { formatCOP } from '../lib/venta';

const MENSAJES_IMPRESION = {
  original: 'Se abrió la impresión del comprobante. Si no salió, toca "Imprimir comprobante" otra vez.',
  copia: 'Se abrió la impresión de la copia. Si no salió, toca "Imprimir copia" otra vez.',
};

/**
 * Confirmación después de cobrar: el pago ya quedó guardado, así que imprimir o enviar
 * el comprobante es opcional y se puede repetir sin afectar el cobro.
 */
export default function ModalCobrado({ recibo, impresion, onImprimir, onWhatsApp, onCerrar }) {
  const primerBotonRef = useRef(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; });

  useEffect(() => {
    if (!recibo) return undefined;
    primerBotonRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); cerrarRef.current(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [recibo]);

  if (!recibo) return null;

  const pagadoAntes = recibo.montoPagadoHistorico || 0;
  const saldo = Math.max(0, recibo.total - pagadoAntes - recibo.pagoActual);
  const cambio = recibo.tipoPago === 'efectivo' ? Math.max(0, (recibo.montoEntregado || 0) - recibo.pagoActual) : 0;

  const btn = 'w-full min-h-[48px] rounded-xl text-sm font-bold cursor-pointer touch-manipulation focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cobrado-titulo"
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 border border-[var(--border-1)]"
        style={{ background: 'var(--bg-surf2)', color: 'var(--text-1)' }}>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <h2 id="cobrado-titulo" className="text-xl font-extrabold">
            {saldo > 0 ? 'Abono registrado' : 'Cobro registrado'}
          </h2>
          <p className="text-sm text-[var(--text-3)]">Orden {recibo.ordenNumero}</p>
          <p className="text-3xl font-extrabold tabular-nums">{formatCOP(recibo.pagoActual)}</p>
          {cambio > 0 && <p className="text-base font-bold" style={{ color: '#10b981' }}>Cambio: {formatCOP(cambio)}</p>}
          {saldo > 0 && <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>Queda debiendo {formatCOP(saldo)}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <button ref={primerBotonRef} type="button" onClick={() => onImprimir('original')} className={btn}
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            Imprimir comprobante
          </button>
          <button type="button" onClick={() => onImprimir('copia')} className={`${btn} border border-[var(--border-2)]`}>
            Imprimir copia para el local
          </button>
          <button type="button" onClick={onWhatsApp} className={`${btn} border border-[var(--border-2)]`}>
            Enviar por WhatsApp
          </button>
          {impresion && <p role="status" className="text-xs text-center text-[var(--text-3)]">{MENSAJES_IMPRESION[impresion]}</p>}
        </div>

        <button type="button" onClick={onCerrar} className={`${btn} border border-[var(--border-2)]`}>
          Nueva venta
        </button>
      </div>
    </div>
  );
}
