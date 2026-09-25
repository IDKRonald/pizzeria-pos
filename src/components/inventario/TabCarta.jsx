// src/components/inventario/TabCarta.jsx
// Editor de la carta: categorÃ­as, productos (simples o con tamaÃ±os) y sus variantes.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  getProductosAdmin, crearProducto, actualizarProducto, eliminarProducto,
  crearVariante, actualizarVariante, eliminarVariante, subirImagenProducto,
} from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };
const formatCOP = (v) => (v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

/** Detecta si la cadena es una URL de imagen (subida) o un emoji/texto */
const esUrl = (s) => typeof s === 'string' && (s.startsWith('/uploads/') || s.startsWith('http'));

/** Renderiza la imagen de un producto: URL â†’ <img>, emoji/texto â†’ <span> */
function ProductoImagen({ src, className = 'w-10 h-10 object-cover rounded-lg' }) {
  const backendHost = `http://${window.location.hostname}:3001`;
  if (esUrl(src)) {
    const fullSrc = src.startsWith('http') ? src : `${backendHost}${src}`;
    return <img src={fullSrc} alt="" className={className} style={{ objectFit: 'cover' }} />;
  }
  return <span className="text-2xl leading-none">{src || 'ðŸ½ï¸'}</span>;
}

/**
 * Selector de imagen con drag-and-drop, preview y botÃ³n de quitar.
 * Sube automÃ¡ticamente al seleccionar y llama a onUploaded(url).
 */
function ImagenPicker({ value, onUploaded }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [drag, setDrag] = useState(false);
  const backendHost = `http://${window.location.hostname}:3001`;

  const procesar = async (file) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const { url } = await subirImagenProducto(file);
      onUploaded(url);
    } catch (err) {
      alert(`Error al subir imagen: ${err.message}`);
    } finally {
      setSubiendo(false);
    }
  };

  const onFileChange = (e) => procesar(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    procesar(e.dataTransfer.files[0]);
  };

  const tieneImagen = esUrl(value);
  const fullSrc = tieneImagen ? (value.startsWith('http') ? value : `${backendHost}${value}`) : null;

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>
        Imagen del producto
      </label>

      {/* Preview / zona de drop */}
      <div
        onClick={() => !subiendo && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all"
        style={{
          height: 120,
          background: drag ? 'rgba(249,115,22,0.1)' : '#1e1e2d',
          border: `2px dashed ${drag ? 'rgb(249,115,22)' : '#2a2a3a'}`,
          overflow: 'hidden',
        }}
      >
        {subiendo ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs" style={{ color: '#94a3b8' }}>Subiendoâ€¦</span>
          </div>
        ) : tieneImagen ? (
          <>
            <img src={fullSrc} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <span className="text-xs font-bold text-white">ðŸ”„ Cambiar imagen</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            {/* Muestra emoji actual si lo hay */}
            {value && !tieneImagen && (
              <span className="text-3xl mb-1">{value}</span>
            )}
            <span className="text-2xl">ðŸ“·</span>
            <span className="text-xs" style={{ color: '#94a3b8' }}>
              Clic o arrastra una imagen
            </span>
            <span className="text-[10px]" style={{ color: '#475569' }}>JPG, PNG, WebP Â· mÃ¡x. 5 MB</span>
          </div>
        )}
      </div>

      {/* Botones secundarios */}
      <div className="flex gap-2">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: '#1e1e2d', color: '#e2e8f0', border: '1px solid #2a2a3a' }}>
          ðŸ“‚ Seleccionar archivo
        </button>
        {tieneImagen && (
          <button type="button" onClick={() => onUploaded('ðŸ½ï¸')}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: '#1e1e2d', color: '#f87171', border: '1px solid #2a2a3a' }}>
            âœ• Quitar
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  );
}

