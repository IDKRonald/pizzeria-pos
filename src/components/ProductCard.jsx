// src/components/ProductCard.jsx

/**
 * Tarjeta visual de cada producto del menú.
 * - Si el producto tiene `variantes` (pizzas): abre el modal de selección de tamaño.
 * - Si no tiene variantes: agrega directamente al carrito.
 */
const formatCOP = (valor) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

export default function ProductCard({ producto, onAgregar, onAbrirVariantes, onAbrirCombo }) {
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

  return (
    <div
      className="group relative flex flex-col items-center gap-2 rounded-2xl p-4
                 transition-all duration-200 cursor-pointer shadow-md
                 hover:shadow-orange-500/10 hover:shadow-xl hover:-translate-y-0.5"
      style={{
        background: 'var(--bg-surf2)',
        border: '1px solid var(--border-2)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)';
        e.currentTarget.style.background = 'var(--bg-surf7)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-2)';
        e.currentTarget.style.background = 'var(--bg-surf2)';
      }}
      onClick={handleClick}
    >
      {/* Imagen o emoji del producto */}
      {producto.imagen && (producto.imagen.startsWith('/uploads/') || producto.imagen.startsWith('http')) ? (
        <div className="w-16 h-16 rounded-xl overflow-hidden transition-transform duration-200 group-hover:scale-110 flex-shrink-0">
          <img
            src={producto.imagen.startsWith('/') ? `http://${window.location.hostname}:3001${producto.imagen}` : producto.imagen}
            alt={producto.nombre}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="text-5xl select-none transition-transform duration-200 group-hover:scale-110">
          {producto.imagen || '🍽️'}
        </div>
      )}

      {/* Nombre */}
      <p
        className="text-center text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]"
        style={{ color: 'var(--text-2)' }}
      >
        {producto.nombre}
      </p>

      {/* Precio (o rango de precios) */}
      <p className="text-base font-bold text-orange-400">
        {tieneVariantes
          ? `Desde ${formatCOP(producto.precioDesde)}`
          : formatCOP(producto.precio)}
      </p>

      {/* Botón de acción */}
      <button
        id={`btn-agregar-${producto.id}`}
        aria-label={
          producto.esCombo
            ? `Elegir bebida del combo ${producto.nombre}`
            : tieneVariantes
            ? `Ver tamaños de ${producto.nombre}`
            : `Agregar ${producto.nombre} al carrito`
        }
        onClick={(e) => { e.stopPropagation(); handleClick(); }}
        className="w-full mt-1 py-2 rounded-xl text-sm font-semibold
                   active:scale-95 text-white transition-all duration-150 shadow-md"
        style={{
          background: producto.esCombo
            ? 'linear-gradient(135deg, #7c3aed, #dc2626)'
            : tieneVariantes
            ? 'linear-gradient(135deg, #ea6c10, #dc2626)'
            : 'rgb(5,150,105)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.88';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        {producto.esCombo ? '🥤 Elegir bebida' : tieneVariantes ? '📐 Ver tamaños' : '+ Agregar'}
      </button>
    </div>
  );
}
