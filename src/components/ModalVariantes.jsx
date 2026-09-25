// src/components/ModalVariantes.jsx
import { useState, useMemo, useEffect } from 'react';
import { menuPizzeria } from '../data/menu';

/**
 * Modal de selección de tamaño para productos con variantes.
 * Soporta modo normal y modo "Mitad y Mitad" con Progressive Disclosure.
 */
const formatCOP = (valor) =>
  valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

// Mapa de porción → descripción coloquial para el subtítulo
const PORCIONES_DESC = {
  '3p': '3 porciones — ideal para 1',
  '4p': '4 porciones — ideal para 1–2',
  '6p': '6 porciones — ideal para 2–3',
  '8p': '8 porciones — para 3–4',
  '12p': '12 porciones — para 4–6',
};

export default function ModalVariantes({ producto, onSeleccionar, onCerrar }) {
  // Estado del Wizard
  const [isMitad, setIsMitad] = useState(false);
  const [selectedSize, setSelectedSize] = useState(null);

  // Reiniciar estado si cambia el producto
  useEffect(() => {
    setIsMitad(false);
    setSelectedSize(null);
  }, [producto]);

  // Lista de otras pizzas en el menú
  const otrasPizzas = useMemo(() => {
    return menuPizzeria.filter((p) => p.categoria === 'Pizzas' && p.id !== producto?.id);
  }, [producto]);

  // Opciones disponibles para la segunda mitad (basado en el tamaño elegido)
  const opcionesSegundaMitad = useMemo(() => {
    if (!selectedSize) return [];
    return otrasPizzas
      .map((otraPizza) => {
        // Buscar si la otra pizza viene en este mismo tamaño
        const varianteOtra = otraPizza.variantes.find(
          (v) => v.nombreTamanio === selectedSize.nombreTamanio
        );
        if (!varianteOtra) return null;

        // Regla de Negocio: Promedio + $2.000
        const precioMitadMitad =
          Math.round((selectedSize.precio + varianteOtra.precio) / 2) + 2000;

        return {
          pizza: otraPizza,
          varianteOtra,
          precioFinal: precioMitadMitad,
        };
      })
      .filter(Boolean); // Remover nulos
  }, [selectedSize, otrasPizzas]);

  if (!producto) return null;

  const handleConfirmarMitad = (otraPizza, precioFinal) => {
    // Formatear el nombre limpio omitiendo la palabra "Pizza" repetida
    const nombreProd1 = producto.nombre.replace('Pizza ', '');
    const nombreProd2 = otraPizza.nombre.replace('Pizza ', '');
    const nombreTamanioSolo = selectedSize.nombreTamanio.split(' ·')[0];

    const customVariante = {
      // Un ID único que previene colisiones en el carrito
      idVariante: `mm_${producto.id}_${otraPizza.id}_${selectedSize.idVariante}`,
      nombreCustom: `Mitad ${nombreProd1} / Mitad ${nombreProd2} · ${nombreTamanioSolo}`,
      precio: precioFinal,
    };
    onSeleccionar(producto, customVariante);
  };

  return (
    /* ── Overlay ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Seleccionar tamaño de ${producto.nombre}`}
    >
      {/* ── Tarjeta del modal ── */}
      <div
        className="w-full max-w-sm flex flex-col rounded-2xl shadow-2xl overflow-hidden
                   animate-[fadeScaleIn_0.18s_ease-out]"
        style={{
          background: 'var(--bg-surf4)',
          border: '1px solid var(--border-1)',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header del modal */}
        <div
          className="flex items-start gap-4 px-5 pt-5 pb-4 shrink-0 transition-colors"
          style={{
            borderBottom: '1px solid var(--border-1)',
            background: isMitad ? 'rgba(249,115,22,0.05)' : 'transparent',
          }}
        >
          <span className="text-5xl select-none leading-none">
            {isMitad ? '🌗' : producto.imagen}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold leading-tight transition-all" style={{ color: 'var(--text-1)' }}>
              {isMitad ? `Mitad ${producto.nombre.replace('Pizza ', '')}` : producto.nombre}
            </h3>
            <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
              {isMitad
                ? selectedSize
                  ? 'Paso 2: Elige la segunda mitad'
                  : 'Paso 1: ¿De qué tamaño?'
                : producto.desc}
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar selector de tamaños"
            className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0
                       text-sm font-bold transition-colors duration-150 hover:opacity-70"
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}
          >
            ✕
          </button>
        </div>

        {/* ========================================================
            ESTADO NORMAL: Selección de tamaño de pizza completa
            ======================================================== */}
        {!isMitad && (
          <div className="flex-1 overflow-y-auto">
            <p className="px-5 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-var-text-4">
              Elige el tamaño
            </p>
            <div className="px-4 pb-4 flex flex-col gap-2">
              {producto.variantes.map((variante) => {
                const porciones = variante.nombreTamanio.split('·')[1]?.trim();
                return (
                  <button
                    key={variante.idVariante}
                    onClick={() => onSeleccionar(producto, variante)}
                    className="group flex items-center justify-between px-4 py-3 rounded-xl
                               transition-all duration-150 text-left active:scale-[0.98]"
                    style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-1)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)';
                      e.currentTarget.style.background = 'rgba(249,115,22,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-1)';
                      e.currentTarget.style.background = 'var(--bg-surf6)';
                    }}
                  >
                    <div>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                        {variante.nombreTamanio.split(' ·')[0]}
                      </p>
                      {porciones && PORCIONES_DESC[porciones] && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>
                          {PORCIONES_DESC[porciones]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-base font-extrabold text-orange-400">
                        {formatCOP(variante.precio)}
                      </span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline"
                        style={{ background: 'rgba(249,115,22,0.15)', color: 'rgb(249,115,22)' }}
                      >
                        Agregar
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Divisor "O" */}
            <div className="flex items-center gap-2 px-5 pb-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border-1)' }}></div>
              <span className="text-[10px] font-bold uppercase text-var-text-4">Ó</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-1)' }}></div>
            </div>

            {/* Action Mitad y Mitad */}
            <div className="px-4 pb-5">
              <button
                onClick={() => setIsMitad(true)}
                className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2
                           transition-transform active:scale-[0.98]"
                style={{
                  background: 'var(--bg-surf6)',
                  border: '1px dashed var(--border-3)',
                  color: 'var(--text-1)',
                }}
              >
                🌗 Preparar Mitad y Mitad
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            ESTADO MITAD Y MITAD - PASO 1: Selección de tamaño
            ======================================================== */}
        {isMitad && !selectedSize && (
          <div className="flex-1 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
            <div className="px-5 pt-3 pb-2 flex justify-between items-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-var-text-4">
                Paso 1 de 2
              </p>
              <button
                onClick={() => setIsMitad(false)}
                className="text-[11px] font-bold underline decoration-dotted underline-offset-4"
                style={{ color: 'var(--text-3)' }}
              >
                Cancelar
              </button>
            </div>
            <div className="px-4 pb-5 flex flex-col gap-2">
              {producto.variantes.map((variante) => {
                const porciones = variante.nombreTamanio.split('·')[1]?.trim();
                return (
                  <button
                    key={variante.idVariante}
                    onClick={() => setSelectedSize(variante)}
                    className="group flex flex-col items-center justify-center py-3 rounded-xl
                               transition-all duration-150 active:scale-[0.98]"
                    style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)' }}
                  >
                    <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>
                      {variante.nombreTamanio.split(' ·')[0]}
                    </p>
                    {porciones && PORCIONES_DESC[porciones] && (
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>
                        {PORCIONES_DESC[porciones]}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================
            ESTADO MITAD Y MITAD - PASO 2: Selección del otro sabor
            ======================================================== */}
        {isMitad && selectedSize && (
          <div className="flex flex-col overflow-hidden animate-[slidingRightIn_0.2s_ease-out]">
            <div className="px-5 pt-3 pb-2 flex justify-between items-center shrink-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-var-text-4">
                Tamaño: {selectedSize.nombreTamanio.split(' ·')[0]}
              </p>
              <button
                onClick={() => setSelectedSize(null)}
                className="text-[11px] font-bold flex items-center gap-1"
                style={{ color: 'var(--text-3)' }}
              >
                ← Cambiar tamaño
              </button>
            </div>

            {/* Listado de otras pizzas con Scrollbar bonito */}
            <div className="flex-1 overflow-y-auto px-4 pb-5 custom-scrollbar" style={{ maxHeight: '45vh' }}>
              <div className="flex flex-col gap-2">
                {opcionesSegundaMitad.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-4)' }}>
                    No hay otros sabores disponibles en este tamaño.
                  </p>
                ) : (
                  opcionesSegundaMitad.map(({ pizza, precioFinal }) => (
                    <button
                      key={pizza.id}
                      onClick={() => handleConfirmarMitad(pizza, precioFinal)}
                      className="group flex items-center justify-between px-4 py-3 rounded-xl
                                 transition-all duration-150 text-left active:scale-[0.98]"
                      style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-1)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)';
                        e.currentTarget.style.background = 'rgba(249,115,22,0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-1)';
                        e.currentTarget.style.background = 'var(--bg-surf6)';
                      }}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-1)' }}>
                          + Mitad {pizza.nombre.replace('Pizza ', '')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-extrabold text-orange-400 leading-none mb-1">
                          {formatCOP(precioFinal)}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
                          Total final
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
