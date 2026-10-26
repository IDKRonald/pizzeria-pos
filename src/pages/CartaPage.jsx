import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { actualizarProducto, eliminarCategoria, eliminarProducto, getCategorias, getProductosAdmin } from '../lib/api';
import { contarPorCategoria, filtrarProductos, programarEliminacion, tieneFoto } from '../lib/carta';
import EditorProducto from '../components/carta/EditorProducto';
import AsistenteProducto from '../components/carta/AsistenteProducto';
import Aviso from '../components/carta/Aviso';
import ListaCategorias from '../components/carta/ListaCategorias';
import TarjetaProducto from '../components/carta/TarjetaProducto';

const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';

const IconoAtras = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
const IconoMas = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconoBuscar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />
  </svg>
);

function Chip({ activo, onClick, children, conteo }) {
  return (
    <button type="button" aria-pressed={activo} onClick={onClick}
      className={`flex items-center gap-2 px-4 min-h-[44px] rounded-full text-sm font-semibold whitespace-nowrap shrink-0
                  transition-colors touch-manipulation select-none cursor-pointer ${foco}`}
      style={{
        background: activo ? 'var(--accent)' : 'transparent',
        border: activo ? '1px solid var(--accent)' : '1px solid var(--border-2)',
        color: activo ? 'var(--on-accent)' : 'var(--text-3)',
      }}>
      <span>{children}</span>
      <span className="text-xs opacity-70">{conteo}</span>
    </button>
  );
}

