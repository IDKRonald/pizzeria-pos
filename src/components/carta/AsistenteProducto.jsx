import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { crearProducto } from '../../lib/api';
import { formatoMiles, parsePrecio, tamanosSugeridos } from '../../lib/carta';
import ProductCard from '../ProductCard';
import ZonaFoto from './ZonaFoto';

const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';
const campoCls = `w-full min-h-[44px] px-3 rounded-xl text-base border border-[var(--border-1)] text-[var(--text-1)] ${foco}`;
const noop = () => {};

function CampoPrecio({ valor, onChange, etiqueta }) {
  const n = parsePrecio(valor);
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" aria-hidden="true">$</span>
      <input type="text" inputMode="numeric" aria-label={etiqueta}
        value={n == null ? '' : formatoMiles(n)} onChange={(e) => onChange(e.target.value)}
        className={`${campoCls} pl-7`} style={{ background: 'var(--bg-surf6)' }} />
    </div>
  );
}

export default function AsistenteProducto({ categorias, productos, categoriaInicial, onCreado, onCerrar, onError }) {
  const { usuario } = useAuth();
  const [paso, setPaso] = useState(1);
  const [imagen, setImagen] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState(categoriaInicial ?? null);
  const [modo, setModo] = useState('unico'); // 'unico' | 'tamanos'
  const [precio, setPrecio] = useState('');
  const [precios, setPrecios] = useState({});
  const [guardando, setGuardando] = useState(false);

  const dialogoRef = useRef(null);
  // Ref para que un onCerrar inline no reinicie el efecto de foco en cada render.
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; });

  useEffect(() => {
    const previo = document.activeElement;
    dialogoRef.current?.querySelector('input[type="text"]')?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrarRef.current(); return; }
      if (e.key !== 'Tab' || !dialogoRef.current) return;
      const f = [...dialogoRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')];
      if (!f.length) return;
      const primero = f[0];
      const ultimo = f[f.length - 1];
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
  }, []);

  const tamanos = useMemo(() => (categoriaId == null ? [] : tamanosSugeridos(productos, categoriaId)), [productos, categoriaId]);
  const porTamanos = modo === 'tamanos' && tamanos.length > 0;

  const elegirCategoria = (id) => {
    setCategoriaId(id);
    setModo('unico');
    setPrecios({});
  };

  const precioUnico = parsePrecio(precio);
  const preciosOk = porTamanos
    ? tamanos.every((t) => (parsePrecio(precios[t]) ?? 0) > 0)
    : (precioUnico ?? 0) > 0;
  const nombreLimpio = nombre.trim();
  const completo = paso === 1 ? nombreLimpio !== '' : paso === 2 ? categoriaId != null : preciosOk;

  const variantes = porTamanos ? tamanos.map((t) => ({ nombre_tamanio: t, precio: parsePrecio(precios[t]) ?? 0 })) : [];
  const vista = {
    id: 0,
    nombre: nombreLimpio || 'Nuevo producto',
    imagen: imagen || '🍽️',
    categoria_id: categoriaId,
    tiene_variantes: porTamanos ? 1 : 0,
    precio: porTamanos ? 0 : (precioUnico ?? 0),
    variantes,
  };

  const agregar = async () => {
    if (guardando || !completo) return;
    setGuardando(true);
    try {
      await crearProducto({
        nombre: nombreLimpio,
        categoria_id: categoriaId,
        imagen: imagen || '🍽️',
        tiene_variantes: porTamanos ? 1 : 0,
        precio: porTamanos ? 0 : precioUnico,
        variantes,
      }, usuario.id);
      onCreado({ nombre: nombreLimpio, categoria_id: categoriaId });
    } catch (e) {
      onError(e?.message || 'No se pudo crear el producto');
      setGuardando(false);
    }
  };

  const btnSec = `min-h-[44px] px-5 rounded-xl text-sm font-semibold cursor-pointer touch-manipulation border border-[var(--border-1)] text-[var(--text-1)] ${foco}`;
  const btnPri = `min-h-[44px] px-5 rounded-xl text-sm font-bold cursor-pointer touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${foco}`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div ref={dialogoRef} role="dialog" aria-modal="true" aria-label="Nuevo producto"
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl p-5 flex flex-col gap-4 border border-[var(--border-1)]"
        style={{ background: 'var(--bg-surf2)', color: 'var(--text-1)' }}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">Nuevo producto</h2>
            <span className="text-sm text-[var(--text-3)]">{`Paso ${paso} de 3`}</span>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-1.5 flex-1 rounded-full"
                style={{ background: n <= paso ? 'var(--accent)' : 'var(--border-2)' }} />
            ))}
          </div>
        </div>

        {paso === 1 && (
          <div className="flex flex-col gap-4">
            <ZonaFoto imagen={imagen} nombre={nombreLimpio} variante="editor" onSubida={setImagen} onError={onError} />
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Nombre del producto
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
                className={campoCls} style={{ background: 'var(--bg-surf6)' }} />
            </label>
          </div>
        )}

        {paso === 2 && (
          <div role="radiogroup" aria-label="Categoría" className="grid grid-cols-2 gap-3">
            {categorias.map((c) => {
              const sel = categoriaId === c.id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={sel} onClick={() => elegirCategoria(c.id)}
                  className={`min-h-[64px] px-3 rounded-xl text-sm font-bold cursor-pointer touch-manipulation ${foco}`}
                  style={{
                    background: sel ? 'var(--accent)' : 'var(--bg-surf6)',
                    color: sel ? 'var(--on-accent)' : 'var(--text-1)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-1)'}`,
                  }}>
                  {c.nombre}
                </button>
              );
            })}
          </div>
        )}

        {paso === 3 && (
          <div className="flex flex-col gap-4">
            {tamanos.length > 0 && (
              <div role="radiogroup" aria-label="Tipo de precio" className="flex gap-2">
                {[['unico', 'Un solo precio'], ['tamanos', 'Por tamaños']].map(([id, etiqueta]) => (
                  <button key={id} type="button" role="radio" aria-checked={modo === id} onClick={() => setModo(id)}
                    className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold cursor-pointer touch-manipulation ${foco}`}
                    style={{
                      background: modo === id ? 'var(--accent)' : 'var(--bg-surf6)',
                      color: modo === id ? 'var(--on-accent)' : 'var(--text-1)',
                      border: `1px solid ${modo === id ? 'var(--accent)' : 'var(--border-1)'}`,
                    }}>
                    {etiqueta}
                  </button>
                ))}
              </div>
            )}
            {porTamanos ? (
              <div className="flex flex-col gap-2">
                {tamanos.map((t) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-28 text-sm font-semibold">{t}</span>
                    <div className="flex-1">
                      <CampoPrecio etiqueta={`Precio ${t}`} valor={precios[t]}
                        onChange={(v) => setPrecios((p) => ({ ...p, [t]: v }))} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CampoPrecio etiqueta="Precio" valor={precio} onChange={setPrecio} />
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[var(--text-2)]">Así se verá en la venta</p>
              <div className="w-48 pointer-events-none" inert>
                <ProductCard producto={vista} onAgregar={noop} onAbrirVariantes={noop} onAbrirCombo={noop} />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={() => (paso === 1 ? onCerrar() : setPaso(paso - 1))} className={btnSec}>
            {paso === 1 ? 'Cancelar' : 'Atrás'}
          </button>
          {paso < 3 ? (
            <button type="button" disabled={!completo} onClick={() => setPaso(paso + 1)} className={btnPri}
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              Siguiente
            </button>
          ) : (
            <button type="button" disabled={!completo || guardando} onClick={agregar} className={btnPri}
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              {guardando ? 'Agregando…' : 'Agregar a la carta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
