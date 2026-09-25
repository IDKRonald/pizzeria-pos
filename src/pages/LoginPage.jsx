// src/pages/LoginPage.jsx
// Pantalla de acceso con PIN de 4 dígitos — estilo caja registradora

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const { login, loading, error, usuario } = useAuth();
  const navigate = useNavigate();

  // Si ya tiene sesión, ir al hub
  useEffect(() => {
    if (usuario) navigate('/hub', { replace: true });
  }, [usuario, navigate]);

  const handleDigit = useCallback((digit) => {
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      return prev + digit;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (pin.length !== 4) return;
    try {
      await login(pin);
      navigate('/hub', { replace: true });
    } catch {
      setShake(true);
      setTimeout(() => { setShake(false); setPin(''); }, 500);
    }
  }, [pin, login, navigate]);

  // Auto-submit al completar 4 dígitos
  useEffect(() => {
    if (pin.length === 4) handleSubmit();
  }, [pin, handleSubmit]);

  // Teclado físico
  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleDigit, handleBackspace, handleSubmit]);

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(145deg, #0a0a12 0%, #0f0f1a 50%, #0a0a12 100%)' }}>

      {/* Logo y título */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600
                        flex items-center justify-center text-4xl shadow-lg shadow-orange-500/20">
          🍕
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Don Peñolinni
        </h1>
        <p className="text-sm mt-1" style={{ color: '#64748b' }}>
          Sistema Punto de Venta
        </p>
      </div>

      {/* Indicador de PIN */}
      <div className={`flex gap-3 mb-6 transition-transform ${shake ? 'animate-shake' : ''}`}>
        {[0,1,2,3].map((i) => (
          <div key={i}
            className="w-4 h-4 rounded-full transition-all duration-200"
            style={{
              background: pin.length > i
                ? 'linear-gradient(135deg, rgb(249,115,22), rgb(234,88,12))'
                : '#2a2a3a',
              boxShadow: pin.length > i ? '0 0 12px rgba(249,115,22,0.4)' : 'none',
              transform: pin.length > i ? 'scale(1.15)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* Mensaje de error */}
      {error && (
        <p className="text-red-400 text-sm font-medium mb-4 animate-pulse">
          {error}
        </p>
      )}

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />;
          const isBackspace = d === '⌫';
          return (
            <button key={i}
              onClick={() => isBackspace ? handleBackspace() : handleDigit(d)}
              disabled={loading}
              className="h-16 rounded-2xl text-xl font-bold
                         transition-all duration-150
                         active:scale-95 select-none touch-manipulation"
              style={{
                background: isBackspace ? '#1a1a26' : '#1e1e2d',
                color: isBackspace ? '#94a3b8' : '#f1f0f5',
                border: '1px solid #2a2a3a',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2a3d'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isBackspace ? '#1a1a26' : '#1e1e2d'; e.currentTarget.style.borderColor = '#2a2a3a'; }}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="mt-6 flex items-center gap-2 text-orange-400 text-sm">
          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          Verificando...
        </div>
      )}

      {/* Usuarios de prueba */}
      <div className="mt-10 text-center">
        <p className="text-xs mb-2" style={{ color: '#475569' }}>PINs de acceso rápido</p>
        <div className="flex gap-2 flex-wrap justify-center">
          {[
            { pin: '0000', rol: 'Admin' },
            { pin: '1234', rol: 'Cajero' },
            { pin: '1111', rol: 'Mesero' },
            { pin: '2222', rol: 'Cocina' },
          ].map((u) => (
            <button key={u.pin}
              onClick={() => setPin(u.pin)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono transition-colors"
              style={{ background: '#1a1a26', border: '1px solid #2a2a3a', color: '#64748b' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f0f5'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#2a2a3a'; }}
            >
              {u.pin} · {u.rol}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
