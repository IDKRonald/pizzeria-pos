// src/components/inventario/TabProveedores.jsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getProveedores, crearProveedor, actualizarProveedor, eliminarProveedor } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };

function waLink(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  return digitos ? `https://wa.me/${digitos}` : null;
}

export default function TabProveedores() {
  const { usuario } = useAuth();
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, {id,...} = editar
  const [form, setForm] = useState({ nombre: '', telefono: '' });

  const cargar = useCallback(() => {
    setCargando(true);
    getProveedores().then((d) => { setProveedores(d); setError(null); }).catch((e) => setError(e.message)).finally(() => setCargando(false));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => { setForm({ nombre: '', telefono: '' }); setEditando({}); };
  const abrirEditar = (p) => { setForm({ nombre: p.nombre, telefono: p.telefono || '' }); setEditando(p); };

  const guardar = async (e) => {
    e.preventDefault();
    try {
      if (editando.id) await actualizarProveedor(editando.id, form, usuario.id);
      else await crearProveedor(form, usuario.id);
      setEditando(null);
      cargar();
    } catch (err) {
      alert(err.message);
    }
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar proveedor "${p.nombre}"?`)) return;
    try {
      await eliminarProveedor(p.id, usuario.id);
      cargar();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Proveedores</h2>
        <button onClick={abrirNuevo} className="px-3.5 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'rgb(249,115,22)' }}>
          ＋ Nuevo proveedor
        </button>
      </div>

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : proveedores.length === 0 ? (
        <p className="text-sm" style={{ color: '#64748b' }}>Aún no hay proveedores registrados.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {proveedores.map((p) => (
            <div key={p.id} className="p-4 rounded-xl" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-white">{p.nombre}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{p.telefono || 'Sin teléfono'}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => abrirEditar(p)} className="w-7 h-7 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#94a3b8' }}>✎</button>
                  <button onClick={() => eliminar(p)} className="w-7 h-7 rounded-lg text-xs" style={{ background: '#1e1e2d', color: '#f87171' }}>✕</button>
                </div>
              </div>
              {waLink(p.telefono) && (
                <a href={waLink(p.telefono)} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ background: '#059669' }}>
                  💬 WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setEditando(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardar}
            className="w-full max-w-xs rounded-2xl p-5 space-y-3" style={{ background: '#13131b', border: '1px solid #2a2a3a' }}>
            <h3 className="text-base font-bold text-white">{editando.id ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Nombre</label>
              <input required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase mb-1" style={{ color: '#64748b' }}>Teléfono (WhatsApp)</label>
              <input value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="573001234567" className="w-full px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              <p className="text-[10px] mt-1" style={{ color: '#64748b' }}>Código de país + número, solo dígitos. Ej: 573001234567</p>
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
