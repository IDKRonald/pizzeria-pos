// backend/db/migrate.js
// Migraciones ligeras para bases de datos ya existentes.
// schema.sql usa CREATE TABLE IF NOT EXISTS — no altera tablas que ya existen,
// así que las columnas nuevas sobre tablas viejas se agregan aquí a mano.

// Debe ejecutarse ANTES de aplicar schema.sql: schema.sql crea el índice sobre
// mesas.grupo_id en la misma pasada, así que en una BD vieja (donde `mesas` ya
// existe sin esa columna) el índice fallaría si la columna no está agregada todavía.
function tablaExiste(db, nombre) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(nombre);
}

/**
 * pedidos.metodo_pago solo aceptaba ('efectivo','transferencia','mixto') pero el
 * selector de pago del carrito también ofrece tarjeta_debito/tarjeta_credito —
 * cualquier cobro con esas opciones fallaría por violar el CHECK. SQLite no
 * permite ALTER TABLE para ampliar un CHECK, así que hay que reconstruir la
 * tabla completa: crear una nueva con la regla correcta, copiar los datos,
 * borrar la vieja y renombrar. detalle_pedido/pagos/movimientos_inventario
 * referencian pedidos.id, por eso se apagan las foreign keys mientras se hace
 * el swap (PRAGMA no tiene efecto dentro de una transacción, por eso va afuera).
 */
