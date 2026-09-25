// src/components/inventario/TabCombos.jsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProductos, getCategorias, getCombos, crearCombo, actualizarCombo, eliminarCombo } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };

export default function TabCombos() {
  const { usuario } = useAuth();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [combos, setCombos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // { producto_id, producto_nombre, id? }
  const [form, setForm] = useState({ categoria_opciones_id: '', nombre_slot: 'Bebida' });

  const cargarCombos = useCallback(() => {
    getCombos().then((d) => { setCombos(d); setError(null); }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setCargando(true);
    Promise.all([getProductos(), getCategorias(), getCombos()])
      .then(([prods, cats, cmb]) => { setProductos(prods); setCategorias(cats); setCombos(cmb); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const comboPorProducto = useMemo(() => {
    const map = {};
    for (const c of combos) map[c.producto_id] = c;
    return map;
  }, [combos]);

  // Solo productos simples (sin tamaños) tienen sentido como combos con precio fijo
  const productosSimples = useMemo(() => productos.filter((p) => !p.variantes || p.variantes.length === 0), [productos]);

  const abrirConfigurar = (p) => {
    const idNumerico = parseInt(p.id.replace('prod_', ''), 10);
    const existente = comboPorProducto[idNumerico];
    setForm(existente
      ? { categoria_opciones_id: existente.categoria_opciones_id, nombre_slot: existente.nombre_slot }
      : { categoria_opciones_id: '', nombre_slot: 'Bebida' });
    setEditando({ producto_id: idNumerico, producto_nombre: p.nombre, id: existente?.id || null });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.categoria_opciones_id) return;
    try {
      if (editando.id) await actualizarCombo(editando.id, form, usuario.id);
      else await crearCombo({ producto_id: editando.producto_id, ...form }, usuario.id);
      setEditando(null);
      cargarCombos();
    } catch (err) {
      alert(err.message);
    }
  };

  const quitar = async (combo) => {
    if (!confirm(`¿Quitar la configuración de combo de "${combo.producto_nombre}"?`)) return;
    try {
      await eliminarCombo(combo.id, usuario.id);
      cargarCombos();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white">Combos</h2>
      <p className="text-xs" style={{ color: '#64748b' }}>
        Marca qué productos de la carta son combos (ej. "Hamburguesa en Combo") y de qué categoría se elige la bebida incluida.
        Esto no crea productos nuevos — solo configura los que ya existen en la carta.
      </p>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {productosSimples.map((p) => {
            const idNumerico = parseInt(p.id.replace('prod_', ''), 10);
            const combo = comboPorProducto[idNumerico];
            return (
              <div key={p.id} className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-white">{p.nombre}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{p.categoria}</p>
                  </div>
                  {combo && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                      Combo
                    </span>
                  )}
                </div>
                {combo && (
                  <p className="text-xs mt-2" style={{ color: '#94a3b8' }}>
                    "{combo.nombre_slot}" → {combo.categoria_nombre}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => abrirConfigurar(p)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#1e1e2d', color: '#e2e8f0' }}>
                    {combo ? 'Editar' : 'Configurar combo'}
                  </button>
                  {combo && (
                    <button onClick={() => quitar(combo)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#f87171' }}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditando(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardar}
            className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">Combo: {editando.producto_nombre}</h3>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Nombre del paso de selección</label>
              <input value={form.nombre_slot} onChange={(e) => setForm((f) => ({ ...f, nombre_slot: e.target.value }))}
                placeholder="Elige tu gaseosa" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Categoría de opciones</label>
              <select required value={form.categoria_opciones_id} onChange={(e) => setForm((f) => ({ ...f, categoria_opciones_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">Selecciona una categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Guardar</button>
              <button type="button" onClick={() => setEditando(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1e1e2d', color: '#94a3b8' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
