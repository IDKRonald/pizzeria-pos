// src/components/ModalComboBebida.jsx
// Modal de selección de la bebida incluida en un combo (ej. "Hamburguesa en Combo").
// Sigue el mismo patrón visual/interacción que ModalVariantes.jsx.

const formatCOP = (valor) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function ModalComboBebida({ producto, onSeleccionar, onCerrar }) {
  if (!producto) return null;
  const { comboSlot } = producto;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Elegir bebida para ${producto.nombre}`}
    >
      <div
        className="w-full max-w-sm flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-[fadeScaleIn_0.18s_ease-out]"
        style={{ background: 'var(--bg-surf4)', border: '1px solid var(--border-1)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
          <span className="text-5xl select-none leading-none">{producto.imagen}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>{producto.nombre}</h3>
            <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{comboSlot?.nombreSlot || 'Elige tu bebida'}</p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar selector de combo"
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 text-sm font-bold transition-colors duration-150 hover:opacity-70"
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {(!comboSlot?.opciones || comboSlot.opciones.length === 0) ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-4)' }}>
              No hay opciones de bebida configuradas para este combo.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {comboSlot.opciones.map((op) => (
                <button
                  key={op.id}
                  onClick={() => onSeleccionar(producto, op)}
                  className="group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-150 text-left active:scale-[0.98]"
                  style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-1)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-1)'; e.currentTarget.style.background = 'var(--bg-surf6)'; }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{op.imagen}</span>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{op.nombre}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(249,115,22,0.15)', color: 'rgb(249,115,22)' }}>
                    Incluida
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-center" style={{ borderTop: '1px solid var(--border-1)' }}>
          <span className="text-xs" style={{ color: 'var(--text-4)' }}>Precio del combo: </span>
          <span className="text-sm font-extrabold text-orange-400">{formatCOP(producto.precio)}</span>
        </div>
      </div>
    </div>
  );
}
