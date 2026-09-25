// src/components/inventario/TabRecetas.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProductos, getInsumos, getRecetas, crearReceta, eliminarReceta } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };

export default function TabRecetas() {
  const { usuario } = useAuth();
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [productoId, setProductoId] = useState('');
  const [varianteId, setVarianteId] = useState('');
  const [insumoId, setInsumoId] = useState('');
  const [cantidad, setCantidad] = useState('');

  const cargarRecetas = useCallback(() => {
    getRecetas().then((d) => { setRecetas(d); setError(null); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setCargando(true);
    Promise.all([getProductos(), getInsumos(), getRecetas()])
      .then(([prods, ins, rec]) => { setProductos(prods); setInsumos(ins); setRecetas(rec); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const productoSeleccionado = useMemo(() => productos.find((p) => p.id === productoId), [productos, productoId]);

  const agregarReceta = async (e) => {
    e.preventDefault();
    if (!productoId || !insumoId || !cantidad) return;
    if (productoSeleccionado?.variantes?.length && !varianteId) {
      alert('Este producto tiene tamaños — elige a cuál aplica la receta');
      return;
    }
    try {
      await crearReceta({
        producto_id: parseInt(productoId.replace('prod_', ''), 10),
        variante_id: varianteId ? parseInt(varianteId.replace('var_', ''), 10) : null,
        insumo_id: Number(insumoId),
        cantidad: Number(cantidad),
      }, usuario.id);
      setInsumoId(''); setCantidad('');
      cargarRecetas();
    } catch (err) {
      alert(err.message);
    }
  };

  const quitar = async (r) => {
    if (!confirm('¿Eliminar esta receta?')) return;
    try {
      await eliminarReceta(r.id, usuario.id);
      cargarRecetas();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">Recetas — qué insumo consume cada producto</h2>
      <p className="text-xs" style={{ color: '#64748b' }}>
        Solo tiene efecto si el insumo está en modo <strong style={{ color: '#34d399' }}>automático</strong>. Si está en manual, la receta queda guardada pero no descuenta nada.
      </p>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {/* Formulario nueva receta */}
      <form onSubmit={agregarReceta} className="p-4 rounded-xl space-y-3" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Producto</label>
            <select value={productoId} onChange={(e) => { setProductoId(e.target.value); setVarianteId(''); }}
              className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              <option value="">Selecciona un producto</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.categoria}</option>)}
            </select>
          </div>
          {productoSeleccionado?.variantes?.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Tamaño</label>
              <select value={varianteId} onChange={(e) => setVarianteId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">Selecciona un tamaño</option>
                {productoSeleccionado.variantes.map((v) => <option key={v.idVariante} value={v.idVariante}>{v.nombreTamanio}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Insumo</label>
            <select value={insumoId} onChange={(e) => setInsumoId(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
              <option value="">Selecciona un insumo</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre} ({i.unidad}) — {i.modo_descuento === 'automatico' ? 'automático' : 'manual'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Cantidad por unidad vendida</label>
            <input type="number" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
              placeholder="Ej: 0.15" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
          </div>
        </div>
        <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>
          ＋ Agregar receta
        </button>
      </form>

      {/* Listado */}
      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : recetas.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>Aún no hay recetas configuradas.</p>
      ) : (
        <div className="space-y-2">
          {recetas.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <div>
                <p className="text-sm font-semibold text-white">
                  {r.producto_nombre}{r.nombre_tamanio ? ` · ${r.nombre_tamanio}` : ''}
                </p>
                <p className="text-xs" style={{ color: '#64748b' }}>
                  consume <strong style={{ color: '#e2e8f0' }}>{r.cantidad} {r.insumo_unidad}</strong> de {r.insumo_nombre}
                  {r.modo_descuento !== 'automatico' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>
                      inactiva — insumo en modo manual
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => quitar(r)} className="w-7 h-7 rounded-lg text-xs shrink-0" style={{ background: '#1e1e2d', color: '#f87171' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
