import { useEffect } from 'react';

/** Aviso fijo abajo al centro; se oculta solo a los 6 s. */
export default function Aviso({ aviso, onCerrar }) {
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(onCerrar, 6000);
    return () => clearTimeout(t);
  }, [aviso, onCerrar]);

  if (!aviso) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-xl pl-4 pr-1
                 border border-[var(--border-1)] shadow-lg max-w-[calc(100vw-2rem)]"
      style={{ background: 'var(--bg-surf2)', color: 'var(--text-1)' }}
    >
      <span className="text-sm py-3">{aviso.texto}</span>
      {aviso.accion && (
        <button
          type="button"
          onClick={aviso.accion.onClick}
          className="min-h-[44px] px-3 text-sm font-semibold cursor-pointer touch-manipulation
                     text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          {aviso.accion.etiqueta}
        </button>
      )}
      <button
        type="button"
        aria-label="Cerrar aviso"
        onClick={onCerrar}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer touch-manipulation
                   text-[var(--text-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}
