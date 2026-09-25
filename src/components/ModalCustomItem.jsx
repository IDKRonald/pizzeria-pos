import { useState, useRef, useEffect } from 'react';

export default function ModalCustomItem({ onSeleccionar, onCerrar }) {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirmar = (e) => {
    e.preventDefault();
    const precioNum = parseInt(precio, 10);
    if (!nombre.trim()) return;
    if (isNaN(precioNum) || precioNum < 0) return;

    onSeleccionar({
      id: `custom_${Date.now()}`,
      nombre: nombre.trim(),
      precio: precioNum,
      imagen: '✏️',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-[fadeScaleIn_0.18s_ease-out]"
        style={{
          background: 'var(--bg-surf4)',
          border: '1px solid var(--border-1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del modal */}
        <div
          className="flex items-start gap-4 px-5 pt-5 pb-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)' }}
        >
          <span className="text-5xl select-none leading-none">✏️</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold leading-tight transition-all" style={{ color: 'var(--text-1)' }}>
              Artículo Personalizado
            </h3>
            <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
              Ingresa el nombre y precio
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar modal"
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0
                       text-sm font-bold transition-colors duration-150 hover:opacity-70"
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleConfirmar} className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
              Nombre del artículo
            </label>
            <input
              ref={inputRef}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Propina extra, Descorche..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
              style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.7)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-2)'; }}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-4)' }}>
              Precio (Mínimo $0)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--text-4)' }}>$</span>
              <input
                type="number"
                min="0"
                step="100"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                placeholder="0"
                className="w-full pl-7 pr-3 py-2 rounded-xl text-sm outline-none transition-all font-bold"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.7)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-2)'; }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!nombre.trim() || isNaN(parseInt(precio)) || parseInt(precio) < 0}
            className="mt-2 w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2
                       text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgb(249,115,22)' }}
          >
            Agregar al Carrito
          </button>
        </form>
      </div>
    </div>
  );
}
