// src/components/CartItem.jsx

/**
 * Fila de ítem dentro del sidebar de Checkout.
 * Muestra nombre, controles de cantidad y subtotal.
 * Usa CSS custom properties para soporte de temas claro/oscuro.
 */
const formatCOP = (valor) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function CartItem({ item, onIncrementar, onDecrementar }) {
  return (
    <div
      className="flex items-center gap-2 py-3 last:border-0"
      style={{ borderBottom: '1px solid var(--border-1)' }}
    >
      {/* Emoji */}
      <span className="text-2xl shrink-0 select-none">{item.imagen}</span>

      {/* Info central */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold truncate leading-snug"
          style={{ color: 'var(--text-2)' }}
        >
          {item.nombre}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
          {formatCOP(item.precio)} c/u
        </p>
      </div>

      {/* Control de cantidad */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          id={`btn-decrementar-${item.id}`}
          aria-label={`Quitar una unidad de ${item.nombre}`}
          onClick={() => onDecrementar(item.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     text-base font-bold transition-colors duration-150 active:scale-90"
          style={{ background: 'var(--qty-btn-bg)', color: 'var(--text-2)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(185,28,28,0.55)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--qty-btn-bg)'; e.currentTarget.style.color = 'var(--text-2)'; }}
        >
          −
        </button>

        <span
          className="w-6 text-center text-sm font-bold tabular-nums"
          style={{ color: 'var(--text-1)' }}
        >
          {item.cantidad}
        </span>

        <button
          id={`btn-incrementar-${item.id}`}
          aria-label={`Agregar una unidad más de ${item.nombre}`}
          onClick={() => onIncrementar(item.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     text-base font-bold transition-colors duration-150 active:scale-90"
          style={{ background: 'var(--qty-btn-bg)', color: 'var(--text-2)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(5,150,105,0.55)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--qty-btn-bg)'; e.currentTarget.style.color = 'var(--text-2)'; }}
        >
          +
        </button>
      </div>

      {/* Subtotal del ítem */}
      <p className="text-sm font-bold text-orange-400 w-20 text-right shrink-0 tabular-nums">
        {formatCOP(item.precio * item.cantidad)}
      </p>
    </div>
  );
}