function migrarMetodoPagoCheck(db) {
  if (!tablaExiste(db, 'pedidos')) return; // BD nueva — schema.sql ya trae la regla correcta

  const { sql } = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pedidos'`).get();
  if (sql.includes('tarjeta_debito')) return; // ya migrada

  // Detectar si costo_domicilio ya existe en la tabla vieja
  const colsPedidos = db.prepare(`PRAGMA table_info(pedidos)`).all().map((c) => c.name);
  const tieneCostoDomicilio = colsPedidos.includes('costo_domicilio');
  const tieneMontoPagado   = colsPedidos.includes('monto_pagado');

  console.log('🔧 Migración: ampliando pedidos.metodo_pago (agregando tarjeta_debito/tarjeta_credito)...');
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE pedidos_new (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          numero_orden  TEXT    NOT NULL UNIQUE,
          mesa_id       INTEGER,
          usuario_id    INTEGER NOT NULL,
          estado        TEXT    NOT NULL DEFAULT 'pendiente'
                        CHECK(estado IN ('pendiente','en_preparacion','listo','entregado','pagado','cancelado')),
          tipo          TEXT    NOT NULL DEFAULT 'mesa'
                        CHECK(tipo IN ('mesa','mostrador','domicilio')),
          subtotal      INTEGER NOT NULL DEFAULT 0,
          impuestos     INTEGER NOT NULL DEFAULT 0,
          total         INTEGER NOT NULL DEFAULT 0,
          propina       INTEGER NOT NULL DEFAULT 0,
          costo_domicilio INTEGER NOT NULL DEFAULT 0,
          monto_pagado  INTEGER NOT NULL DEFAULT 0,
          metodo_pago   TEXT    DEFAULT 'efectivo'
                        CHECK(metodo_pago IN ('efectivo','transferencia','tarjeta_debito','tarjeta_credito','mixto')),
          notas         TEXT,
          created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
          updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (mesa_id)    REFERENCES mesas(id),
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
      `);

      // Construir SELECT dinámicamente para columnas que pueden no existir en la BD vieja
      const costoExpr  = tieneCostoDomicilio ? 'costo_domicilio' : '0';
      const pagadoExpr = tieneMontoPagado    ? 'monto_pagado'    : '0';
      db.exec(`
        INSERT INTO pedidos_new (id, numero_orden, mesa_id, usuario_id, estado, tipo, subtotal, impuestos, total, propina, costo_domicilio, monto_pagado, metodo_pago, notas, created_at, updated_at)
        SELECT id, numero_orden, mesa_id, usuario_id, estado, tipo, subtotal, impuestos, total, propina, ${costoExpr}, ${pagadoExpr}, metodo_pago, notas, created_at, updated_at
        FROM pedidos
      `);
      db.exec(`DROP TABLE pedidos`);
      db.exec(`ALTER TABLE pedidos_new RENAME TO pedidos`);
      db.exec(`UPDATE sqlite_sequence SET name = 'pedidos' WHERE name = 'pedidos_new'`);

      const huerfanos = db.pragma('foreign_key_check');
      if (huerfanos.length > 0) {
        throw new Error(`Migración de pedidos dejó referencias huérfanas: ${JSON.stringify(huerfanos)}`);
      }
    })();
    console.log('✅ Migración: pedidos.metodo_pago ampliada correctamente');
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

export function runMigrations(db) {
  migrarMetodoPagoCheck(db);

  if (tablaExiste(db, 'mesas')) {
    const cols = db.prepare(`PRAGMA table_info(mesas)`).all().map((c) => c.name);
    if (!cols.includes('grupo_id')) {
      db.exec(`ALTER TABLE mesas ADD COLUMN grupo_id INTEGER REFERENCES mesa_grupos(id)`);
      console.log('🔧 Migración: mesas.grupo_id agregada');
    }
  }

  if (tablaExiste(db, 'insumos')) {
    const cols = db.prepare(`PRAGMA table_info(insumos)`).all().map((c) => c.name);
    if (!cols.includes('modo_descuento')) {
      db.exec(`ALTER TABLE insumos ADD COLUMN modo_descuento TEXT NOT NULL DEFAULT 'manual'`);
      console.log('🔧 Migración: insumos.modo_descuento agregada');
    }
    if (!cols.includes('proveedor_id')) {
      db.exec(`ALTER TABLE insumos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id)`);
      console.log('🔧 Migración: insumos.proveedor_id agregada');
    }
  }

  if (tablaExiste(db, 'recetas')) {
    const cols = db.prepare(`PRAGMA table_info(recetas)`).all().map((c) => c.name);
    if (!cols.includes('variante_id')) {
      db.exec(`ALTER TABLE recetas ADD COLUMN variante_id INTEGER REFERENCES producto_variantes(id)`);
      console.log('🔧 Migración: recetas.variante_id agregada');
    }
  }

  if (tablaExiste(db, 'detalle_pedido')) {
    const cols = db.prepare(`PRAGMA table_info(detalle_pedido)`).all().map((c) => c.name);
    if (!cols.includes('combo_padre_id')) {
      db.exec(`ALTER TABLE detalle_pedido ADD COLUMN combo_padre_id INTEGER REFERENCES detalle_pedido(id)`);
      console.log('🔧 Migración: detalle_pedido.combo_padre_id agregada');
    }
  }

  if (tablaExiste(db, 'cierres_caja')) {
    const cols = db.prepare(`PRAGMA table_info(cierres_caja)`).all().map((c) => c.name);
    if (!cols.includes('total_tarjeta_debito')) {
      db.exec(`ALTER TABLE cierres_caja ADD COLUMN total_tarjeta_debito INTEGER NOT NULL DEFAULT 0`);
      console.log('🔧 Migración: cierres_caja.total_tarjeta_debito agregada');
    }
    if (!cols.includes('total_tarjeta_credito')) {
      db.exec(`ALTER TABLE cierres_caja ADD COLUMN total_tarjeta_credito INTEGER NOT NULL DEFAULT 0`);
      console.log('🔧 Migración: cierres_caja.total_tarjeta_credito agregada');
    }
    if (!cols.includes('diferencia')) {
      db.exec(`ALTER TABLE cierres_caja ADD COLUMN diferencia INTEGER`);
      console.log('🔧 Migración: cierres_caja.diferencia agregada');
    }
  }
}
