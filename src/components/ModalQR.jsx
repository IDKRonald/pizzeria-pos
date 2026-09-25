// src/components/ModalQR.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { getRedLocal } from '../lib/api';

const LS_QR_URL = 'pos_v1_qr_url';
const PORT       = window.location.port || '5173';

/* ─── URL inicial ─────────────────────────────────────────────────────── */
function getUrlInicial() {
  // 1. ¿La página ya se abrió desde una IP? (no localhost) → úsala
  const host = window.location.host;
  if (/^(\d{1,3}\.){3}\d{1,3}/.test(host)) {
    return `${window.location.protocol}//${host}`;
  }
  // 2. ¿Hay algo guardado en localStorage? → úsalo
  const saved = localStorage.getItem(LS_QR_URL);
  if (saved) return saved;
  // 3. Fallback: localhost
  return `http://localhost:${PORT}`;
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function ModalQR({ onCerrar }) {
  const [url, setUrl]             = useState(getUrlInicial);
  const [detectando, setDetectando] = useState(false);
  const [candidatas, setCandidatas] = useState([]); // IPs de red detectadas en el backend
  const [errorDeteccion, setErrorDeteccion] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false); // indicador "Guardada ✓"
  const debounceRef = useRef(null);
  const eraLocalhostAlAbrir = useRef(/localhost|127\.0\.0\.1/.test(url));

  /* Cada vez que `url` cambia → guardar en localStorage (debounce 400ms) */
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem(LS_QR_URL, url);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [url]);

  /* Preguntarle al backend (Node) su(s) IP(s) de red local — mucho más
     confiable que detectarla desde el navegador, que por privacidad suele
     ocultarla detrás de un nombre *.local vía WebRTC. */
  const handleDetectar = async () => {
    setDetectando(true);
    setErrorDeteccion(false);
    try {
      const { ips } = await getRedLocal();
      setCandidatas(ips || []);
      if (ips && ips.length > 0) {
        setUrl(`http://${ips[0].ip}:${PORT}`);
      } else {
        setErrorDeteccion(true);
      }
    } catch {
      setErrorDeteccion(true);
    } finally {
      setDetectando(false);
    }
  };

  /* Al abrir el modal: si no hay ya una IP elegida, detecta sola sin que haya que tocar nada */
  useEffect(() => {
    if (eraLocalhostAlAbrir.current) handleDetectar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esLocalhost = /localhost|127\.0\.0\.1/.test(url);

  /* QR como imagen via API pública (sin paquetes npm) */
  const qrSrc = useMemo(() => {
    const data = encodeURIComponent(url.trim() || `http://localhost:${PORT}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${data}&qzone=1&format=png`;
  }, [url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(6px)' }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Conectar dispositivo por QR"
    >
      <div
        className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surf4)', border: '1px solid var(--border-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div>
            <h3 className="text-base font-extrabold" style={{ color: 'var(--text-1)' }}>
              📱 Conectar dispositivo
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              Escanea desde la cámara de tu tablet o celular
            </p>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold"
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}>✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-5 space-y-4">

          {/* QR */}
          <div className="flex items-center justify-center p-4 rounded-2xl bg-white shadow-inner">
            <img src={qrSrc} alt={`QR → ${url}`} width={220} height={220}
              style={{ display: 'block', borderRadius: '8px' }} />
          </div>

          {/* Campo de URL editable */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="qr-url-input"
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-4)' }}>
                Dirección de red
              </label>

              {/* Indicador "Guardada ✓" */}
              <span
                className="text-[11px] font-semibold transition-opacity duration-300"
                style={{
                  color: 'rgb(5,150,105)',
                  opacity: savedFlash ? 1 : 0,
                }}
              >
                💾 Guardada
              </span>
            </div>

            <div className="flex gap-2">
              <input
                id="qr-url-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-xs font-mono outline-none
                           transition-all duration-150"
                style={{
                  background: 'var(--bg-surf6)',
                  border: '1px solid var(--border-2)',
                  color: 'var(--text-1)',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.7)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'var(--border-2)'; }}
              />

              {/* Botón auto-detectar */}
              <button
                onClick={handleDetectar}
                disabled={detectando}
                title="Detectar IP local automáticamente"
                aria-label="Detectar IP local"
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl
                           text-sm transition-all duration-150 active:scale-95
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--bg-surf7)',
                  border: '1px solid var(--border-2)',
                  color: 'var(--text-2)',
                }}
              >
                {detectando
                  ? <span className="inline-block w-4 h-4 rounded-full border-2
                                     border-t-orange-500 animate-spin"
                           style={{ border: '2px solid var(--border-3)', borderTopColor: 'rgb(249,115,22)' }} />
                  : '🔍'}
              </button>
            </div>

            <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-4)' }}>
              La dirección se guarda automáticamente al editarla.
            </p>

            {/* Si la PC tiene más de una red (ej. WiFi + cable), dejar elegir cuál usar */}
            {candidatas.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidatas.map((c) => {
                  const suUrl = `http://${c.ip}:${PORT}`;
                  const activa = url === suUrl;
                  return (
                    <button key={c.ip} onClick={() => setUrl(suUrl)}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono transition-all"
                      style={{
                        background: activa ? 'rgba(249,115,22,0.15)' : 'var(--bg-surf6)',
                        border: activa ? '1px solid rgb(249,115,22)' : '1px solid var(--border-2)',
                        color: activa ? 'rgb(249,115,22)' : 'var(--text-3)',
                      }}>
                      {c.interfaz}: {c.ip}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Aviso según tipo de URL */}
          {errorDeteccion ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(234,108,16,0.1)', border: '1px solid rgba(234,108,16,0.3)',
                color: 'rgb(160,80,0)' }}>
              <span className="text-sm shrink-0">⚠️</span>
              <span>
                No se pudo detectar la IP automáticamente (¿el backend está corriendo?).
                Edita la dirección a mano con la IP de tu PC (ej.{' '}
                <code className="font-mono">192.168.1.45:{PORT}</code>) — la encuentras
                escribiendo <code className="font-mono">ipconfig</code> en una consola de Windows.
              </span>
            </div>
          ) : esLocalhost ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(234,108,16,0.1)', border: '1px solid rgba(234,108,16,0.3)',
                color: 'rgb(160,80,0)' }}>
              <span className="text-sm shrink-0">⚠️</span>
              <span>
                <strong>localhost</strong> solo funciona en este PC.
                {detectando ? ' Detectando tu IP automáticamente…' : (
                  <>Presiona <strong>🔍</strong> para detectar tu IP automáticamente,
                  o edita la dirección con la IP de tu PC (ej.{' '}
                  <code className="font-mono">192.168.1.45:{PORT}</code>).</>
                )}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)',
                color: 'rgb(4,120,87)' }}>
              <span className="text-sm">✅</span>
              <span>
                Asegúrate de que el dispositivo esté en la misma red WiFi.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
