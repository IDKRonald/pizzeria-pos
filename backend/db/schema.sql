-- ============================================================
-- Don Peñolinni POS — Esquema de Base de Datos
-- SQLite con WAL mode (activado en connection.js)
-- ============================================================

-- ─── Usuarios ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT    NOT NULL,
  pin         TEXT    NOT NULL,                          -- PIN de 4 dígitos para acceso rápido
  rol         TEXT    NOT NULL CHECK(rol IN ('admin','cajero','mesero','cocina')),
  activo      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ─── Categorías del menú ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT    NOT NULL UNIQUE,
  emoji  TEXT    NOT NULL DEFAULT '📦',
  orden  INTEGER NOT NULL DEFAULT 0                     -- Para ordenar en la UI
);

-- ─── Productos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT    NOT NULL,
  descripcion     TEXT,
  precio          INTEGER,                              -- NULL si tiene_variantes = 1
  categoria_id    INTEGER NOT NULL,
  imagen          TEXT    NOT NULL DEFAULT '🍽️',
  tiene_variantes INTEGER NOT NULL DEFAULT 0,           -- 1 = pizzas, adiciones (abre modal de tamaños)
  precio_desde    INTEGER,                              -- Precio mínimo para mostrar en tarjeta
  activo          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- ─── Variantes de producto (tamaños) ─────────────────────────
CREATE TABLE IF NOT EXISTS producto_variantes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id    INTEGER NOT NULL,
  nombre_tamanio TEXT    NOT NULL,                      -- Ej: "Personal · 4p"
  precio         INTEGER NOT NULL,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- ─── Proveedores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proveedores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre     TEXT    NOT NULL,
  telefono   TEXT,                                      -- cód. país + número, solo dígitos (para wa.me/<telefono>)
  created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ─── Insumos (Inventario) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS insumos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT    NOT NULL,
  unidad         TEXT    NOT NULL DEFAULT 'unidad',      -- unidad, kg, litro, gramo
  stock_actual   REAL    NOT NULL DEFAULT 0,
  stock_min      REAL    NOT NULL DEFAULT 0,             -- Alerta si stock_actual <= stock_min
  stock_max      REAL    NOT NULL DEFAULT 0,
  precio_compra  REAL    NOT NULL DEFAULT 0,             -- Costo unitario de compra
  modo_descuento TEXT    NOT NULL DEFAULT 'manual'
                 CHECK(modo_descuento IN ('automatico','manual')), -- automatico = se descuenta solo vía receta
  proveedor_id   INTEGER REFERENCES proveedores(id),
  activo         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ─── Recetas (producto/variante ↔ insumo) ─────────────────────
-- variante_id permite recetas específicas por tamaño (una Pizza Familiar
-- no gasta lo mismo que una Personal). NULL = aplica al producto base.
CREATE TABLE IF NOT EXISTS recetas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  variante_id INTEGER,
  insumo_id   INTEGER NOT NULL,
  cantidad    REAL    NOT NULL DEFAULT 1,               -- Cantidad de insumo por unidad de producto/variante
  FOREIGN KEY (producto_id) REFERENCES productos(id)         ON DELETE CASCADE,
  FOREIGN KEY (variante_id) REFERENCES producto_variantes(id) ON DELETE CASCADE,
  FOREIGN KEY (insumo_id)   REFERENCES insumos(id)           ON DELETE CASCADE
);

-- ─── Movimientos de inventario (auditoría) ────────────────────
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  insumo_id        INTEGER NOT NULL,
  tipo             TEXT    NOT NULL
                   CHECK(tipo IN ('venta','ajuste_manual','importacion_inicial','reversion')),
  cantidad         REAL    NOT NULL,                    -- delta con signo: negativo = salida, positivo = entrada
  stock_resultante REAL    NOT NULL,                     -- snapshot de insumos.stock_actual tras este movimiento
  pedido_id        INTEGER,                              -- solo tipo='venta' | 'reversion'
  usuario_id       INTEGER,                              -- quién lo generó
  notas            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (insumo_id)  REFERENCES insumos(id),
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ─── Combos: qué producto es combo y de qué categoría sale la opción ──
CREATE TABLE IF NOT EXISTS combo_slots (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id           INTEGER NOT NULL,                -- el producto combo, ej. "Hamburguesa en Combo"
  categoria_opciones_id INTEGER NOT NULL,                 -- categoría de la que se elige, ej. "Gaseosas"
  nombre_slot           TEXT    NOT NULL DEFAULT 'Bebida',
  FOREIGN KEY (producto_id)           REFERENCES productos(id)  ON DELETE CASCADE,
  FOREIGN KEY (categoria_opciones_id) REFERENCES categorias(id)
);

-- ─── Grupos de mesas (mesas fusionadas físicamente) ───────────
-- Cuando llega un grupo grande y ocupa varias mesas (ej. 3+4),
-- se crea un grupo y todos los pedidos nuevos de esas mesas se
-- registran bajo mesa_principal_id — una sola cuenta compartida.
CREATE TABLE IF NOT EXISTS mesa_grupos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  mesa_principal_id INTEGER NOT NULL,
  nombre            TEXT,                                -- Alias opcional: "Mesa 3+4"
  estado            TEXT    NOT NULL DEFAULT 'libre'
                    CHECK(estado IN ('libre','ocupada','en_preparacion','lista','por_pagar')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (mesa_principal_id) REFERENCES mesas(id)
);

