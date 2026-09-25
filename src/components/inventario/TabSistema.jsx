// src/components/inventario/TabSistema.jsx
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resetearDatosPrueba } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };

export default function TabSistema() {
  const { usuario } = useAuth();
  const [revertirStock, setRevertirStock] = useState(true);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const puedeConfirmar = textoConfirmacion.trim().toUpperCase() === 'BORRAR';

  const ejecutar = async () => {
    if (!puedeConfirmar || procesando) return;
    setProcesando(true);
    setError(null);
    try {
      const res = await resetearDatosPrueba({ revertir_stock: revertirStock }, usuario.id);
      setResultado(res);
      setTextoConfirmacion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-bold text-white">Sistema</h2>

      <div className="p-5 rounded-xl space-y-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.35)' }}>
        <div>
          <p className="text-sm font-bold" style={{ color: '#f87171' }}>⚠️ Zona de peligro — Borrar datos de prueba</p>
          <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>
            Elimina TODOS los pedidos, pagos, movimientos de inventario y cierres de caja registrados hasta ahora,
            y deja todas las mesas libres. Úsalo cuando termines de probar el sistema y quieras arrancar con la
            operación real desde cero.
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#94a3b8' }}>
            <strong style={{ color: '#e2e8f0' }}>No se borran:</strong> la carta (categorías/productos), los insumos
            configurados, proveedores ni usuarios.
          </p>
        </div>

        <label className="flex items-start gap-2 text-xs" style={{ color: '#e2e8f0' }}>
          <input type="checkbox" checked={revertirStock} onChange={(e) => setRevertirStock(e.target.checked)} className="mt-0.5" />
          <span>
            Revertir en el stock de insumos el efecto de esos movimientos (recomendado). Si lo desmarcas, el
            stock actual de cada insumo se queda como está — tendrás que ajustarlo manualmente.
          </span>
        </label>

        {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

        {resultado ? (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
            ✅ Se eliminaron {resultado.pedidos_eliminados} pedido(s) de prueba. Se guardó un respaldo por si acaso.
            La página se recargará sola en todos los dispositivos conectados.
          </div>
        ) : (
          <div className="space-y-2 pt-1" style={{ borderTop: '1px solid rgba(239,68,68,0.25)' }}>
            <label className="block text-[11px] font-bold uppercase mt-3" style={{ color: '#f87171' }}>
              Escribe BORRAR para confirmar
            </label>
            <div className="flex gap-2">
              <input value={textoConfirmacion} onChange={(e) => setTextoConfirmacion(e.target.value)}
                placeholder="BORRAR" className="flex-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
              <button onClick={ejecutar} disabled={!puedeConfirmar || procesando}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-40"
                style={{ background: 'rgb(220,38,38)' }}>
                {procesando ? 'Borrando…' : 'Borrar datos de prueba'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
