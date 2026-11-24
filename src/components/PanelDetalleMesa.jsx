// src/components/PanelDetalleMesa.jsx
// Detalle de una mesa (o de todo su grupo si está unida), al lado de la cuadrícula:
// saldo, cobrar, tomar/agregar pedido, pedido para llevar y opciones del administrador.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useDialogos } from '../context/DialogosContext';
import socket from '../lib/socket';
import { getPedidosDeMesa, separarMesas, liberarMesa, eliminarMesa } from '../lib/api';
import { ESTADO_MESA, fmt, etiquetaEstilo } from '../lib/mesas';

const ESTADO_PEDIDO = {
  pendiente:      ['Por empezar', '#8FB8FF'],
  en_preparacion: ['En preparación', '#F2B33D'],
  listo:          ['Listo', '#4FB38A'],
  entregado:      ['Entregado', '#C49BFF'],
  pagado:         ['Pagado', '#8A90A0'],
  cancelado:      ['Cancelado', '#E8554E'],
};

function TarjetaPedido({ pedido, onCobrar, apagada }) {
  const [texto, color] = ESTADO_PEDIDO[pedido.estado] || [pedido.estado, '#8A90A0'];
  const debe = pedido.total - pedido.monto_pagado;
  const cancelado = pedido.estado === 'cancelado';
  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-3 rounded-xl"
      style={{ background: '#20232B', border: '1px solid #2D313B', opacity: apagada ? 0.7 : 1 }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-extrabold">{pedido.numero_orden}</span>
          {pedido.tipo === 'mostrador' && (
            <span className="px-2 py-0.5 rounded-md text-xs font-extrabold" style={{ background: '#2D313B', color: '#9EE3C4' }}>PARA LLEVAR</span>
          )}
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-sm font-bold" style={etiquetaEstilo(color)}>{texto}</span>
      </div>
      <span className="text-[15px]" style={{ color: '#C9CDD6' }}>
        {(pedido.items || []).map((i) => `${i.cantidad}× ${i.nombre_display}`).join(', ')}
      </span>
      <div className="flex justify-between text-[15px]">
        <span style={{ color: '#A4A9B6' }}>Total {fmt(pedido.total)}</span>
        {!cancelado && (
          <span className="font-bold" style={{ color: debe <= 0 ? '#4FB38A' : '#F2B33D' }}>
            {debe <= 0 ? 'Pagado' : pedido.monto_pagado > 0 ? `Abonó ${fmt(pedido.monto_pagado)} · debe ${fmt(debe)}` : 'Sin pagar'}
          </span>
        )}
      </div>
      {onCobrar && debe > 0 && !cancelado && (
        <button onClick={onCobrar} className="h-11 mt-1 rounded-[10px] font-extrabold" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
          Cobrar {fmt(debe)}
        </button>
      )}
    </div>
  );
}

