import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { actualizarProducto, actualizarVariante } from '../../lib/api';
import { formatoMiles, parsePrecio } from '../../lib/carta';
import ZonaFoto from './ZonaFoto';

const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';
const campoCls = `w-full min-h-[44px] px-3 rounded-xl text-sm border border-[var(--border-1)] text-[var(--text-1)] ${foco}`;

const IconoCerrar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

function CampoPrecio({ etiqueta, precio, onGuardar }) {
  const [valor, setValor] = useState(formatoMiles(Number(precio) || 0));
  const [previo, setPrevio] = useState(precio);
  if (previo !== precio) { setPrevio(precio); setValor(formatoMiles(Number(precio) || 0)); }
  return (
    <label className="flex items-center gap-3">
      <span className="flex-1 text-sm text-[var(--text-2)]">{etiqueta}</span>
      <span className="relative w-40">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-3)]">$</span>
        <input inputMode="numeric" value={valor} aria-label={`Precio ${etiqueta}`}
          onChange={(e) => { const n = parsePrecio(e.target.value); setValor(n === null ? '' : formatoMiles(n)); }}
          onBlur={() => {
            const n = parsePrecio(valor);
            if (n === null || n === Number(precio)) { setValor(formatoMiles(Number(precio) || 0)); return; }
            onGuardar(n);
          }}
          className={`${campoCls} pl-7 text-right`} style={{ background: 'var(--bg-surf6)' }} />
      </span>
    </label>
  );
}

export default function EditorProducto({ producto, categorias, onCambio, onCerrar, onEliminar, onError }) {
  const { usuario } = useAuth();
  const [nombre, setNombre] = useState(producto.nombre);
  const [nombrePrevio, setNombrePrevio] = useState(producto.nombre);
  if (nombrePrevio !== producto.nombre) { setNombrePrevio(producto.nombre); setNombre(producto.nombre); }

  const variantes = producto.variantes || [];
  const visible = !!producto.activo;

  /** Guarda un cambio del producto; si falla, revierte y avisa. */
  const guardar = async (cambios) => {
    const previo = Object.fromEntries(Object.keys(cambios).map((k) => [k, producto[k]]));
    onCambio(producto.id, cambios);
    try {
      await actualizarProducto(producto.id, cambios, usuario.id);
    } catch (e) {
      onCambio(producto.id, previo);
      onError(e?.message);
    }
  };

  const guardarVariante = async (v, precio) => {
    const conPrecio = (p) => variantes.map((x) => (x.id === v.id ? { ...x, precio: p } : x));
    onCambio(producto.id, { variantes: conPrecio(precio) });
    try {
      await actualizarVariante(v.id, { precio }, usuario.id);
    } catch (e) {
      onCambio(producto.id, { variantes: conPrecio(v.precio) });
      onError(e?.message);
    }
  };

  const guardarNombre = () => {
    const limpio = nombre.trim();
    if (!limpio || limpio === producto.nombre) { setNombre(producto.nombre); return; }
    guardar({ nombre: limpio });
  };

  return (
    <aside aria-label="Editar producto"
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto lg:left-auto lg:w-[420px] lg:shadow-2xl
                 border-l border-[var(--border-1)]"
      style={{ background: 'var(--bg-surf1)', color: 'var(--text-1)' }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ background: 'var(--bg-surf1)', borderBottom: '1px solid var(--border-1)' }}>
        <h2 className="text-base font-extrabold">Editar producto</h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar"
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer text-[var(--text-2)] ${foco}`}>
          <IconoCerrar />
        </button>
      </div>

      <div className="flex flex-col gap-5 p-4">
        <ZonaFoto imagen={producto.imagen} nombre={producto.nombre} variante="editor"
          onSubida={(url) => guardar({ imagen: url })} onError={onError} />

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--text-3)]">Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardarNombre}
            className={campoCls} style={{ background: 'var(--bg-surf6)' }} />
        </label>

        <div className="flex flex-col gap-2">
          <span id="editor-cat" className="text-xs font-semibold text-[var(--text-3)]">Categoría</span>
          <div role="radiogroup" aria-labelledby="editor-cat" className="flex flex-wrap gap-2">
            {categorias.map((c) => {
              const activa = c.id === producto.categoria_id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={activa}
                  onClick={() => { if (!activa) guardar({ categoria_id: c.id }); }}
                  className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold cursor-pointer touch-manipulation ${foco}`}
                  style={{
                    background: activa ? 'var(--accent)' : 'transparent',
                    border: activa ? '1px solid var(--accent)' : '1px solid var(--border-2)',
                    color: activa ? 'var(--on-accent)' : 'var(--text-2)',
                  }}>
                  {c.nombre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--text-3)]">Precio</span>
          {variantes.length > 0 ? variantes.map((v) => (
            <CampoPrecio key={v.id} etiqueta={v.nombre_tamanio} precio={v.precio} onGuardar={(n) => guardarVariante(v, n)} />
          )) : (
            <CampoPrecio etiqueta="Precio" precio={producto.precio} onGuardar={(n) => guardar({ precio: n })} />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-2 border border-[var(--border-1)]"
          style={{ background: 'var(--bg-surf2)' }}>
          <div>
            <p id="editor-visible" className="text-sm font-semibold">Visible en venta</p>
            <p className="text-xs text-[var(--text-3)]">Apágalo cuando se agote, sin borrarlo</p>
          </div>
          <button type="button" role="switch" aria-checked={visible} aria-labelledby="editor-visible"
            onClick={() => guardar({ activo: visible ? 0 : 1 })}
            className={`relative shrink-0 min-h-[44px] min-w-[56px] flex items-center cursor-pointer ${foco}`}>
            <span className="block w-12 h-7 rounded-full transition-colors"
              style={{ background: visible ? 'var(--accent)' : 'var(--border-2)' }} />
            <span className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all"
              style={{ left: visible ? '26px' : '6px', background: visible ? 'var(--on-accent)' : 'var(--bg-surf1)' }} />
          </button>
        </div>

        <button type="button" onClick={onCerrar}
          className={`min-h-[48px] rounded-xl text-sm font-bold cursor-pointer touch-manipulation ${foco}`}
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
          Listo
        </button>

        <div className="pt-4 mt-2" style={{ borderTop: '1px solid var(--border-1)' }}>
          <button type="button" onClick={() => onEliminar(producto)}
            className={`w-full min-h-[44px] rounded-xl text-sm font-semibold cursor-pointer touch-manipulation
                        border border-[var(--border-2)] text-[var(--text-2)] ${foco}`}>
            Eliminar producto
          </button>
        </div>
      </div>
    </aside>
  );
}
