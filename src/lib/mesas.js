// Colores y formatos compartidos por la cuadrícula de mesas y su panel de detalle.

// Un color por estado; también difieren en claridad para no depender solo del tono.
export const ESTADO_MESA = {
  libre:          { t: 'Libre',             c: '#8A90A0', fondo: '#1E2129' },
  ocupada:        { t: 'Tomando pedido',    c: '#8FB8FF', fondo: '#1C2333' },
  en_preparacion: { t: 'En cocina',         c: '#F2B33D', fondo: '#2A2416' },
  lista:          { t: 'Lista para servir', c: '#4FB38A', fondo: '#16271F' },
  por_pagar:      { t: 'Por cobrar',        c: '#C49BFF', fondo: '#241B33' },
};

export const fmt = (n) => '$ ' + Math.round(n || 0).toLocaleString('es-CO');
export const etiquetaEstilo = (c) => ({ background: c, color: '#121318' });
