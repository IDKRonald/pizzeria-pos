import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCOP, parseMonto, tipoOrden, aplicarTipoOrden, precioDesde, tonoProducto,
  billetesRapidos, calcularCambio, puedeConfirmarCobro, segundaMitadValida, debeEnfocarBusqueda,
} from './venta.js';

test('formatCOP da formato con símbolo de pesos', () => {
  assert.match(formatCOP(37000), /^\$\s?37\.000$/);
});

test('parseMonto', () => {
  assert.equal(parseMonto('$ 50.000'), 50000);
  assert.equal(parseMonto(''), 0);
  assert.equal(parseMonto('abc'), 0);
  assert.equal(parseMonto(12000), 12000);
});

test('tipoOrden', () => {
  assert.equal(tipoOrden({ esDomicilio: true, mesa: '3' }), 'domicilio');
  assert.equal(tipoOrden({ esDomicilio: false, mesa: '3' }), 'mesa');
  assert.equal(tipoOrden({ esDomicilio: false, mesa: '' }), 'llevar');
});

test('aplicarTipoOrden', () => {
  assert.deepEqual(aplicarTipoOrden('llevar'), { esDomicilio: false, limpiarMesa: true });
  assert.deepEqual(aplicarTipoOrden('domicilio'), { esDomicilio: true, limpiarMesa: true });
  assert.deepEqual(aplicarTipoOrden('mesa'), { esDomicilio: false, limpiarMesa: false });
});

test('precioDesde', () => {
  assert.equal(precioDesde({ variantes: [{ precio: 41000 }, { precio: 25000 }] }), 25000);
  assert.equal(precioDesde({ precio: 7000 }), 7000);
});

test('tonoProducto es estable y con formato hsl', () => {
  assert.equal(tonoProducto('donp'), tonoProducto('donp'));
  assert.match(tonoProducto('donp'), /^hsl\(\d+, 22%, 22%\)$/);
  assert.match(tonoProducto('donp', 'var(--tono-l)'), /^hsl\(\d+, 22%, var\(--tono-l\)\)$/);
});

test('billetesRapidos', () => {
  assert.deepEqual(billetesRapidos(37000), [37000, 40000, 50000, 100000]);
  assert.deepEqual(billetesRapidos(50000), [50000, 100000]);
  assert.deepEqual(billetesRapidos(120000), [120000, 150000]);
});

test('calcularCambio', () => {
  assert.equal(calcularCambio(50000, 37000), 13000);
  assert.equal(calcularCambio(20000, 37000), 0);
});

test('puedeConfirmarCobro', () => {
  const base = { tipoPago: 'efectivo', recibido: 37000, aPagar: 37000, isProcesando: false };
  assert.equal(puedeConfirmarCobro({ ...base, recibido: 30000 }), false);
  assert.equal(puedeConfirmarCobro(base), true);
  assert.equal(puedeConfirmarCobro({ ...base, tipoPago: 'transferencia', recibido: 0 }), true);
  assert.equal(puedeConfirmarCobro({ ...base, isProcesando: true }), false);
  assert.equal(puedeConfirmarCobro({ ...base, aPagar: 0 }), false);
});

test('segundaMitadValida', () => {
  const menu = [
    { id: 'a', categoria: 'Pizzas', variantes: [{ nombreTamanio: 'Mediana', precio: 1 }, { nombreTamanio: 'Grande', precio: 2 }] },
    { id: 'b', categoria: 'Pizzas', variantes: [{ nombreTamanio: 'Mediana', precio: 1 }] },
  ];
  assert.equal(segundaMitadValida(null, 'Grande', menu), false);
  assert.equal(segundaMitadValida(menu[0], 'Grande', menu), true);
  assert.equal(segundaMitadValida('a', 'Grande', menu), true);
  assert.equal(segundaMitadValida(menu[1], 'Grande', menu), false);
});

test('debeEnfocarBusqueda', () => {
  const ev = (key, tagName = 'BODY', isContentEditable = false) => ({ key, target: { tagName, isContentEditable } });
  assert.equal(debeEnfocarBusqueda(ev('/')), true);
  assert.equal(debeEnfocarBusqueda(ev('/', 'INPUT')), false);
  assert.equal(debeEnfocarBusqueda(ev('/', 'TEXTAREA')), false);
  assert.equal(debeEnfocarBusqueda(ev('/', 'DIV', true)), false);
  assert.equal(debeEnfocarBusqueda(ev('a')), false);
});
