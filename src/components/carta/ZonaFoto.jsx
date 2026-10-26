import { useRef, useState } from 'react';
import { subirImagenProducto } from '../../lib/api';
import { tieneFoto, urlImagen, validarFoto } from '../../lib/carta';

const IconoCamara = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const botonCls = `min-h-[44px] px-4 rounded-xl text-sm font-semibold cursor-pointer touch-manipulation
  border border-[var(--border-1)] text-[var(--text-1)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]`;

export default function ZonaFoto({ imagen, nombre, variante, onSubida, onError }) {
  const inputRef = useRef(null);
  const camaraRef = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [fallo, setFallo] = useState(null);
  const editor = variante === 'editor';
  const hayFoto = tieneFoto(imagen) && fallo !== imagen;

  const procesar = async (file) => {
    if (!file || subiendo) return;
    const msg = validarFoto(file);
    if (msg) { onError(msg); return; }
    setSubiendo(true);
    try {
      const { url } = await subirImagenProducto(file);
            onSubida(url);
    } catch (e) {
      onError(e?.message || 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const alElegir = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    procesar(file);
  };

  const alSoltar = (e) => {
    e.preventDefault();
    setArrastrando(false);
    procesar(e.dataTransfer?.files?.[0]);
  };

  const abrir = () => inputRef.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setArrastrando(false); }}
        onDrop={alSoltar}
        className={`relative w-full overflow-hidden rounded-xl ${editor ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}
        style={{
          background: 'var(--tono-l)',
          border: `2px ${hayFoto ? 'solid' : 'dashed'} ${arrastrando ? 'var(--accent)' : 'var(--border-1)'}`,
        }}
      >
        {hayFoto && (
          <img src={urlImagen(imagen)} alt="" onError={() => setFallo(imagen)} className="w-full h-full object-cover" />
        )}
        {!hayFoto && (
          <button
            type="button"
            onClick={abrir}
            disabled={subiendo}
            aria-label={`Agregar foto${nombre ? ` de ${nombre}` : ''}`}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 cursor-pointer touch-manipulation
                       text-[var(--text-1)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <IconoCamara />
            <span className="text-sm font-semibold">Agregar foto</span>
            <span className="text-xs text-[var(--text-2)]">{editor ? 'Arrastra la foto aquí' : 'Toca o arrastra aquí'}</span>
          </button>
        )}
        {subiendo && (
          <div role="status" className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
            style={{ background: 'var(--bg-surf2)', color: 'var(--text-1)', opacity: 0.9 }}>
            Subiendo…
          </div>
        )}
      </div>

      {editor && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={abrir} disabled={subiendo} className={botonCls}>
            {hayFoto ? 'Cambiar foto' : 'Elegir foto'}
          </button>
          <button type="button" onClick={() => camaraRef.current?.click()} disabled={subiendo} className={botonCls}>
            Tomar con la cámara
          </button>
          <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={alElegir} />
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={alElegir} />
    </div>
  );
}
