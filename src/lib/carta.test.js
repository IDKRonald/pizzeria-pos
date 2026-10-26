import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  programarEliminacion, tieneFoto, urlImagen, parsePrecio, formatoMiles, validarFoto, filtrarProductos,
  contarPorCategoria, normalizarOrden, intercambiarOrden, tamanosSugeridos,
} from './carta.js';

const prods = [
  { id: 1, nombre: 'Pizza Española', categoria_id: 1, imagen: '/uploads/a.jpg', tiene_variantes: 1,
    variantes: [{ id: 1, nombre_tamanio: 'Personal', precio: 1 }, { id: 2, nombre_tamanio: 'Grande', precio: 2 }] },
  { id: 2, nombre: 'Gaseosa', categoria_id: 2, imagen: '🥤', tiene_variantes: 0, variantes: [] },
  { id: 3, nombre: 'Pizza Hawaiana', categoria_id: 1, imagen: '', tiene_variantes: 1, variantes: [] },
];

test('tieneFoto y urlImagen', () => {
  assert.equal(tieneFoto('/uploads/a.jpg'), true);
  assert.equal(tieneFoto('http://x/y.png'), true);
  assert.equal(tieneFoto('🥤'), false);
  assert.equal(tieneFoto(''), false);
  assert.equal(urlImagen('/uploads/a.jpg', 'pos.local'), 'http://pos.local:3001/uploads/a.jpg');
  assert.equal(urlImagen('http://x/y.png', 'pos.local'), 'http://x/y.png');
});

test('parsePrecio', () => {
  assert.equal(parsePrecio('$ 12.000'), 12000);
  assert.equal(parsePrecio(5000), 5000);
  assert.equal(parsePrecio(''), null);
});

test('formatoMiles', () => {
  assert.equal(formatoMiles(12000), '12.000');
});

test('validarFoto', () => {
  assert.equal(validarFoto({ type: 'image/png', size: 6 * 1024 * 1024 }), 'La foto debe pesar menos de 5 MB');
  assert.equal(validarFoto({ type: 'application/pdf', size: 10 }), 'Elige un archivo de imagen');
  assert.equal(validarFoto({ type: 'image/png', size: 100 }), null);
});

test('filtrarProductos', () => {
  const f = (o) => filtrarProductos(prods, { categoriaId: null, texto: '', soloSinFoto: false, ...o }).map((p) => p.id);
  assert.deepEqual(f({ texto: 'espanola' }), [1]);
  assert.deepEqual(f({ categoriaId: 2 }), [2]);
  assert.deepEqual(f({ soloSinFoto: true }), [2, 3]);
});

test('contarPorCategoria', () => {
  assert.deepEqual(contarPorCategoria(prods), { 1: 2, 2: 1 });
});

test('normalizarOrden', () => {
  assert.deepEqual(
    normalizarOrden([{ id: 3, orden: 0 }, { id: 1, orden: 0 }, { id: 2, orden: 5 }]),
    [{ id: 1, orden: 1 }, { id: 3, orden: 2 }, { id: 2, orden: 3 }],
  );
  assert.deepEqual(normalizarOrden([{ id: 1, orden: 1 }, { id: 2, orden: 2 }]), []);
});

test('intercambiarOrden', () => {
  const cats = [{ id: 1, orden: 1 }, { id: 2, orden: 2 }];
  assert.equal(intercambiarOrden(cats, 0, -1), null);
  assert.equal(intercambiarOrden(cats, 1, 1), null);
  assert.deepEqual(intercambiarOrden(cats, 0, 1), [{ id: 1, orden: 2 }, { id: 2, orden: 1 }]);
});

test('tamanosSugeridos', () => {
  assert.deepEqual(tamanosSugeridos(prods, 1), ['Personal', 'Grande']);
  assert.deepEqual(tamanosSugeridos(prods, 2), []);
});

function relojFalso() {
  let cb = null; let borrado = false;
  return {
    setTimeoutFn: (f) => { cb = f; return 1; },
    clearTimeoutFn: () => { borrado = true; cb = null; },
    vencer: () => { if (cb && !borrado) cb(); },
  };
}

test('programarEliminacion ejecuta una vez al vencer', () => {
  const r = relojFalso(); let n = 0;
  programarEliminacion({ ejecutar: async () => { n++; }, ...r });
  r.vencer(); r.vencer();
  assert.equal(n, 1);
});

test('programarEliminacion: deshacer evita la llamada', () => {
  const r = relojFalso(); let n = 0;
  const p = programarEliminacion({ ejecutar: async () => { n++; }, ...r });
  p.deshacer(); r.vencer();
  assert.equal(n, 0);
});

test('programarEliminacion: cancelarSinEjecutar evita la llamada', () => {
  const r = relojFalso(); let n = 0;
  const p = programarEliminacion({ ejecutar: async () => { n++; }, ...r });
  p.cancelarSinEjecutar(); r.vencer();
  assert.equal(n, 0);
});
