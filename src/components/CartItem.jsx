// src/components/CartItem.jsx
import { formatCOP } from '../lib/venta';

const svgProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};

/**
 * Línea del pedido en el panel de orden: nombre, tamaño · precio,
 * stepper de cantidad (botones de 44px) y total de la línea.
 */
export default function CartItem({ item, onIncrementar, onDecrementar }) {
  const tamano = item.tamano || item.tamanio || item.nombreTamanio || '';
  const detalle = tamano ? `${tamano} · ${formatCOP(item.precio)}` : formatCOP(item.precio);
  const estiloBoton = { width: 44, height: 44, background: 'var(--qty-btn-bg)', color: 'var(--text-1)' };

  return (
    <div className="flex items-center gap-2 py-2 last:border-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-1)' }}>{item.nombre}</p>
        <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-3)' }}>{detalle}</p>
        {item.notas && (
          <p className="text-xs mt-0.5 italic" style={{ color: 'var(--text-3)' }}>{item.notas}</p>
        )}
      </div>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          id={`btn-decrementar-${item.id}`}
          aria-label={`Quitar uno de ${item.nombre}`}
          onClick={() => onDecrementar(item.id)}
          className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
          style={estiloBoton}
        >
          <svg {...svgProps}><path d="M5 12h14" /></svg>
        </button>
        <span className="w-7 text-center text-sm font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>
          {item.cantidad}
        </span>
        <button
          type="button"
          id={`btn-incrementar-${item.id}`}
          aria-label={`Agregar uno de ${item.nombre}`}
          onClick={() => onIncrementar(item.id)}
          className="flex items-center justify-center rounded-lg active:scale-90 transition-transform"
          style={estiloBoton}
        >
          <svg {...svgProps}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      <p className="text-sm font-bold w-20 text-right shrink-0 tabular-nums" style={{ color: 'var(--text-1)' }}>
        {formatCOP(item.precio * item.cantidad)}
      </p>
    </div>
  );
}
