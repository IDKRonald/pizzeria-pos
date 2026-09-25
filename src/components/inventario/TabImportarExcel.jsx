// src/components/inventario/TabImportarExcel.jsx
import { useState, useRef } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { useAuth } from '../../context/AuthContext';
import { importarInsumos } from '../../lib/api';

const inputStyle = { background: '#1e1e2d', border: '1px solid #2a2a3a', color: '#fff' };

const SCHEMA = {
  'nombre':         { prop: 'nombre', type: String, required: true },
  'unidad':         { prop: 'unidad', type: String },
  'stock_actual':   { prop: 'stock_actual', type: Number },
  'stock_min':      { prop: 'stock_min', type: Number },
  'stock_max':      { prop: 'stock_max', type: Number },
  'precio_compra':  { prop: 'precio_compra', type: Number },
  'proveedor':      { prop: 'proveedor', type: String },
  'modo_descuento': { prop: 'modo_descuento', type: String },
};

const COLUMNAS = Object.keys(SCHEMA);

export default function TabImportarExcel() {
  const { usuario } = useAuth();
  const inputRef = useRef(null);
  const [filas, setFilas] = useState([]);
  const [erroresParseo, setErroresParseo] = useState([]);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  const handleArchivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNombreArchivo(file.name);
    setResultado(null);
    setError(null);
    try {
      const { rows, errors } = await readXlsxFile(file, { schema: SCHEMA });
      setFilas(rows.map((r) => ({
        nombre: r.nombre || '',
        unidad: r.unidad || 'unidad',
        stock_actual: r.stock_actual ?? 0,
        stock_min: r.stock_min ?? 0,
        stock_max: r.stock_max ?? 0,
        precio_compra: r.precio_compra ?? 0,
        proveedor: r.proveedor || '',
        modo_descuento: r.modo_descuento === 'automatico' ? 'automatico' : 'manual',
      })));
      setErroresParseo(errors || []);
    } catch (err) {
      setError('No se pudo leer el archivo: ' + err.message);
      setFilas([]);
    }
  };

  const quitarFila = (idx) => setFilas((prev) => prev.filter((_, i) => i !== idx));

  const editarFila = (idx, campo, valor) => {
    setFilas((prev) => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f));
  };

  const confirmar = async () => {
    if (filas.length === 0) return;
    setProcesando(true);
    setError(null);
    try {
      const res = await importarInsumos(filas, usuario.id);
      setResultado(res);
      setFilas([]);
      setNombreArchivo('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-lg font-bold text-white">Importar inventario desde Excel</h2>
      <p className="text-xs" style={{ color: '#64748b' }}>
        Solo para la carga inicial. La primera fila del Excel debe tener estos encabezados exactos:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {COLUMNAS.map((c) => (
          <code key={c} className="px-2 py-1 rounded text-[11px]" style={{ background: '#1e1e2d', color: '#fbbf24' }}>{c}</code>
        ))}
      </div>
      <p className="text-xs" style={{ color: '#64748b' }}>
        <code style={{ color: '#fbbf24' }}>modo_descuento</code> debe decir "automatico" o "manual" (si queda vacío o distinto, se toma como manual).
        <code style={{ color: '#fbbf24' }}> proveedor</code> es el nombre — si no existe todavía, se crea automáticamente.
      </p>

      <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleArchivo}
        className="block text-sm" style={{ color: '#94a3b8' }} />

      {error && <p className="text-sm text-red-400">⚠️ {error}</p>}

      {erroresParseo.length > 0 && (
        <div className="p-3 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
          {erroresParseo.length} celda(s) no se pudieron leer correctamente (fila/columna): {erroresParseo.map((e, i) => (
            <span key={i}>{i > 0 ? ', ' : ''}F{e.row}·{e.column}</span>
          ))}
        </div>
      )}

      {resultado && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
          ✅ Se crearon {resultado.creados} insumos ({resultado.proveedoresCreados} proveedores nuevos).
          {resultado.errores.length > 0 && (
            <span> {resultado.errores.length} fila(s) se saltaron: {resultado.errores.map((e) => `fila ${e.fila} (${e.error})`).join(', ')}</span>
          )}
        </div>
      )}

      {filas.length > 0 && (
        <>
          <p className="text-sm font-semibold text-white">Vista previa de "{nombreArchivo}" — {filas.length} fila(s)</p>
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #2a2a3a' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#1a1a26' }}>
                  {COLUMNAS.map((c) => (
                    <th key={c} className="text-left px-2 py-2 font-bold uppercase" style={{ color: '#64748b' }}>{c}</th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #2a2a3a' }}>
                    {COLUMNAS.map((c) => (
                      <td key={c} className="px-2 py-1">
                        <input value={f[c]} onChange={(e) => editarFila(idx, c, e.target.value)}
                          className="w-24 px-1.5 py-1 rounded text-xs" style={inputStyle} />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <button onClick={() => quitarFila(idx)} className="w-6 h-6 rounded text-xs" style={{ background: '#1e1e2d', color: '#f87171' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={confirmar} disabled={procesando}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: 'rgb(249,115,22)' }}>
            {procesando ? 'Importando...' : `✓ Confirmar importación de ${filas.length} insumo(s)`}
          </button>
        </>
      )}
    </div>
  );
}
