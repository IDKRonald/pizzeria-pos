import { useState } from 'react';
import ZonaFoto from './ZonaFoto';
import { formatoMiles, parsePrecio, tieneFoto, urlImagen } from '../../lib/carta';

const IconoCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';

function precioMinimo(producto) {
  const precios = (producto.variantes || []).map((v) => Number(v.precio)).filter((n) => Number.isFinite(n));
  return precios.length ? Math.min(...precios) : Number(producto.precio) || 0;
}

/** Tarjeta de un producto en la pantalla de carta. */
export default function TarjetaProducto({ producto, seleccionado, onEditar, onFotoSubida, onGuardarPrecio, onToggleVisible, onError }) {
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [valor, setValor] = useState('');
  const [fotoFallida, setFotoFallida] = useState(null);
  const conTamanos = !!producto.tiene_variantes || (producto.variantes || []).length > 0;
  const visible = !!producto.activo;
  const hayFoto = tieneFoto(producto.imagen) && fotoFallida !== producto.imagen;

  const empezarPrecio = () => {
    setValor(formatoMiles(Number(producto.precio) || 0));
    setEditandoPrecio(true);
  };

  const guardarPrecio = () => {
    const n = parsePrecio(valor);
    if (n === null) return;
    setEditandoPrecio(false);
    if (n !== Number(producto.precio)) onGuardarPrecio(n);
  };

  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl transition-opacity"
      style={{
        background: 'var(--bg-surf2)',
        border: `1px solid ${seleccionado ? 'var(--accent)' : 'var(--border-1)'}`,
        opacity: visible ? 1 : 0.55,
      }}
    >
      {hayFoto ? (
        <button type="button" onClick={onEditar} aria-label={`Editar ${producto.nombre}`}
          className={`w-full aspect-[4/3] overflow-hidden cursor-pointer touch-manipulation ${foco}`}
          style={{ background: 'var(--tono-l)' }}>
          <img src={urlImagen(producto.imagen)} alt="" loading="lazy"
            onError={() => setFotoFallida(producto.imagen)} className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="p-2 pb-0">
          <ZonaFoto imagen={producto.imagen} nombre={producto.nombre} variante="tarjeta"
            onSubida={onFotoSubida} onError={onError} />
        </div>
      )}

      <div className="flex flex-col gap-1 p-3">
        <button type="button" onClick={onEditar}
          className={`text-left text-sm font-semibold leading-tight min-h-[44px] cursor-pointer touch-manipulation
                      text-[var(--text-1)] hover:text-[var(--accent)] ${foco}`}>
          {producto.nombre}
        </button>

        {conTamanos ? (
          <button type="button" onClick={onEditar}
            className={`text-left text-sm font-bold min-h-[44px] cursor-pointer touch-manipulation text-[var(--text-3)] ${foco}`}>
            {`Desde $${formatoMiles(precioMinimo(producto))}`}
          </button>
        ) : editandoPrecio ? (
          <div className="flex items-center gap-1">
            <span className="text-sm font-bold text-[var(--text-3)]">$</span>
            <input
              autoFocus
              inputMode="numeric"
              aria-label={`Precio de ${producto.nombre}`}
              value={valor}
              onChange={(e) => {
                const n = parsePrecio(e.target.value);
                setValor(n === null ? '' : formatoMiles(n));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); guardarPrecio(); }
                if (e.key === 'Escape') { e.preventDefault(); setEditandoPrecio(false); }
              }}
              className={`min-w-0 flex-1 min-h-[44px] px-2 rounded-lg text-sm font-bold
                          border border-[var(--border-1)] text-[var(--text-1)] ${foco}`}
              style={{ background: 'var(--bg-surf6)' }}
            />
            <button type="button" onClick={guardarPrecio} aria-label="Guardar precio"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg cursor-pointer touch-manipulation ${foco}`}
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              <IconoCheck />
            </button>
          </div>
        ) : (
          <button type="button" onClick={empezarPrecio} aria-label={`Cambiar precio de ${producto.nombre}`}
            className={`text-left text-sm font-bold min-h-[44px] cursor-pointer touch-manipulation text-[var(--text-3)]
                        hover:text-[var(--accent)] ${foco}`}>
            {`$${formatoMiles(Number(producto.precio) || 0)}`}
          </button>
        )}

        <button type="button" role="switch" aria-checked={visible} onClick={onToggleVisible}
          className={`flex items-center justify-between gap-2 min-h-[44px] cursor-pointer touch-manipulation text-sm ${foco}`}
          style={{ color: visible ? 'var(--text-1)' : 'var(--text-3)' }}>
          <span>{visible ? 'Visible en venta' : 'Oculto en venta'}</span>
          <span aria-hidden="true" className="relative inline-block w-10 h-6 rounded-full transition-colors shrink-0"
            style={{ background: visible ? 'var(--accent)' : 'var(--border-3)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
              style={{ left: visible ? '18px' : '2px' }} />
          </span>
        </button>
      </div>
    </article>
  );
}
