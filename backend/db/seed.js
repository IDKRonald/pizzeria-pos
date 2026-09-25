// backend/db/seed.js
// Seed inicial: carga usuarios, categorías, productos, variantes y mesas.
// Ejecutar: node db/seed.js (desde carpeta backend)

import db from './connection.js';
import {
  PIZZA_TAMANHOS, PIZZA_TIPOS,
  ADICION_TAMANHOS, ADICION_TIPOS,
  PRODUCTOS_SIMPLES,
} from './menu-data.js';

// ── Datos fijos ──────────────────────────────────────────────
const USUARIOS = [
  { nombre: 'Administrador', pin: '0000', rol: 'admin' },
  { nombre: 'Cajero',        pin: '1234', rol: 'cajero' },
  { nombre: 'Mesero 1',      pin: '1111', rol: 'mesero' },
  { nombre: 'Cocina',        pin: '2222', rol: 'cocina' },
];

const CATEGORIAS = [
  { nombre: 'Pizzas',            emoji: '🍕', orden: 1 },
  { nombre: 'Carnes',            emoji: '🥩', orden: 2 },
  { nombre: 'Hamburguesas',      emoji: '🍔', orden: 3 },
  { nombre: 'Lasagna',           emoji: '🫕', orden: 4 },
  { nombre: 'Calzone',           emoji: '🥙', orden: 5 },
  { nombre: 'Porciones',         emoji: '🍟', orden: 6 },
  { nombre: 'Jugos',             emoji: '🧃', orden: 7 },
  { nombre: 'Bebidas Calientes', emoji: '☕', orden: 8 },
  { nombre: 'Cervezas',          emoji: '🍺', orden: 9 },
  { nombre: 'Gaseosas',          emoji: '🥤', orden: 10 },
  { nombre: 'Sodas',             emoji: '🫧', orden: 11 },
  { nombre: 'Licores',           emoji: '🍷', orden: 12 },
  { nombre: 'Aguas',             emoji: '💧', orden: 13 },
  { nombre: 'Té',                emoji: '🧋', orden: 14 },
  { nombre: 'Adiciones',         emoji: '➕', orden: 15 },
  { nombre: 'Otros',             emoji: '📦', orden: 16 },
];

// Layout visual de restaurante (~800x500 grid)
// Distribuidas con espacio real: ventana arriba, salón al centro, barra y terraza abajo
const MESAS = [
  { numero: 1, nombre: 'Ventana 1', x: 80,  y: 40,  capacidad: 2 },
  { numero: 2, nombre: 'Ventana 2', x: 280, y: 40,  capacidad: 4 },
  { numero: 3, nombre: 'Ventana 3', x: 520, y: 40,  capacidad: 4 },
  { numero: 4, nombre: 'Centro 1',  x: 160, y: 220, capacidad: 6 },
  { numero: 5, nombre: 'Centro 2',  x: 420, y: 220, capacidad: 6 },
  { numero: 6, nombre: 'Barra',     x: 80,  y: 400, capacidad: 2 },
  { numero: 7, nombre: 'Terraza 1', x: 420, y: 380, capacidad: 4 },
  { numero: 8, nombre: 'Terraza 2', x: 620, y: 380, capacidad: 4 },
];

// ── Ejecución ────────────────────────────────────────────────
function runSeed() {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  const seedAll = db.transaction(() => {
    // 1. Usuarios
    const insUser = db.prepare(`INSERT OR IGNORE INTO usuarios (nombre,pin,rol) VALUES (@nombre,@pin,@rol)`);
    for (const u of USUARIOS) insUser.run(u);
    console.log(`  👤 ${USUARIOS.length} usuarios`);

    // 2. Categorías
    const insCat = db.prepare(`INSERT OR IGNORE INTO categorias (nombre,emoji,orden) VALUES (@nombre,@emoji,@orden)`);
    for (const c of CATEGORIAS) insCat.run(c);
    console.log(`  📂 ${CATEGORIAS.length} categorías`);

    // Mapa categoría nombre→id
    const catMap = {};
    for (const r of db.prepare(`SELECT id, nombre FROM categorias`).all()) catMap[r.nombre] = r.id;

    const insProd = db.prepare(
      `INSERT INTO productos (nombre,descripcion,precio,categoria_id,imagen,tiene_variantes,precio_desde)
       VALUES (@nombre,@desc,@precio,@cat_id,@img,@variantes,@desde)`
    );
    const insVar = db.prepare(
      `INSERT INTO producto_variantes (producto_id,nombre_tamanio,precio) VALUES (@pid,@tam,@precio)`
    );

    // 3. Pizzas (con variantes)
    for (const t of PIZZA_TIPOS) {
      const validos = t.precios.filter(p => p !== null);
      const r = insProd.run({ nombre: `Pizza ${t.nombre}`, desc: t.desc, precio: null, cat_id: catMap['Pizzas'], img: '🍕', variantes: 1, desde: Math.min(...validos) });
      for (let i = 0; i < PIZZA_TAMANHOS.length; i++) {
        if (t.precios[i] === null) continue;
        insVar.run({ pid: r.lastInsertRowid, tam: `${PIZZA_TAMANHOS[i].label} · ${PIZZA_TAMANHOS[i].porciones}`, precio: t.precios[i] });
      }
    }
    console.log(`  🍕 ${PIZZA_TIPOS.length} pizzas con variantes`);

    // 4. Adiciones (con variantes)
    for (const t of ADICION_TIPOS) {
      const validos = t.precios.filter(p => p != null);
      const r = insProd.run({ nombre: `Adición de ${t.nombre}`, desc: 'Elige el tamaño', precio: null, cat_id: catMap['Adiciones'], img: '➕', variantes: 1, desde: Math.min(...validos) });
      for (let i = 0; i < ADICION_TAMANHOS.length; i++) {
        if (t.precios[i] == null) continue;
        insVar.run({ pid: r.lastInsertRowid, tam: `${ADICION_TAMANHOS[i].label} · ${ADICION_TAMANHOS[i].desc}`, precio: t.precios[i] });
      }
    }
    console.log(`  ➕ ${ADICION_TIPOS.length} adiciones con variantes`);

    // 5. Productos simples
    for (const p of PRODUCTOS_SIMPLES) {
      insProd.run({ nombre: p.nombre, desc: null, precio: p.precio, cat_id: catMap[p.cat], img: p.img, variantes: 0, desde: null });
    }
    console.log(`  🍽️  ${PRODUCTOS_SIMPLES.length} productos simples`);

    // 6. Mesas
    const insMesa = db.prepare(`INSERT OR IGNORE INTO mesas (numero,nombre,x,y,capacidad) VALUES (@numero,@nombre,@x,@y,@capacidad)`);
    for (const m of MESAS) insMesa.run(m);
    console.log(`  🪑 ${MESAS.length} mesas`);
  });

  seedAll();

  const tp = db.prepare(`SELECT COUNT(*) as c FROM productos`).get().c;
  const tv = db.prepare(`SELECT COUNT(*) as c FROM producto_variantes`).get().c;
  console.log(`\n✅ Seed completado — ${tp} productos, ${tv} variantes\n`);
}

// Solo ejecutar si la BD está vacía
const existing = db.prepare(`SELECT COUNT(*) as c FROM productos`).get().c;
if (existing === 0) {
  runSeed();
} else {
  console.log(`ℹ️  BD ya tiene ${existing} productos. Seed omitido.`);
}
