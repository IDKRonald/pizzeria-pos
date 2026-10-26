import { useEffect, useMemo, useRef, useState } from 'react';
import { actualizarCategoria, crearCategoria } from '../../lib/api';
import { intercambiarOrden, normalizarOrden } from '../../lib/carta';

const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';
const btnIcono = `min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer touch-manipulation
  border border-[var(--border-1)] text-[var(--text-2)] disabled:opacity-40 disabled:cursor-not-allowed ${foco}`;

const Svg = ({ children, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

function FilaCategoria({ cat, indice, total, conteo, onGuardarNombre, onMover, onEliminar, nueva, onCrear, moviendo }) {
  const [nombre, setNombre] = useState(cat.nombre);
  const [prev, setPrev] = useState(cat.nombre);
  if (prev !== cat.nombre) { setPrev(cat.nombre); setNombre(cat.nombre); }
  const ref = useRef(null);
  useEffect(() => { if (nueva) ref.current?.focus(); }, [nueva]);

  const alSalir = () => {
    const limpio = nombre.trim();
    if (nueva) { onCrear(limpio); return; }
    if (limpio === '' || limpio === cat.nombre) { setNombre(cat.nombre); return; }
    onGuardarNombre(cat, limpio, () => setNombre(cat.nombre));
  };

  return (
    <li className="flex items-center gap-2 rounded-xl px-2 py-2 border border-[var(--border-1)]" style={{ background: 'var(--bg-surf2)' }}>
      <span className="text-[var(--text-4)] shrink-0 w-5 flex justify-center" aria-hidden="true">
        <Svg><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></Svg>
      </span>
      <label className="flex-1 min-w-0">
        <span className="sr-only">Nombre de la categoría {indice + 1}</span>
        <input ref={ref} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={alSalir}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder={nueva ? 'Nombre de la categoría' : undefined}
          className={`w-full min-h-[44px] px-3 rounded-xl text-sm font-semibold border border-[var(--border-1)] text-[var(--text-1)] ${foco}`}
          style={{ background: 'var(--bg-surf6)' }} />
      </label>
      {!nueva && (
        <>
          <span className="text-sm text-[var(--text-3)] whitespace-nowrap">{conteo} {conteo === 1 ? 'producto' : 'productos'}</span>
          <button type="button" className={btnIcono} aria-label={`Subir ${cat.nombre}`} disabled={moviendo || indice === 0} onClick={() => onMover(indice, -1)}>
            <Svg><path d="M12 19V5M5 12l7-7 7 7" /></Svg>
          </button>
          <button type="button" className={btnIcono} aria-label={`Bajar ${cat.nombre}`} disabled={moviendo || indice === total - 1} onClick={() => onMover(indice, 1)}>
            <Svg><path d="M12 5v14M5 12l7 7 7-7" /></Svg>
          </button>
          <button type="button" onClick={() => onEliminar(cat)}
            className={`min-h-[44px] px-3 rounded-xl text-sm font-semibold cursor-pointer touch-manipulation text-[var(--text-2)] border border-[var(--border-1)] ${foco}`}>
            Eliminar
          </button>
        </>
      )}
    </li>
  );
}

export default function ListaCategorias({ categorias, conteo, ocultas, onEliminar, onRecargar, onAviso, usuarioId }) {
  const [moviendo, setMoviendo] = useState(false);
  const [nueva, setNueva] = useState(false);
  const trabajando = useRef(false);

  const ordenadas = useMemo(
    () => [...categorias].filter((c) => !ocultas.includes(c.id)).sort((a, b) => a.orden - b.orden || a.id - b.id),
    [categorias, ocultas],
  );

  const guardarNombre = async (cat, nombre, revertir) => {
    try {
      await actualizarCategoria(cat.id, { nombre }, usuarioId);
      await onRecargar();
    } catch (e) {
      revertir();
      onAviso(e?.message || 'No se pudo guardar');
    }
  };

  const mover = async (indice, dir) => {
    if (trabajando.current) return;
    trabajando.current = true;
    setMoviendo(true);
    try {
      const cambios = normalizarOrden(ordenadas);
      const mapa = new Map(cambios.map((c) => [c.id, c.orden]));
      const base = ordenadas.map((c) => (mapa.has(c.id) ? { ...c, orden: mapa.get(c.id) } : c));
      for (const c of cambios) await actualizarCategoria(c.id, { orden: c.orden }, usuarioId);
      const swap = intercambiarOrden(base, indice, dir);
      if (swap) for (const c of swap) await actualizarCategoria(c.id, { orden: c.orden }, usuarioId);
    } catch (e) {
      onAviso(e?.message || 'No se pudo guardar');
    } finally {
      trabajando.current = false;
      setMoviendo(false);
      await onRecargar();
    }
  };

  const crear = async (nombre) => {
    setNueva(false);
    if (!nombre) return;
    try {
      const max = categorias.reduce((m, c) => Math.max(m, c.orden || 0), 0);
      await crearCategoria({ nombre, orden: max + 1 }, usuarioId);
      await onRecargar();
    } catch (e) {
      onAviso(e?.message || 'No se pudo crear la categoría');
    }
  };

  return (
    <section className="max-w-2xl w-full mx-auto flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-extrabold leading-none">Categorías</h2>
          <p className="text-sm mt-1 text-[var(--text-3)]">Este orden es el mismo que verá el cajero en la venta.</p>
        </div>
        <button type="button" onClick={() => setNueva(true)} disabled={nueva}
          className={`flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-bold cursor-pointer touch-manipulation disabled:opacity-60 ${foco}`}
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
          <Svg><path d="M12 5v14M5 12h14" /></Svg> Nueva categoría
        </button>
      </div>
      <ol className="flex flex-col gap-2 list-decimal pl-7 marker:text-[var(--text-3)] marker:font-semibold">
        {ordenadas.map((c, i) => (
          <FilaCategoria key={c.id} cat={c} indice={i} total={ordenadas.length} conteo={conteo[c.id] || 0}
            onGuardarNombre={guardarNombre} onMover={mover} onEliminar={onEliminar} moviendo={moviendo} />
        ))}
        {nueva && (
          <FilaCategoria key="nueva" nueva cat={{ id: 'nueva', nombre: '' }} indice={0} total={1} conteo={0} onCrear={crear} />
        )}
      </ol>
    </section>
  );
}
