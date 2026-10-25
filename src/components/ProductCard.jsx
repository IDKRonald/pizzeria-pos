// src/components/ProductCard.jsx
import { useState } from 'react';
import { formatCOP, precioDesde, tonoProducto } from '../lib/venta';

/**
 * Tarjeta visual de cada producto del menú.
 * - Combo: abre el modal de bebida.
 * - Con `variantes` (pizzas): abre el modal de selección de tamaño.
 * - Sin variantes: agrega directamente al carrito.
 */
export default function ProductCard({ producto, onAgregar, onAbrirVariantes, onAbrirCombo }) {
  const [falloImagen, setFalloImagen] = useState(false);
  const tieneVariantes = producto.variantes && producto.variantes.length > 0;

  const handleClick = () => {
    if (producto.esCombo) {
      onAbrirCombo(producto);
    } else if (tieneVariantes) {
      onAbrirVariantes(producto);
    } else {
      onAgregar(producto);
    }
  };

  const esFoto = !!producto.imagen &&
    (producto.imagen.startsWith('/uploads/') || producto.imagen.startsWith('http'));
  const srcFoto = esFoto
    ? (producto.imagen.startsWith('/')
        ? `http://${window.location.hostname}:3001${producto.imagen}`
        : producto.imagen)
    : null;

  return (
    <button
      type="button"
      id={`btn-agregar-${producto.id}`}
      aria-label={`Elegir ${producto.nombre}`}
      onClick={handleClick}
      className="group flex flex-col overflow-hidden rounded-2xl text-left cursor-pointer
                 transition-colors duration-150 touch-manipulation
                 border border-[var(--border-1)] hover:border-[var(--accent)]
                 focus-visible:border-[var(--accent)] focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      style={{ background: 'var(--bg-surf2)' }}
    >
      {/* Foto 4:3 o bloque de color si no hay foto */}
      <div className="w-full aspect-[4/3] overflow-hidden"
        style={{ background: tonoProducto(producto.id) }}>
        {srcFoto && !falloImagen && (
          <img
            src={srcFoto}
            alt=""
            loading="lazy"
            onError={() => setFalloImagen(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-col gap-1 p-3">
        <span className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]"
          style={{ color: 'var(--text-1)' }}>
          {producto.nombre}
        </span>
        <span className="text-sm font-bold" style={{ color: 'var(--text-3)' }}>
          {`Desde ${formatCOP(precioDesde(producto))}`}
        </span>
      </div>
    </button>
  );
}
