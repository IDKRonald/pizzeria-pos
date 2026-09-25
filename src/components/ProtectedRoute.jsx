// src/components/ProtectedRoute.jsx
// Redirige a login si no hay sesión activa

import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  // Si se especifican roles permitidos, verificar
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/hub" replace />;
  }

  return children;
}
