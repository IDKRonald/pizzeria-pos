// src/context/DialogosContext.jsx
// Avisos y preguntas propias de la app, en lugar de alert/confirm/prompt del navegador
// (que en modo --app se ven ajenas, bloquean la pantalla y es fácil tocar mal).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Aviso from '../components/carta/Aviso';

const DialogosContext = createContext(null);

const foco = 'focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]';
const btn = `min-h-[44px] px-4 rounded-xl text-sm font-bold cursor-pointer touch-manipulation ${foco}`;

function Dialogo({ dialogo, onResponder }) {
  const [texto, setTexto] = useState('');
  const cajaRef = useRef(null);
  const responderRef = useRef(onResponder);
  useEffect(() => { responderRef.current = onResponder; });

  useEffect(() => {
    const previo = document.activeElement;
    cajaRef.current?.querySelector('input, [data-principal]')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); responderRef.current(null); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previo?.focus?.(); };
  }, []);

  const esTexto = dialogo.tipo === 'texto';
  const aceptar = () => onResponder(esTexto ? texto.trim() || null : true);

  return (
    <div className="no-print fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
      <form ref={cajaRef} role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo"
        onSubmit={(e) => { e.preventDefault(); aceptar(); }}
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 border border-[var(--border-1)]"
        style={{ background: 'var(--bg-surf2)', color: 'var(--text-1)' }}>
        <h2 id="dialogo-titulo" className="text-lg font-extrabold">{dialogo.titulo}</h2>
        {dialogo.mensaje && <p className="text-sm" style={{ color: 'var(--text-2)' }}>{dialogo.mensaje}</p>}
        {esTexto && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {dialogo.etiqueta}
            <input value={texto} onChange={(e) => setTexto(e.target.value)} inputMode={dialogo.inputMode}
              placeholder={dialogo.placeholder}
              className={`min-h-[44px] px-3 rounded-xl text-base border border-[var(--border-1)] ${foco}`}
              style={{ background: 'var(--bg-surf6)', color: 'var(--text-1)' }} />
          </label>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => onResponder(null)} className={`${btn} border border-[var(--border-2)]`}>
            {dialogo.cancelar || 'Cancelar'}
          </button>
          <button type="submit" data-principal disabled={esTexto && !texto.trim()} className={`${btn} disabled:opacity-40`}
            style={dialogo.peligro ? { background: '#dc2626', color: '#fff' } : { background: 'var(--accent)', color: 'var(--on-accent)' }}>
            {dialogo.aceptar || 'Aceptar'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function DialogosProvider({ children }) {
  const [aviso, setAviso] = useState(null);
  const [dialogo, setDialogo] = useState(null);

  const avisar = useCallback((texto) => setAviso({ texto }), []);
  const preguntar = useCallback((opciones) => new Promise((resolver) => setDialogo({ ...opciones, resolver })), []);
  /** Pregunta sí/no; resuelve true o false. */
  const confirmar = useCallback((opciones) => preguntar({ ...opciones, tipo: 'confirmar' }).then(Boolean), [preguntar]);
  /** Pide un texto; resuelve el texto o null si se cancela. */
  const pedirTexto = useCallback((opciones) => preguntar({ ...opciones, tipo: 'texto' }), [preguntar]);

  const responder = (valor) => { dialogo.resolver(valor); setDialogo(null); };

  return (
    <DialogosContext.Provider value={{ avisar, confirmar, pedirTexto }}>
      {children}
      {dialogo && <Dialogo key={dialogo.titulo} dialogo={dialogo} onResponder={responder} />}
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
    </DialogosContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook del mismo contexto
export const useDialogos = () => useContext(DialogosContext);