export default function TabCarta() {
  const { usuario } = useAuth();
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [editandoCat, setEditandoCat] = useState(null);
  const [formCat, setFormCat] = useState({ nombre: '', emoji: 'ðŸ“¦', orden: 0 });

  const [editandoProd, setEditandoProd] = useState(null); // {} nuevo, {id,...} editar
  const [formProd, setFormProd] = useState({});
  const [nuevaVariante, setNuevaVariante] = useState({ nombre_tamanio: '', precio: '' });

  const cargar = useCallback(() => {
    setCargando(true);
    Promise.all([getCategorias(), getProductosAdmin()])
      .then(([cats, prods]) => { setCategorias(cats); setProductos(prods); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const productosFiltrados = useMemo(() =>
    filtroCategoria ? productos.filter((p) => p.categoria_id === Number(filtroCategoria)) : productos,
  [productos, filtroCategoria]);

  // â”€â”€ CategorÃ­as â”€â”€
  const abrirNuevaCat = () => { setFormCat({ nombre: '', emoji: 'ðŸ“¦', orden: categorias.length }); setEditandoCat({}); };
  const abrirEditarCat = (c) => { setFormCat({ nombre: c.nombre, emoji: c.emoji, orden: c.orden }); setEditandoCat(c); };
  const guardarCat = async (e) => {
    e.preventDefault();
    try {
      if (editandoCat.id) await actualizarCategoria(editandoCat.id, formCat, usuario.id);
      else await crearCategoria(formCat, usuario.id);
      setEditandoCat(null);
      cargar();
    } catch (err) { alert(err.message); }
  };
  const quitarCat = async (c) => {
    if (!confirm(`Â¿Eliminar la categorÃ­a "${c.nombre}"?`)) return;
    try { await eliminarCategoria(c.id, usuario.id); cargar(); } catch (err) { alert(err.message); }
  };

  // â”€â”€ Productos â”€â”€
  const abrirNuevoProd = () => {
    setFormProd({ nombre: '', descripcion: '', categoria_id: categorias[0]?.id || '', imagen: 'ðŸ½ï¸', tiene_variantes: false, precio: '', variantes: [] });
    setEditandoProd({});
  };
  const abrirEditarProd = (p) => {
    setFormProd({ nombre: p.nombre, descripcion: p.descripcion || '', categoria_id: p.categoria_id, imagen: p.imagen, activo: p.activo });
    setEditandoProd(p);
  };

  const guardarProd = async (e) => {
    e.preventDefault();
    try {
      if (editandoProd.id) {
        await actualizarProducto(editandoProd.id, formProd, usuario.id);
      } else {
        if (formProd.tiene_variantes && (!formProd.variantes || formProd.variantes.length === 0)) {
          alert('Agrega al menos un tamaÃ±o antes de guardar');
          return;
        }
        await crearProducto(formProd, usuario.id);
      }
      setEditandoProd(null);
      cargar();
    } catch (err) { alert(err.message); }
  };

  const quitarProd = async (p) => {
    if (!confirm(`Â¿Eliminar "${p.nombre}"? Si tiene ventas registradas, se sugerirÃ¡ desactivarlo en su lugar.`)) return;
    try {
      await eliminarProducto(p.id, usuario.id);
      cargar();
    } catch (err) {
      if (err.status === 409 && confirm(`${err.message}\n\nÂ¿Desactivarlo ahora?`)) {
        try { await actualizarProducto(p.id, { activo: 0 }, usuario.id); cargar(); } catch (e2) { alert(e2.message); }
      } else {
        alert(err.message);
      }
    }
  };

  const toggleActivo = async (p) => {
    try { await actualizarProducto(p.id, { activo: p.activo ? 0 : 1 }, usuario.id); cargar(); } catch (err) { alert(err.message); }
  };

  // â”€â”€ Variantes (dentro del formulario nuevo, en memoria; en ediciÃ³n, contra el backend) â”€â”€
  const agregarVarianteNueva = () => {
    if (!nuevaVariante.nombre_tamanio || !nuevaVariante.precio) return;
    setFormProd((f) => ({ ...f, variantes: [...(f.variantes || []), { ...nuevaVariante, precio: Number(nuevaVariante.precio) }] }));
    setNuevaVariante({ nombre_tamanio: '', precio: '' });
  };
  const quitarVarianteNueva = (idx) => {
    setFormProd((f) => ({ ...f, variantes: f.variantes.filter((_, i) => i !== idx) }));
  };

  const agregarVarianteExistente = async () => {
    if (!nuevaVariante.nombre_tamanio || !nuevaVariante.precio) return;
    try {
      await crearVariante(editandoProd.id, { nombre_tamanio: nuevaVariante.nombre_tamanio, precio: Number(nuevaVariante.precio) }, usuario.id);
      setNuevaVariante({ nombre_tamanio: '', precio: '' });
      const prods = await getProductosAdmin();
      setProductos(prods);
      setEditandoProd(prods.find((p) => p.id === editandoProd.id));
    } catch (err) { alert(err.message); }
  };
  const editarPrecioVariante = async (v, precio) => {
    try {
      await actualizarVariante(v.id, { precio: Number(precio) }, usuario.id);
      const prods = await getProductosAdmin();
      setProductos(prods);
      setEditandoProd(prods.find((p) => p.id === editandoProd.id));
    } catch (err) { alert(err.message); }
  };
  const quitarVarianteExistente = async (v) => {
    if (!confirm(`Â¿Eliminar el tamaÃ±o "${v.nombre_tamanio}"?`)) return;
    try {
      await eliminarVariante(v.id, usuario.id);
      const prods = await getProductosAdmin();
      setProductos(prods);
      setEditandoProd(prods.find((p) => p.id === editandoProd.id));
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      {/* CategorÃ­as */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">CategorÃ­as</h2>
          <button onClick={abrirNuevaCat} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: 'rgb(249,115,22)' }}>ï¼‹ Nueva categorÃ­a</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: '#13131b', border: '1px solid #2a2a3a', color: '#e2e8f0' }}>
              <span>{c.emoji} {c.nombre}</span>
              <button onClick={() => abrirEditarCat(c)} style={{ color: '#94a3b8' }}>âœŽ</button>
              <button onClick={() => quitarCat(c)} style={{ color: '#f87171' }}>âœ•</button>
            </div>
          ))}
        </div>
      </div>

      {/* Productos */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-lg font-bold text-white">Productos</h2>
          <div className="flex items-center gap-2">
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              <option value="">Todas las categorÃ­as</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button onClick={abrirNuevoProd} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'rgb(249,115,22)' }}>ï¼‹ Nuevo producto</button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">âš ï¸ {error}</p>}

        {cargando ? (
          <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {productosFiltrados.map((p) => (
              <div key={p.id} className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a', opacity: p.activo ? 1 : 0.5 }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ProductoImagen src={p.imagen} className="w-10 h-10 object-cover rounded-lg" />
                    <div>
                      <p className="text-sm font-bold text-white">{p.nombre}</p>
                      <p className="text-xs" style={{ color: '#64748b' }}>{p.categoria_nombre}</p>
                    </div>
                  </div>
                  {!p.activo && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>Inactivo</span>}
                </div>
                <p className="text-sm font-extrabold mt-2 text-orange-400">
                  {p.tiene_variantes ? `Desde ${formatCOP(p.precio_desde)}` : formatCOP(p.precio)}
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => abrirEditarProd(p)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#1e1e2d', color: '#e2e8f0' }}>Editar</button>
                  <button onClick={() => toggleActivo(p)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#fbbf24' }}>{p.activo ? 'â¸' : 'â–¶'}</button>
                  <button onClick={() => quitarProd(p)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#f87171' }}>âœ•</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal categorÃ­a */}
      {editandoCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditandoCat(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardarCat} className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">{editandoCat.id ? 'Editar categorÃ­a' : 'Nueva categorÃ­a'}</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Nombre</label>
                <input required value={formCat.nombre} onChange={(e) => setFormCat((f) => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Emoji</label>
                <input value={formCat.emoji} onChange={(e) => setFormCat((f) => ({ ...f, emoji: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm text-center" style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Guardar</button>
              <button type="button" onClick={() => setEditandoCat(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1e1e2d', color: '#94a3b8' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal producto */}
      {editandoProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditandoProd(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardarProd}
            className="w-full max-w-md rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">{editandoProd.id ? `Editar: ${editandoProd.nombre}` : 'Nuevo producto'}</h3>

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Nombre</label>
              <input required value={formProd.nombre} onChange={(e) => setFormProd((f) => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>

            {/* â”€â”€ Selector de imagen â”€â”€ */}
            <ImagenPicker
              value={formProd.imagen}
              onUploaded={(url) => setFormProd((f) => ({ ...f, imagen: url }))}
            />

            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>DescripciÃ³n (opcional)</label>
              <input value={formProd.descripcion} onChange={(e) => setFormProd((f) => ({ ...f, descripcion: e.target.value }))} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>CategorÃ­a</label>
              <select value={formProd.categoria_id} onChange={(e) => setFormProd((f) => ({ ...f, categoria_id: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>

            {!editandoProd.id && (
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#1e1e2d' }}>
                <input type="checkbox" checked={formProd.tiene_variantes} onChange={(e) => setFormProd((f) => ({ ...f, tiene_variantes: e.target.checked }))} />
                <span className="text-xs" style={{ color: '#e2e8f0' }}>Tiene tamaÃ±os/variantes (ej. pizza con Personal/Mediana/Familiar)</span>
              </div>
            )}

            {!editandoProd.id && !formProd.tiene_variantes && (
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Precio</label>
                <input required type="number" value={formProd.precio} onChange={(e) => setFormProd((f) => ({ ...f, precio: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
            )}

            {editandoProd.id && (
              <div>
                <label className="flex items-center gap-2 text-xs" style={{ color: '#94a3b8' }}>
                  <input type="checkbox" checked={!!formProd.activo} onChange={(e) => setFormProd((f) => ({ ...f, activo: e.target.checked }))} />
                  Activo (visible en el punto de venta)
                </label>
              </div>
            )}

            {editandoProd.id && !editandoProd.tiene_variantes && (
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Precio</label>
                <input type="number" defaultValue={editandoProd.precio}
                  onBlur={async (e) => { try { await actualizarProducto(editandoProd.id, { precio: Number(e.target.value) }, usuario.id); } catch (err) { alert(err.message); } }}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                <p className="text-[10px] mt-1" style={{ color: '#64748b' }}>Se guarda al salir del campo.</p>
              </div>
            )}

            {/* TamaÃ±os/variantes */}
            {(formProd.tiene_variantes || editandoProd.tiene_variantes) && (
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>TamaÃ±os</label>
                <div className="space-y-1.5">
                  {(editandoProd.id ? editandoProd.variantes : formProd.variantes || []).map((v, idx) => (
                    <div key={v.id || idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm" style={{ color: '#e2e8f0' }}>{v.nombre_tamanio}</span>
                      {editandoProd.id ? (
                        <input type="number" defaultValue={v.precio} onBlur={(e) => editarPrecioVariante(v, e.target.value)}
                          className="w-24 px-2 py-1 rounded text-xs" style={inputStyle} />
                      ) : (
                        <span className="text-xs" style={{ color: '#94a3b8' }}>{formatCOP(v.precio)}</span>
                      )}
                      <button type="button" onClick={() => editandoProd.id ? quitarVarianteExistente(v) : quitarVarianteNueva(idx)}
                        className="w-6 h-6 rounded text-xs" style={{ background: '#1e1e2d', color: '#f87171' }}>âœ•</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input placeholder="Nombre (ej. Familiar)" value={nuevaVariante.nombre_tamanio} onChange={(e) => setNuevaVariante((v) => ({ ...v, nombre_tamanio: e.target.value }))}
                    className="flex-1 px-2 py-1.5 rounded text-xs" style={inputStyle} />
                  <input type="number" placeholder="Precio" value={nuevaVariante.precio} onChange={(e) => setNuevaVariante((v) => ({ ...v, precio: e.target.value }))}
                    className="w-24 px-2 py-1.5 rounded text-xs" style={inputStyle} />
                  <button type="button" onClick={editandoProd.id ? agregarVarianteExistente : agregarVarianteNueva}
                    className="px-2.5 py-1.5 rounded text-xs font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>ï¼‹</button>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Guardar</button>
              <button type="button" onClick={() => setEditandoProd(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1e1e2d', color: '#94a3b8' }}>Cerrar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

