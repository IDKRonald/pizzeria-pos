// src/hooks/useCajaAbierta.js
// Hook liviano: estado de la caja (abierta/cerrada) + totales en vivo.
// Se refresca solo cuando otro dispositivo abre/cierra caja (evento
// 'caja_actualizada', ya se une todo el mundo menos cocina a sala_caja
// en AuthContext.jsx).
import { useState, useEffect, useCallback } from 'react';
import { getCajaActual } from '../lib/api';
import socket from '../lib/socket';

export function useCajaAbierta() {
  const [caja, setCaja] = useState(null);
  const [totales, setTotales] = useState(null);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(() => {
    getCajaActual()
      .then((d) => { setCaja(d.caja); setTotales(d.totales); })
      .catch(() => { setCaja(null); setTotales(null); })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    refrescar();
    // Los cobros cambian los totales: sin esto, el cuadre en pantalla quedaba viejo al cerrar.
    const eventos = ['caja_actualizada', 'nuevo_pedido', 'pedido_actualizado'];
    eventos.forEach((e) => socket.on(e, refrescar));
    return () => eventos.forEach((e) => socket.off(e, refrescar));
  }, [refrescar]);

  return { caja, totales, cajaAbierta: !!caja, cargandoCaja: cargando, refrescarCaja: refrescar };
}
