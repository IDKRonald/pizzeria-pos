// src/components/TicketImpresion.jsx

/**
 * Componente de recibo de impresión.
 * Este componente es INVISIBLE en pantalla (display:none).
 * Solo se muestra cuando el usuario imprime la página via window.print().
 */
const ETIQUETAS_PAGO = {
  efectivo:        'Efectivo',
  transferencia:   'Transferencia / Nequi',
  tarjeta_debito:  'Tarjeta Débito',
  tarjeta_credito: 'Tarjeta Crédito',
};

export default function TicketImpresion({ cart, total, ordenNumero, fechaHora, tipoPago, esDomicilio, propina = 0, costoDomicilio = 0, mesa = '', montoEntregado = 0, isCopia = false, pagoActual = 0, montoPagadoHistorico = 0 }) {
  const formatCOP = (valor) =>
    valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

  if (!cart || cart.length === 0) return null;

  return (
    <div className="print-only ticket-wrapper">
      {/* ── Encabezado ── */}
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
        {isCopia && (
          <div style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>
            *** COPIA ***
          </div>
        )}
        <div style={{ fontSize: '13px', fontWeight: 'bold' }}>PIZZERÍA DON PEÑOLINNI</div>
        <div>CL. 50 #50-19, Guarne, Antioquia.</div>
        <div>Tel: 300 786 4753</div>
        <div>NIT: 1.041.327.248</div>
      </div>

      {/* ── Info de orden ── */}
      <div style={{ marginBottom: '6px' }}>
        <div><strong>Orden #:</strong> {ordenNumero}</div>
        <div><strong>Fecha:</strong> {fechaHora}</div>
        <div><strong>Tipo:</strong> {esDomicilio ? 'Domicilio' : 'Venta mostrador'}</div>
        {mesa && <div><strong>Mesa:</strong> {mesa}</div>}
        <div><strong>Pago:</strong> {ETIQUETAS_PAGO[tipoPago] || tipoPago}</div>
      </div>



      {/* ── Línea separadora ── */}
      <div style={{ borderTop: '1px dashed #000', marginBottom: '6px' }} />

      {/* ── Encabezado tabla ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
        <span style={{ flex: 3 }}>PRODUCTO</span>
        <span style={{ flex: 1, textAlign: 'center' }}>CANT</span>
        <span style={{ flex: 2, textAlign: 'right' }}>SUBTOTAL</span>
      </div>

      <div style={{ borderTop: '1px dashed #000', marginBottom: '6px' }} />

      {/* ── Items ── */}
      {cart.map((item) => (
        <div key={item.id} style={{ marginBottom: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ flex: 3, fontSize: '9px' }}>{item.nombre}</span>
            <span style={{ flex: 1, textAlign: 'center' }}>x{item.cantidad}</span>
            <span style={{ flex: 2, textAlign: 'right' }}>{formatCOP(item.precio * item.cantidad)}</span>
          </div>
          <div style={{ fontSize: '8px' }}>
            {formatCOP(item.precio)} c/u
          </div>
        </div>
      ))}

      {/* ── Totales ── */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Subtotal:</span>
          <span>{formatCOP(total - propina - costoDomicilio)}</span>
        </div>
        {propina > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Propina (10%):</span>
            <span>{formatCOP(propina)}</span>
          </div>
        )}
        {costoDomicilio > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Domicilio:</span>
            <span>{formatCOP(costoDomicilio)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px' }}>
          <span>TOTAL:</span>
          <span>{formatCOP(total)}</span>
        </div>
        
        {montoPagadoHistorico > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontStyle: 'italic' }}>
            <span>Abonos Anteriores:</span>
            <span>{formatCOP(montoPagadoHistorico)}</span>
          </div>
        )}

        {pagoActual > 0 && (pagoActual < (total - montoPagadoHistorico)) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontWeight: 'bold' }}>
            <span>Abono Actual:</span>
            <span>{formatCOP(pagoActual)}</span>
          </div>
        )}

        {(montoPagadoHistorico + pagoActual) < total && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '2px' }}>
            <span>Saldo Restante:</span>
            <span>{formatCOP(total - (montoPagadoHistorico + pagoActual))}</span>
          </div>
        )}
        
        {tipoPago === 'efectivo' && montoEntregado > 0 && (
          <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Efectivo Recibido:</span>
              <span>{formatCOP(montoEntregado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cambio:</span>
              <span>{formatCOP(Math.max(0, montoEntregado - (pagoActual > 0 ? pagoActual : total)))}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Pie de página ── */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '6px', textAlign: 'center', fontSize: '10px' }}>
        <div>¡Gracias por su compra!</div>
        <div>Vuelva pronto :)</div>
        <div style={{ marginTop: '4px' }}>Este documento no es una factura.</div>
      </div>
    </div>
  );
}
