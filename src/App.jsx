// src/App.jsx
// Componente raíz — Router + AuthProvider

import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import HubPage from './pages/HubPage';
import PosPage from './pages/PosPage';
import MesasPage from './pages/MesasPage';
import KdsPage from './pages/KdsPage';
import InventarioPage from './pages/InventarioPage';
import EstadisticasPage from './pages/EstadisticasPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Login público */}
          <Route path="/" element={<LoginPage />} />

          {/* Rutas protegidas */}
          <Route path="/hub" element={
            <ProtectedRoute><HubPage /></ProtectedRoute>
          } />
          <Route path="/pos" element={
            <ProtectedRoute roles={['admin','cajero','mesero']}><PosPage /></ProtectedRoute>
          } />
          <Route path="/mesas" element={
            <ProtectedRoute roles={['admin','cajero','mesero']}><MesasPage /></ProtectedRoute>
          } />
          <Route path="/kds" element={
            <ProtectedRoute roles={['admin','cajero','mesero','cocina']}><KdsPage /></ProtectedRoute>
          } />
          <Route path="/inventario" element={
            <ProtectedRoute roles={['admin']}><InventarioPage /></ProtectedRoute>
          } />
          <Route path="/estadisticas" element={
            <ProtectedRoute roles={['admin','cajero']}><EstadisticasPage /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
