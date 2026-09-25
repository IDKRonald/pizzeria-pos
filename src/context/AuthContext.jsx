// src/context/AuthContext.jsx
// Contexto de autenticación — sesión del usuario con PIN

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { loginPIN } from '../lib/api';
import socket from '../lib/socket';

const AuthContext = createContext(null);

const SS_KEY = 'pos_session';

function readSession() {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(readSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Asegurar que el socket se conecta y une a la sala correcta incluso si se recarga la página
  useEffect(() => {
    if (usuario) {
      socket.connect();
      socket.emit('unirse_sala', usuario.rol === 'cocina' ? 'cocina' : 'caja');
      // mesero, cajero y admin ven el diagrama de mesas en vivo
      if (usuario.rol !== 'cocina') {
        socket.emit('unirse_sala', 'mesas');
      }
    } else {
      socket.disconnect();
    }
  }, [usuario]);

  // Cuando un admin resetea los datos de prueba, todo el mundo recarga
  // para no seguir mostrando pedidos/mesas que ya no existen.
  useEffect(() => {
    const onDatosReseteados = () => window.location.reload();
    socket.on('datos_reseteados', onDatosReseteados);
    return () => socket.off('datos_reseteados', onDatosReseteados);
  }, []);

  const login = useCallback(async (pin) => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginPIN(pin);
      setUsuario(user);
      sessionStorage.setItem(SS_KEY, JSON.stringify(user));

      // El useEffect de arriba se encargará de conectar el socket y unirse a la sala
      return user;
    } catch (err) {
      setError(err.message || 'PIN incorrecto');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    sessionStorage.removeItem(SS_KEY);
    // El useEffect de arriba se encargará de desconectar el socket
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