-- ─── Mesas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mesas (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  numero    INTEGER NOT NULL UNIQUE,
  nombre    TEXT,                                       -- Alias opcional: "Terraza 1", "Barra"
  x         REAL    NOT NULL DEFAULT 0,                 -- Coordenada X para drag & drop
  y         REAL    NOT NULL DEFAULT 0,                 -- Coordenada Y para drag & drop
  estado    TEXT    NOT NULL DEFAULT 'libre'
            CHECK(estado IN ('libre','ocupada','en_preparacion','lista','por_pagar')),
  capacidad INTEGER NOT NULL DEFAULT 4,
  grupo_id  INTEGER REFERENCES mesa_grupos(id)           -- NULL = mesa independiente
);

-- ─── Pedidos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_orden  TEXT    NOT NULL UNIQUE,                 -- Ej: "DP-0001"
  mesa_id       INTEGER,                                -- NULL = venta directa / domicilio
  usuario_id    INTEGER NOT NULL,                       -- Quién tomó el pedido
  estado        TEXT    NOT NULL DEFAULT 'pendiente'
                CHECK(estado IN ('pendiente','en_preparacion','listo','entregado','pagado','cancelado')),
  tipo          TEXT    NOT NULL DEFAULT 'mesa'
                CHECK(tipo IN ('mesa','mostrador','domicilio')),
  subtotal      INTEGER NOT NULL DEFAULT 0,
  impuestos     INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  propina       INTEGER NOT NULL DEFAULT 0,
  costo_domicilio INTEGER NOT NULL DEFAULT 0,           -- Costo del servicio de domicilio
  monto_pagado  INTEGER NOT NULL DEFAULT 0,
  metodo_pago   TEXT    DEFAULT 'efectivo'
                CHECK(metodo_pago IN ('efectivo','transferencia','tarjeta_debito','tarjeta_credito','mixto')),
  notas         TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (mesa_id)    REFERENCES mesas(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ─── Detalle del pedido ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS detalle_pedido (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id       INTEGER NOT NULL,
  producto_id     INTEGER,                              -- Referencia al producto original
  variante_id     INTEGER,                              -- NULL si no tiene variantes
  nombre_display  TEXT    NOT NULL,                      -- Snapshot: nombre tal como se vendió
  cantidad        INTEGER NOT NULL DEFAULT 1,
  precio_unitario INTEGER NOT NULL,
  subtotal        INTEGER NOT NULL,
  notas           TEXT,                                  -- "Sin cebolla", "Extra queso", etc.
  combo_padre_id  INTEGER,                                -- si no-NULL: es la bebida $0 de un combo, apunta a la fila del combo
  FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)            ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (variante_id) REFERENCES producto_variantes(id),
  FOREIGN KEY (combo_padre_id) REFERENCES detalle_pedido(id)
);

-- ─── Pagos parciales / Abonos ────────────────────────────────
CREATE TABLE IF NOT EXISTS pagos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id     INTEGER NOT NULL,
  monto         INTEGER NOT NULL,
  metodo_pago   TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- ─── Cierres de caja ────────────────────────────────────────
-- Solo puede existir UNA fila con fecha_cierre IS NULL a la vez (caja abierta) —
-- se valida a nivel de aplicación, no con una restricción de BD (ver caja-helpers.js).
CREATE TABLE IF NOT EXISTS cierres_caja (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id            INTEGER NOT NULL,
  fecha_apertura        TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
  fecha_cierre          TEXT,
  monto_inicial         INTEGER NOT NULL DEFAULT 0,     -- Base de caja al abrir
  monto_final           INTEGER,                        -- Efectivo contado físicamente al cerrar
  total_ventas          INTEGER NOT NULL DEFAULT 0,
  total_efectivo        INTEGER NOT NULL DEFAULT 0,
  total_transferencias  INTEGER NOT NULL DEFAULT 0,
  total_tarjeta_debito  INTEGER NOT NULL DEFAULT 0,
  total_tarjeta_credito INTEGER NOT NULL DEFAULT 0,
  diferencia            INTEGER,                        -- monto_final - (monto_inicial + total_efectivo)
  notas                 TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ─── Índices para rendimiento ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_productos_categoria   ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_producto_variantes_pid ON producto_variantes(producto_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado         ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa           ON pedidos(mesa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha          ON pedidos(created_at);
CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pid     ON detalle_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_recetas_producto       ON recetas(producto_id);
CREATE INDEX IF NOT EXISTS idx_recetas_variante       ON recetas(variante_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido           ON pagos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_mesas_grupo            ON mesas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_insumos_proveedor      ON insumos(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_insumo     ON movimientos_inventario(insumo_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_pedido     ON movimientos_inventario(pedido_id);
CREATE INDEX IF NOT EXISTS idx_combo_slots_producto   ON combo_slots(producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_combo_padre    ON detalle_pedido(combo_padre_id);