export default function CartaPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('productos'); // 'productos' | 'categorias' (Task 6: ListaCategorias)
  const [categoriaId, setCategoriaId] = useState(null);
  const [texto, setTexto] = useState('');
  const [soloSinFoto, setSoloSinFoto] = useState(false);
  const [editandoId, setEditandoId] = useState(null); // Task 4: EditorProducto + eliminar
  const [asistenteAbierto, setAsistenteAbierto] = useState(false); // Task 5: AsistenteProducto
  const [aviso, setAviso] = useState(null);

  const avisar = useCallback((texto, accion) => setAviso({ texto, accion }), []);
  const avisarError = useCallback((msg) => avisar(msg || 'No se pudo guardar'), [avisar]);

  // Eliminaciones diferidas pendientes; al desmontar se cancelan sin enviar el DELETE.
  const pendientesRef = useRef(new Map());

  /** Vuelve a pedir productos y categorías al backend. */
  const recargar = useCallback(async () => {
    try {
      const [ps, cs] = await Promise.all([getProductosAdmin(), getCategorias()]);
      // No reaparecen productos con eliminación pendiente (claves numéricas; las categorías usan "c<id>").
      const pendientes = pendientesRef.current;
      setProductos(ps.filter((p) => !pendientes.has(p.id)));
      setCategorias(cs);
    } catch (e) {
      avisarError(e?.message || 'No se pudo cargar la carta');
    } finally {
      setCargando(false);
    }
  }, [avisarError]);

  useEffect(() => { recargar(); }, [recargar]);

  /** Aplica cambios a un producto solo en el estado local. */
  const actualizarLocal = useCallback((id, cambios) => {
    setProductos((ps) => ps.map((p) => (p.id === id ? { ...p, ...cambios } : p)));
  }, []);

  /** Cambio optimista: aplica, guarda y revierte si falla. */
  const guardarOptimista = useCallback(async (producto, cambios, textoOk) => {
    const previo = Object.fromEntries(Object.keys(cambios).map((k) => [k, producto[k]]));
    actualizarLocal(producto.id, cambios);
    try {
      await actualizarProducto(producto.id, cambios, usuario.id);
      if (textoOk) avisar(textoOk);
    } catch (e) {
      actualizarLocal(producto.id, previo);
      avisarError(e?.message);
    }
  }, [actualizarLocal, avisar, avisarError, usuario.id]);

  // Eliminaciones diferidas pendientes (montaje/desmontaje): ver pendientesRef arriba.
  useEffect(() => {
    const pendientes = pendientesRef.current;
    return () => {
      pendientes.forEach((e) => e.cancelarSinEjecutar());
      pendientes.clear();
    };
  }, []);

  /** Devuelve el producto a la lista (si no está ya), en su posición original. */
  const restaurar = useCallback((producto, indice) => {
    setProductos((ps) => {
      if (ps.some((p) => p.id === producto.id)) return ps;
      const i = Math.min(Math.max(indice ?? ps.length, 0), ps.length);
      return [...ps.slice(0, i), producto, ...ps.slice(i)];
    });
  }, []);

  const eliminar = useCallback((producto) => {
    const { id } = producto;
    const indice = productos.findIndex((p) => p.id === id);
    setEditandoId(null);
    setProductos((ps) => ps.filter((p) => p.id !== id));
    const elim = programarEliminacion({
      ejecutar: async () => {
        // Sigue pendiente mientras el DELETE está en vuelo, para que un recargar() no lo traiga de vuelta.
        await eliminarProducto(id, usuario.id);
        pendientesRef.current.delete(id);
      },
      onError: (e) => {
        pendientesRef.current.delete(id);
        restaurar(producto, indice);
        if (e?.status === 409) {
          avisar('Tiene ventas registradas, así que no se puede borrar. Puedes ocultarlo de la venta.', {
            etiqueta: 'Ocultar',
            onClick: () => { setAviso(null); guardarOptimista(producto, { activo: 0 }, `${producto.nombre} oculto en la venta`); },
          });
        } else {
          avisarError(e?.message || 'No se pudo eliminar');
        }
      },
    });
    pendientesRef.current.set(id, elim);
    avisar(`Producto eliminado · ${producto.nombre}`, {
      etiqueta: 'Deshacer',
      onClick: () => {
        elim.deshacer();
        pendientesRef.current.delete(id);
        restaurar(producto, indice);
        setAviso(null);
      },
    });
  }, [productos, avisar, avisarError, guardarOptimista, restaurar, usuario.id]);

  const [categoriasOcultas, setCategoriasOcultas] = useState([]);
  const eliminarCat = useCallback((cat) => {
    const n = contarPorCategoria(productos)[cat.id] || 0;
    if (n > 0) {
      avisar(`“${cat.nombre}” tiene ${n} ${n === 1 ? 'producto' : 'productos'}. Muévelos a otra categoría antes de eliminarla.`);
      return;
    }
    const key = `c${cat.id}`;
    setCategoriasOcultas((o) => [...o, cat.id]);
    const mostrar = () => setCategoriasOcultas((o) => o.filter((x) => x !== cat.id));
    const elim = programarEliminacion({
      ejecutar: async () => {
        pendientesRef.current.delete(key);
        await eliminarCategoria(cat.id, usuario.id);
        await recargar();
        mostrar();
      },
      onError: (e) => { mostrar(); avisarError(e?.message || 'No se pudo eliminar'); },
    });
    pendientesRef.current.set(key, elim);
    avisar(`Categoría eliminada · ${cat.nombre}`, {
      etiqueta: 'Deshacer',
      onClick: () => { elim.deshacer(); pendientesRef.current.delete(key); mostrar(); setAviso(null); },
    });
  }, [productos, avisar, avisarError, recargar, usuario.id]);

  const editando = useMemo(() => productos.find((p) => p.id === editandoId) || null, [productos, editandoId]);

  const categoriasOrdenadas = useMemo(
    () => [...categorias].filter((c) => !categoriasOcultas.includes(c.id)).sort((a, b) => a.orden - b.orden || a.id - b.id),
    [categorias, categoriasOcultas],
  );
  const conteos = useMemo(() => contarPorCategoria(productos), [productos]);
  const sinFoto = useMemo(() => productos.filter((p) => !tieneFoto(p.imagen)).length, [productos]);
  const visibles = useMemo(
    () => filtrarProductos(productos, { categoriaId, texto, soloSinFoto }),
    [productos, categoriaId, texto, soloSinFoto],
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-main)', color: 'var(--text-1)' }}>
      <header className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6 py-3"
        style={{ background: 'var(--bg-surf1)', borderBottom: '1px solid var(--border-1)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/hub')} aria-label="Volver al inicio"
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl cursor-pointer
                        border border-[var(--border-1)] text-[var(--text-2)] ${foco}`}
            style={{ background: 'var(--bg-surf2)' }}>
            <IconoAtras />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold leading-none">Carta</h1>
            <p className="text-xs mt-1 text-[var(--text-3)]">Lo que se vende, con su foto y su precio</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div role="tablist" aria-label="Vista" className="flex rounded-xl p-1 border border-[var(--border-1)]"
            style={{ background: 'var(--bg-surf2)' }}>
            {[['productos', 'Productos'], ['categorias', 'Categorías']].map(([id, etiqueta]) => (
              <button key={id} type="button" role="tab" aria-selected={vista === id} onClick={() => setVista(id)}
                className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold cursor-pointer touch-manipulation ${foco}`}
                style={{
                  background: vista === id ? 'var(--bg-surf7)' : 'transparent',
                  color: vista === id ? 'var(--text-1)' : 'var(--text-3)',
                }}>
                {etiqueta}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setAsistenteAbierto(true)}
            className={`flex items-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-bold cursor-pointer touch-manipulation ${foco}`}
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            <IconoMas /> Nuevo producto
          </button>
        </div>
      </header>

      {vista === 'categorias' ? (
        <main className="flex-1 p-4 sm:p-6">
          <ListaCategorias
            categorias={categorias}
            conteo={conteos}
            ocultas={categoriasOcultas}
            onEliminar={eliminarCat}
            onRecargar={recargar}
            onAviso={(t, a) => (t ? avisar(t, a) : setAviso(null))}
            usuarioId={usuario.id}
          />
        </main>
      ) : (
        <>
          <div className="flex flex-col gap-3 px-4 sm:px-6 py-3"
            style={{ background: 'var(--bg-surf5)', borderBottom: '1px solid var(--border-1)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-4)]"><IconoBuscar /></span>
                <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
                  placeholder="Buscar producto" aria-label="Buscar producto"
                  className={`w-full min-h-[44px] pl-10 pr-3 rounded-xl text-sm border border-[var(--border-1)] text-[var(--text-1)] ${foco}`}
                  style={{ background: 'var(--bg-surf6)' }} />
              </label>
              <Chip activo={soloSinFoto} onClick={() => setSoloSinFoto((v) => !v)} conteo={sinFoto}>Sin foto</Chip>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Chip activo={categoriaId === null} onClick={() => setCategoriaId(null)} conteo={productos.length}>Todas</Chip>
              {categoriasOrdenadas.map((c) => (
                <Chip key={c.id} activo={categoriaId === c.id} onClick={() => setCategoriaId(c.id)} conteo={conteos[c.id] || 0}>
                  {c.nombre}
                </Chip>
              ))}
            </div>
          </div>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            {sinFoto > 0 && !soloSinFoto && (
              <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl pl-4 pr-2 py-1 border border-[var(--border-1)]"
                style={{ background: 'var(--bg-surf2)' }}>
                <p className="text-sm py-2 text-[var(--text-2)]">
                  {`${sinFoto} ${sinFoto === 1 ? 'producto no tiene' : 'productos no tienen'} foto. Arrastra una foto encima de la tarjeta o tócala.`}
                </p>
                <button type="button" onClick={() => setSoloSinFoto(true)}
                  className={`min-h-[44px] px-3 text-sm font-semibold cursor-pointer text-[var(--accent)] ${foco}`}>
                  Ver cuáles
                </button>
              </div>
            )}

            {cargando ? (
              <p className="text-sm text-[var(--text-3)]">Cargando carta…</p>
            ) : visibles.length === 0 ? (
              <p className="text-sm text-center py-12 text-[var(--text-3)]">No hay productos con ese filtro.</p>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {visibles.map((p) => (
                  <TarjetaProducto
                    key={p.id}
                    producto={p}
                    seleccionado={editandoId === p.id}
                    onEditar={() => setEditandoId(p.id)}
                    onFotoSubida={(url) => guardarOptimista(p, { imagen: url }, 'Foto guardada')}
                    onGuardarPrecio={(precio) => guardarOptimista(p, { precio })}
                    onToggleVisible={() => guardarOptimista(p, { activo: p.activo ? 0 : 1 }, p.activo ? `${p.nombre} oculto en la venta` : null)}
                    onError={avisarError}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {editando && (
        <EditorProducto
          key={editando.id}
          producto={editando}
          categorias={categoriasOrdenadas}
          onCambio={actualizarLocal}
          onCerrar={() => setEditandoId(null)}
          onEliminar={eliminar}
          onError={avisarError}
        />
      )}
      {asistenteAbierto && (
        <AsistenteProducto
          categorias={categoriasOrdenadas}
          productos={productos}
          categoriaInicial={categoriaId}
          onCreado={async (p) => {
            setAsistenteAbierto(false);
            setCategoriaId(p.categoria_id);
            setTexto('');
            setSoloSinFoto(false);
            await recargar();
            avisar(`Agregado a la carta · ${p.nombre}`);
          }}
          onCerrar={() => setAsistenteAbierto(false)}
          onError={avisarError}
        />
      )}

      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
    </div>
  );
}
