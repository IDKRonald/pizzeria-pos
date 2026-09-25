// src/components/inventario/TabInsumos.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getInsumos, crearInsumo, actualizarInsumo, eliminarInsumo, ajustarStockInsumo, getProveedores } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };
const UNIDADES_SUGERIDAS = ['unidad', 'kg', 'gramo', 'litro', 'ml', 'caja', 'bandeja', 'paquete', 'porción'];

function estadoStock(i) {
  if (i.stock_actual < 0) return { texto: 'Desincronizado', color: '#c084fc', bg: 'rgba(168,85,247,0.15)' };
  if (i.stock_actual <= i.stock_min) return { texto: 'Stock bajo', color: '#f87171', bg: 'rgba(239,68,68,0.15)' };
  return null;
}

export default function TabInsumos() {
  const { usuario } = useAuth();
  const [insumos, setInsumos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtroProveedor, setFiltroProveedor] = useState('');
  const [filtroModo, setFiltroModo] = useState('');
  const [soloBajoStock, setSoloBajoStock] = useState(false);

  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [ajustando, setAjustando] = useState(null);
  const [ajusteForm, setAjusteForm] = useState({ delta: '', motivo: '' });

  const cargar = useCallback(() => {
    setCargando(true);
    const filtros = {};
    if (filtroProveedor) filtros.proveedor_id = filtroProveedor;
    if (filtroModo) filtros.modo_descuento = filtroModo;
    if (soloBajoStock) filtros.bajo_stock = '1';
    getInsumos(filtros).then((d) => { setInsumos(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, [filtroProveedor, filtroModo, soloBajoStock]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { getProveedores().then(setProveedores).catch(() => {}); }, []);

  const abrirNuevo = () => {
    setForm({ nombre: '', unidad: 'unidad', stock_actual: 0, stock_min: 0, stock_max: 0, precio_compra: 0, modo_descuento: 'manual', proveedor_id: '' });
    setEditando({});
  };
  const abrirEditar = (i) => {
    setForm({ nombre: i.nombre, unidad: i.unidad, stock_min: i.stock_min, stock_max: i.stock_max, precio_compra: i.precio_compra, modo_descuento: i.modo_descuento, proveedor_id: i.proveedor_id || '', activo: i.activo });
    setEditando(i);
  };

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, proveedor_id: form.proveedor_id || null };
      if (editando.id) await actualizarInsumo(editando.id, payload, usuario.id);
      else await crearInsumo(payload, usuario.id);
      setEditando(null);
      cargar();
    } catch (err) {
      alert(err.message);
    }
  };

  const eliminar = async (i) => {
    if (!confirm(`¿Eliminar el insumo "${i.nombre}"?`)) return;
    try {
      await eliminarInsumo(i.id, usuario.id);
      cargar();
    } catch (err) {
      alert(err.message);
    }
  };

  const confirmarAjuste = async (e) => {
    e.preventDefault();
    const delta = Number(ajusteForm.delta);
    if (!delta) return;
    try {
      await ajustarStockInsumo(ajustando.id, delta, ajusteForm.motivo || null, usuario.id);
      setAjustando(null);
      cargar();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-white">Insumos</h2>
        <button onClick={abrirNuevo} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'rgb(249,115,22)' }}>
          ＋ Nuevo insumo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={filtroModo} onChange={(e) => setFiltroModo(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option value="">Automático + Manual</option>
          <option value="automatico">Solo automático</option>
          <option value="manual">Solo manual</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg cursor-pointer" style={{ ...inputStyle, color: '#94a3b8' }}>
          <input type="checkbox" checked={soloBajoStock} onChange={(e) => setSoloBajoStock(e.target.checked)} />
          Solo stock bajo
        </label>
      </div>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : insumos.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>No hay insumos que coincidan con el filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1a1a26' }}>
                {['Nombre', 'Unidad', 'Stock', 'Mín / Máx', 'Precio compra', 'Modo', 'Proveedor', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase" style={{ color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => {
                const alerta = estadoStock(i);
                return (
                  <tr key={i.id} style={{ borderTop: '1px solid #2a2a3a' }}>
                    <td className="px-3 py-2 font-semibold text-white">{i.nombre}</td>
                    <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{i.unidad}</td>
                    <td className="px-3 py-2">
                      <span className="font-bold" style={{ color: alerta ? alerta.color : '#e2e8f0' }}>{i.stock_actual}</span>
                      {alerta && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: alerta.bg, color: alerta.color }}>
                          {alerta.texto}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2" style={{ color: '#64748b' }}>{i.stock_min} / {i.stock_max}</td>
                    <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{i.precio_compra.toLocaleString('es-CO')}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: i.modo_descuento === 'automatico' ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)', color: i.modo_descuento === 'automatico' ? '#34d399' : '#94a3b8' }}>
                        {i.modo_descuento === 'automatico' ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: '#94a3b8' }}>{i.proveedor_nombre || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setAjustando(i); setAjusteForm({ delta: '', motivo: '' }); }}
                          title="Ajustar stock" className="w-7 h-7 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#fbbf24' }}>±</button>
                        <button onClick={() => abrirEditar(i)} title="Editar" className="w-7 h-7 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#94a3b8' }}>✎</button>
                        <button onClick={() => eliminar(i)} title="Eliminar" className="w-7 h-7 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#f87171' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditando(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardar}
            className="w-full max-w-md rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">{editando.id ? 'Editar insumo' : 'Nuevo insumo'}</h3>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Nombre</label>
              <input required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Unidad</label>
                <input list="unidades-sugeridas" value={form.unidad} onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}
                  placeholder="Ej: kg, bandeja, caja..." className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                <datalist id="unidades-sugeridas">
                  {UNIDADES_SUGERIDAS.map((u) => <option key={u} value={u} />)}
                </datalist>
              </div>
              {!editando.id && (
                <div>
                  <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Stock inicial</label>
                  <input type="number" step="any" value={form.stock_actual} onChange={(e) => setForm((f) => ({ ...f, stock_actual: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Stock mínimo</label>
                <input type="number" step="any" value={form.stock_min} onChange={(e) => setForm((f) => ({ ...f, stock_min: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Stock máximo</label>
                <input type="number" step="any" value={form.stock_max} onChange={(e) => setForm((f) => ({ ...f, stock_max: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Precio de compra</label>
              <input type="number" step="any" value={form.precio_compra} onChange={(e) => setForm((f) => ({ ...f, precio_compra: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Proveedor</label>
              <select value={form.proveedor_id} onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle}>
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Modo de descuento</label>
              <div className="flex gap-2">
                {[['manual', 'Manual (ajuste a mano)'], ['automatico', 'Automático (usa receta)']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, modo_descuento: v }))}
                    className="flex-1 py-2 rounded-lg text-xs font-bold"
                    style={{ background: form.modo_descuento === v ? 'rgb(249,115,22)' : '#1e1e2d', color: form.modo_descuento === v ? '#fff' : '#94a3b8' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Guardar</button>
              <button type="button" onClick={() => setEditando(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1e1e2d', color: '#94a3b8' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal ajuste de stock */}
      {ajustando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setAjustando(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={confirmarAjuste}
            className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">Ajustar stock de {ajustando.nombre}</h3>
            <p className="text-xs" style={{ color: '#64748b' }}>Stock actual: <strong style={{ color: '#e2e8f0' }}>{ajustando.stock_actual} {ajustando.unidad}</strong></p>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Cambio (+ entra, - sale)</label>
              <input required type="number" step="any" value={ajusteForm.delta} onChange={(e) => setAjusteForm((f) => ({ ...f, delta: e.target.value }))}
                placeholder="Ej: -1.2 o 10" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Motivo (opcional)</label>
              <input value={ajusteForm.motivo} onChange={(e) => setAjusteForm((f) => ({ ...f, motivo: e.target.value }))}
                placeholder="Ej: Conteo físico semanal" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'rgb(249,115,22)' }}>Aplicar</button>
              <button type="button" onClick={() => setAjustando(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#1e1e2d', color: '#94a3b8' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