export default function PanelDetalleMesa({ mesaId, estado, puedeEditar, onCerrar, onCambio, onUnir }) {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { avisar, confirmar } = useDialogos();

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    getPedidosDeMesa(mesaId)
      .then((d) => { setDatos(d); setError(null); })
      .catch((err) => setError(err.message));
  }, [mesaId]);

  useEffect(() => {
    cargar();
    socket.on('pedido_actualizado', cargar);
    socket.on('nuevo_pedido', cargar);
    return () => {
      socket.off('pedido_actualizado', cargar);
      socket.off('nuevo_pedido', cargar);
    };
  }, [cargar]);

  const irAPos = (pedido, modo, paraLlevar = false) => {
    if (!datos) return;
    navigate('/pos', {
      state: {
        mesaId: datos.mesa.id,
        mesaNumero: datos.mesa.numero,
        mesaNombre: datos.mesa.nombre,
        grupoNombre: datos.grupo?.nombre || null,
        pedido: pedido || undefined,
        modo: pedido ? modo : undefined,
        paraLlevar,
      },
    });
  };

  const accionAdmin = async (opciones, accion) => {
    if (!(await confirmar(opciones))) return;
    try {
      await accion();
      onCambio?.();
    } catch (err) {
      avisar(err.message);
    }
  };

  const pedidos = datos?.pedidos || [];
  // `activo` lo calcula el backend con la misma regla que el estado de la mesa.
  const activos = pedidos.filter((p) => p.activo);
  const pendienteMesa = activos.find((p) => p.estado === 'pendiente' && p.tipo !== 'mostrador');
  const porCobrar = activos.filter((p) => p.total - p.monto_pagado > 0);
  const saldo = porCobrar.reduce((a, p) => a + p.total - p.monto_pagado, 0);
  const hoy = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD local, igual que created_at
  const terminadosHoy = pedidos.filter((p) => !p.activo && p.created_at.startsWith(hoy));
  const e = ESTADO_MESA[estado] || ESTADO_MESA.libre;
  const libre = activos.length === 0;

  const titulo = datos ? `Mesa ${datos.grupo ? (datos.grupo.nombre || 'unida') : datos.mesa.numero}` : 'Mesa';

  return (
    <aside aria-label="Detalle de la mesa" className="flex flex-col gap-4 p-5"
      style={{ flex: '1 1 380px', maxWidth: 440, background: '#1A1C22', borderLeft: '1px solid #2D313B' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[26px] font-extrabold">
            {titulo}
            {datos?.mesa?.nombre && <span className="text-base font-semibold" style={{ color: '#A4A9B6' }}> · {datos.mesa.nombre}</span>}
          </h2>
          <span className="self-start px-2.5 py-0.5 rounded-full text-sm font-bold" style={etiquetaEstilo(e.c)}>{e.t}</span>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar detalle"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-[10px]" style={{ border: '1px solid #2D313B' }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {error && <p role="alert" className="m-0 text-sm" style={{ color: '#FFB4AE' }}>{error}</p>}

      {saldo > 0 && (
        <>
          <div className="flex flex-col gap-1 p-3.5 rounded-[14px]" style={{ background: '#20232B', border: '1px solid #2D313B' }}>
            <span className="text-sm" style={{ color: '#A4A9B6' }}>Por cobrar</span>
            <span className="text-[32px] font-extrabold tabular-nums">{fmt(saldo)}</span>
          </div>
          {porCobrar.length === 1 && (
            <button onClick={() => irAPos(porCobrar[0], 'cobrar')} className="h-14 rounded-[14px] text-lg font-extrabold"
              style={{ background: 'var(--accent)', color: '#1A0E05' }}>
              Cobrar {fmt(saldo)}
            </button>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => (pendienteMesa ? irAPos(pendienteMesa, 'editar') : irAPos(null))}
          className="h-14 rounded-[14px] text-[17px] font-extrabold"
          style={libre ? { background: 'var(--accent)', color: '#1A0E05' } : { border: '1px solid #3A3F4C' }}>
          {libre ? 'Tomar pedido' : pendienteMesa ? `Editar ${pendienteMesa.numero_orden}` : 'Agregar pedido'}
        </button>
        <button onClick={() => irAPos(null, undefined, true)} className="h-14 rounded-[14px] text-base font-extrabold" style={{ border: '1px solid #3A3F4C' }}>
          Pedido para llevar
        </button>
      </div>
      <p className="-mt-1.5 mb-0 text-[13px]" style={{ color: '#8A90A0' }}>
        "Para llevar" queda en una cuenta aparte, pero se muestra en esta mesa para saber dónde espera el cliente.
      </p>

      {activos.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <h3 className="m-0 text-sm font-bold" style={{ color: '#A4A9B6' }}>Pedidos en curso</h3>
          {activos.map((p) => (
            <TarjetaPedido key={p.id} pedido={p} onCobrar={porCobrar.length > 1 ? () => irAPos(p, 'cobrar') : null} />
          ))}
        </div>
      ) : datos && (
        <p className="m-0 p-5 text-center rounded-[14px]" style={{ color: '#6B7080', border: '1px dashed #2D313B' }}>
          La mesa está libre. Toca "Tomar pedido" cuando lleguen clientes.
        </p>
      )}

      {terminadosHoy.length > 0 && (
        <details>
          <summary className="min-h-11 flex items-center cursor-pointer text-sm font-semibold" style={{ color: '#A4A9B6' }}>
            Terminados hoy ({terminadosHoy.length})
          </summary>
          <div className="flex flex-col gap-2 pt-2">
            {terminadosHoy.map((p) => <TarjetaPedido key={p.id} pedido={p} apagada />)}
          </div>
        </details>
      )}

      <div className="flex-1" />

      {puedeEditar && datos && (
        <details className="pt-3" style={{ borderTop: '1px solid #2D313B' }}>
          <summary className="min-h-11 flex items-center cursor-pointer text-sm font-semibold" style={{ color: '#A4A9B6' }}>
            Opciones del administrador
          </summary>
          <div className="flex flex-col gap-2 pt-2">
            {datos.grupo ? (
              <button className="h-11 rounded-[10px] text-sm font-semibold" style={{ border: '1px solid #3A3F4C', color: '#C9CDD6' }}
                onClick={() => accionAdmin(
                  { titulo: 'Separar mesas', mensaje: 'El pedido compartido se queda en la mesa principal y las demás quedan libres, sin ese historial.', aceptar: 'Separar' },
                  async () => { await separarMesas(datos.grupo.id, usuario.id); onCerrar(); },
                )}>
                Separar mesas unidas
              </button>
            ) : (
              <button onClick={onUnir} className="h-11 rounded-[10px] text-sm font-semibold" style={{ border: '1px solid #3A3F4C', color: '#C9CDD6' }}>
                Unir con otra mesa
              </button>
            )}
            <button className="h-11 rounded-[10px] text-sm font-semibold" style={{ border: '1px solid #7A2F2F', color: '#F08A84' }}
              onClick={() => accionAdmin(
                { titulo: 'Dejar mesa libre', mensaje: 'La mesa quedará libre aunque tenga pedidos activos. Úsalo solo si quedó trabada.', aceptar: 'Dejar libre', peligro: true },
                async () => { await liberarMesa(mesaId, usuario.id); cargar(); },
              )}>
              Dejar libre aunque tenga pedidos (si quedó trabada)
            </button>
            <button className="h-11 rounded-[10px] text-sm font-semibold" style={{ border: '1px solid #7A2F2F', color: '#F08A84' }}
              onClick={() => accionAdmin(
                { titulo: `Eliminar mesa ${datos.mesa.numero}`, mensaje: 'La mesa desaparecerá del salón.', aceptar: 'Eliminar', peligro: true },
                async () => { await eliminarMesa(mesaId, usuario.id); onCerrar(); },
              )}>
              Eliminar mesa
            </button>
          </div>
        </details>
      )}
    </aside>
  );
}
