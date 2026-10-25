// src/components/ModalVariantes.jsx
import { useState, useMemo, useEffect } from 'react';
import { menuPizzeria } from '../data/menu';
import { formatCOP, tonoProducto, segundaMitadValida } from '../lib/venta';

/**
 * Selector de tamaño para productos con variantes, en una sola vista.
 * Para pizzas permite elegir entera o "Mitad y mitad".
 */

// Mapa de porción → descripción coloquial para el subtítulo
const PORCIONES_DESC = {
  '3p': '3 porciones — ideal para 1',
  '4p': '4 porciones — ideal para 1–2',
  '6p': '6 porciones — ideal para 2–3',
  '8p': '8 porciones — para 3–4',
  '12p': '12 porciones — para 4–6',
};

const nombreCorto = (p) => p.nombre.replace('Pizza ', '');

// Vista previa: pizza entera o partida en dos semicírculos
function VistaPrevia({ producto, segunda, esMitad }) {
  const r = 70;
  const c = 80;
  const label = esMitad
    ? `Vista previa: mitad ${nombreCorto(producto)} y ${
        segunda ? `mitad ${nombreCorto(segunda)}` : 'otra mitad sin elegir'
      }`
    : `Vista previa: ${producto.nombre} entera`;
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={label}>
      {!esMitad ? (
        <circle cx={c} cy={c} r={r} fill={tonoProducto(producto.id)} stroke="var(--border-2)" strokeWidth="2" />
      ) : (
        <>
          <path
            d={`M ${c} ${c - r} A ${r} ${r} 0 0 0 ${c} ${c + r} Z`}
            fill={tonoProducto(producto.id)}
          />
          <path
            d={`M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} Z`}
            fill={segunda ? tonoProducto(segunda.id) : 'transparent'}
            stroke={segunda ? 'none' : 'var(--text-3)'}
            strokeWidth="2"
            strokeDasharray={segunda ? undefined : '6 5'}
          />
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-2)" strokeWidth="2" />
          <line x1={c} y1={c - r} x2={c} y2={c + r} stroke="var(--border-2)" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

function ModalVariantesInterno({ producto, onSeleccionar, onCerrar }) {
  const esPizza = producto.categoria === 'Pizzas';
  const [tamano, setTamano] = useState(() => {
    const v = producto.variantes.find((x) => x.nombreTamanio.includes('Mediana')) || producto.variantes[0];
    return v?.nombreTamanio ?? null;
  });
  const [esMitad, setEsMitad] = useState(false);
  const [segunda, setSegunda] = useState(null);

  // Esc cierra el modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const varianteElegida = producto.variantes.find((v) => v.nombreTamanio === tamano) ?? null;

  // Lista de otras pizzas en el menú
  const otrasPizzas = useMemo(
    () => menuPizzeria.filter((p) => p.categoria === 'Pizzas' && p.id !== producto.id),
    [producto]
  );

  // Opciones disponibles para la segunda mitad (según el tamaño elegido)
  const opcionesSegundaMitad = useMemo(() => {
    if (!varianteElegida) return [];
    return otrasPizzas
      .map((otraPizza) => {
        const varianteOtra = otraPizza.variantes.find((v) => v.nombreTamanio === varianteElegida.nombreTamanio);
        if (!varianteOtra) return null;
        // Regla de negocio: promedio + $2.000
        const precioFinal = Math.round((varianteElegida.precio + varianteOtra.precio) / 2) + 2000;
        return { pizza: otraPizza, varianteOtra, precioFinal };
      })
      .filter(Boolean);
  }, [varianteElegida, otrasPizzas]);

  const cambiarTamano = (v) => {
    setTamano(v.nombreTamanio);
    // Si la segunda mitad no existe en el nuevo tamaño, se descarta
    if (!segundaMitadValida(segunda, v.nombreTamanio, menuPizzeria)) setSegunda(null);
  };

  const opcionSegunda = esMitad && segunda ? opcionesSegundaMitad.find((o) => o.pizza.id === segunda.id) : null;
  const precio = esMitad ? opcionSegunda?.precioFinal ?? varianteElegida?.precio ?? 0 : varianteElegida?.precio ?? 0;
  const falta = esMitad && !opcionSegunda;

  const agregar = () => {
    if (!varianteElegida || falta) return;
    if (!esMitad) {
      onSeleccionar(producto, varianteElegida);
      return;
    }
    const nombreTamanioSolo = varianteElegida.nombreTamanio.split(' ·')[0];
    onSeleccionar(producto, {
      // Un ID único que previene colisiones en el carrito
      idVariante: `mm_${producto.id}_${opcionSegunda.pizza.id}_${varianteElegida.idVariante}`,
      nombreCustom: `Mitad ${nombreCorto(producto)} / Mitad ${nombreCorto(opcionSegunda.pizza)} · ${nombreTamanioSolo}`,
      precio: opcionSegunda.precioFinal,
    });
  };

  const focoCls = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]';
  const tituloSeccion = 'text-[11px] font-bold uppercase tracking-widest px-1 pb-2';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={`Seleccionar tamaño de ${producto.nombre}`}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--bg-surf4)', border: '1px solid var(--border-1)', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>
              {producto.nombre}
            </h3>
            {producto.desc && (
              <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{producto.desc}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar selector de tamaños"
            className={`w-11 h-11 flex items-center justify-center rounded-lg shrink-0 ${focoCls}`}
            style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {esPizza && (
            <div className="flex flex-col items-center mb-4">
              <VistaPrevia producto={producto} segunda={segunda} esMitad={esMitad} />
              <p className="mt-2 text-sm font-bold text-center" style={{ color: 'var(--text-1)' }}>
                {esMitad
                  ? `Mitad ${nombreCorto(producto)} / ${segunda ? `Mitad ${nombreCorto(segunda)}` : 'Mitad por elegir'}`
                  : producto.nombre}
              </p>
            </div>
          )}

          {/* 1 · Tamaño */}
          <p className={tituloSeccion} style={{ color: 'var(--text-3)' }}>1 · Tamaño</p>
          <div className="flex flex-col gap-2 mb-4" role="radiogroup" aria-label="Tamaño">
            {producto.variantes.map((variante) => {
              const porciones = variante.nombreTamanio.split('·')[1]?.trim();
              const activo = variante.nombreTamanio === tamano;
              return (
                <button
                  key={variante.idVariante}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => cambiarTamano(variante)}
                  className={`flex items-center justify-between gap-3 px-4 py-2 min-h-[44px] rounded-xl text-left ${focoCls}`}
                  style={{
                    background: activo ? 'var(--accent)' : 'var(--bg-surf6)',
                    border: `1px solid ${activo ? 'var(--accent)' : 'var(--border-1)'}`,
                    color: activo ? 'var(--on-accent)' : 'var(--text-1)',
                  }}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{variante.nombreTamanio.split(' ·')[0]}</span>
                    {porciones && PORCIONES_DESC[porciones] && (
                      <span className="block text-[11px] mt-0.5" style={{ color: activo ? 'var(--on-accent)' : 'var(--text-3)' }}>
                        {PORCIONES_DESC[porciones]}
                      </span>
                    )}
                  </span>
                  <span className="text-base font-extrabold shrink-0">{formatCOP(variante.precio)}</span>
                </button>
              );
            })}
          </div>

          {/* 2 · Sabor (solo pizzas) */}
          {esPizza && (
            <>
              <p className={tituloSeccion} style={{ color: 'var(--text-3)' }}>2 · Sabor</p>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-3" role="radiogroup" aria-label="Sabor"
                   style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-1)' }}>
                {[['Entera', false], ['Mitad y mitad', true]].map(([texto, valor]) => {
                  const activo = esMitad === valor;
                  return (
                    <button
                      key={texto}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setEsMitad(valor)}
                      className={`min-h-[44px] rounded-lg text-sm font-bold ${focoCls}`}
                      style={{
                        background: activo ? 'var(--accent)' : 'transparent',
                        color: activo ? 'var(--on-accent)' : 'var(--text-1)',
                      }}
                    >
                      {texto}
                    </button>
                  );
                })}
              </div>

              {esMitad && (
                <>
                  <p className="text-sm mb-2" style={{ color: 'var(--text-3)' }}>Elige el sabor de la otra mitad</p>
                  {opcionesSegundaMitad.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-3)' }}>
                      No hay otros sabores disponibles en este tamaño.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {opcionesSegundaMitad.map(({ pizza, precioFinal }) => {
                        const activo = segunda?.id === pizza.id;
                        return (
                          <button
                            key={pizza.id}
                            type="button"
                            aria-pressed={activo}
                            onClick={() => setSegunda(pizza)}
                            className={`flex flex-col items-start justify-center px-3 py-2 min-h-[44px] rounded-xl text-left ${focoCls}`}
                            style={{
                              background: activo ? 'var(--accent)' : 'var(--bg-surf6)',
                              border: `1px solid ${activo ? 'var(--accent)' : 'var(--border-1)'}`,
                              color: activo ? 'var(--on-accent)' : 'var(--text-1)',
                            }}
                          >
                            <span className="text-sm font-bold leading-tight">{nombreCorto(pizza)}</span>
                            <span className="text-[11px] mt-0.5" style={{ color: activo ? 'var(--on-accent)' : 'var(--text-3)' }}>
                              {formatCOP(precioFinal)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Pie */}
        <div className="shrink-0 px-5 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-1)' }}>
          {falta && (
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>Elige la otra mitad</p>
          )}
          <button
            type="button"
            onClick={agregar}
            disabled={falta || !varianteElegida}
            className={`w-full min-h-[48px] rounded-xl text-base font-extrabold disabled:opacity-50 disabled:cursor-not-allowed ${focoCls}`}
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Agregar · {formatCOP(precio)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ModalVariantes({ producto, onSeleccionar, onCerrar }) {
  if (!producto) return null;
  // La key reinicia el estado interno al cambiar de producto
  return (
    <ModalVariantesInterno key={producto.id} producto={producto} onSeleccionar={onSeleccionar} onCerrar={onCerrar} />
  );
}
