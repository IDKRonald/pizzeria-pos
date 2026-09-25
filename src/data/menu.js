// src/data/menu.js
// Menú completo — Don Peñolinni Pizzería
// Las pizzas usan el patrón "Producto con Variantes" (un producto padre → N tamaños)

/* ─── Tamaños disponibles ──────────────────────────────────────────────── */
const PIZZA_TAMANHOS = [
  { key: 'jr', label: 'Junior', porciones: '3p' },
  { key: 'per', label: 'Personal', porciones: '4p' },
  { key: 'eje', label: 'Ejecutiva', porciones: '6p' },
  { key: 'med', label: 'Mediana', porciones: '8p' },
  { key: 'fam', label: 'Familiar', porciones: '12p' },
];

/* ─── Sabores de pizza ─────────────────────────────────────────────────── */
// precios: [junior, personal, ejecutiva, mediana, familiar]
// null = ese tamaño no existe para esa variedad
const PIZZA_TIPOS = [
  { nombre: 'Jamón', desc: 'Jamón y salami', precios: [10000, 18000, 28000, 42000, 53000] },
  { nombre: 'Hawaiana', desc: 'Jamón y piña', precios: [11000, 20000, 30000, 45000, 58000] },
  { nombre: 'Francesa', desc: 'Pollo y champiñones', precios: [11000, 20000, 30000, 45000, 58000] },
  { nombre: 'Madrid', desc: 'Pollo y jamón', precios: [11000, 20000, 30000, 45000, 58000] },
  { nombre: 'Maicitos', desc: 'Con jamón o pollo', precios: [11000, 20000, 30000, 45000, 58000] },
  { nombre: 'Vegetales', desc: 'Champiñones, maicitos, tomate, cebolla, albahaca y orégano', precios: [12000, 20000, 31000, 46000, 59000] },
  { nombre: 'Madrid Especial', desc: 'Pollo, salami y parmesano', precios: [12000, 20000, 32000, 47000, 60000] },
  { nombre: 'Napolitana', desc: 'Salami, tomate, gratinado, orégano y albahaca', precios: [12000, 20000, 32000, 47000, 60000] },
  { nombre: 'Ranchera', desc: 'Jamón, salami, salchicha ranchera y tocineta', precios: [14000, 22000, 35000, 53000, 66000] },
  { nombre: 'Carnes Mixtas', desc: 'Jamón, salami, pollo y tocineta', precios: [14000, 22000, 35000, 53000, 66000] },
  { nombre: 'Mambo', desc: 'Plátano maduro, maíz, tocineta y parmesano', precios: [14000, 22000, 35000, 53000, 66000] },
  { nombre: 'Pepperoni', desc: 'Queso y pepperoni', precios: [14000, 22000, 35000, 54000, 67000] },
  { nombre: 'Mexicana', desc: 'Pepperoni, maicitos, cábano, tomate y jalapeños', precios: [null, 23000, 37000, 56000, 68000] },
  { nombre: 'Española', desc: 'Jamón, salami, cábano, tomate, maicitos, pimentón', precios: [null, 23000, 37000, 56000, 68000] },
  { nombre: 'Don Peñolinni', desc: 'Jamón, pollo, champiñones, tomate y tocineta', precios: [null, 25000, 39000, 59000, 76000] },
  { nombre: 'Mixta Especial', desc: 'Jamón, salami, pollo, champiñones, tomate, cebolla, tocineta y albahaca', precios: [null, 25000, 39000, 59000, 76000] },
];

/**
 * Genera un arreglo de productos-pizza con la estructura de variantes:
 *   { id, nombre, desc, categoria, imagen, variantes: [{ idVariante, nombreTamanio, precio }] }
 */
const pizzas = PIZZA_TIPOS.map((tipo) => {
  const slug = tipo.nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return {
    id: `pz_${slug}`,
    nombre: `Pizza ${tipo.nombre}`,
    desc: tipo.desc,
    categoria: 'Pizzas',
    imagen: '🍕',
    // Rango de precios para mostrar en la tarjeta (mínimo–máximo)
    precioDesde: Math.min(...tipo.precios.filter(Boolean)),
    variantes: PIZZA_TAMANHOS
      .map((tam, idx) => {
        const precio = tipo.precios[idx];
        if (precio === null) return null;
        return {
          idVariante: `pz_${slug}_${tam.key}`,
          nombreTamanio: `${tam.label} · ${tam.porciones}`,
          precio,
        };
      })
      .filter(Boolean),
  };
});

/* ─── Resto del menú (sin variantes) ─────────────────────────────────── */
const carnes = [
  { id: 'car_solomo', nombre: 'Solomo a la Plancha (250gr)', precio: 35000, categoria: 'Carnes', imagen: '🥩' },
  { id: 'car_pechuga', nombre: 'Pechuga a la Plancha (250gr)', precio: 32000, categoria: 'Carnes', imagen: '🍗' },
  { id: 'car_chuzo', nombre: 'Chuzo Pollo o Mixto (220gr)', precio: 24000, categoria: 'Carnes', imagen: '🍖' },
];

const hamburguesas = [
  { id: 'ham_res', nombre: 'Hamburguesa Res o Pollo Apanado', precio: 19000, categoria: 'Hamburguesas', imagen: '🍔' },
  { id: 'ham_combo', nombre: 'Hamburguesa en Combo (+ papas y gaseosa)', precio: 25000, categoria: 'Hamburguesas', imagen: '🍔' },
  { id: 'ham_esp', nombre: 'Hamburguesa Especial', precio: 30000, categoria: 'Hamburguesas', imagen: '🍔' },
  { id: 'ham_mix', nombre: 'Hamburguesa Mixta (Res + Pollo)', precio: 30000, categoria: 'Hamburguesas', imagen: '🍔' },
];

const lasagna = [
  { id: 'las_peq', nombre: 'Lasagna Pequeña (Carne/Pollo/Mixta)', precio: 17000, categoria: 'Lasagna', imagen: '🫕' },
  { id: 'las_gran', nombre: 'Lasagna Grande (Carne/Pollo/Mixta)', precio: 23000, categoria: 'Lasagna', imagen: '🫕' },
];

const calzone = [
  { id: 'cal_haw', nombre: 'Calzone Hawaiano', precio: 22000, categoria: 'Calzone', imagen: '🥙' },
  { id: 'cal_veg', nombre: 'Calzone Vegetales', precio: 24000, categoria: 'Calzone', imagen: '🥙' },
  { id: 'cal_nap', nombre: 'Calzone Napolitano', precio: 25000, categoria: 'Calzone', imagen: '🥙' },
  { id: 'cal_ran', nombre: 'Calzone Ranchero', precio: 27000, categoria: 'Calzone', imagen: '🥙' },
  { id: 'cal_mex', nombre: 'Calzone Mexicano', precio: 27000, categoria: 'Calzone', imagen: '🥙' },
  { id: 'cal_don', nombre: 'Calzone Don Peñolinni', precio: 29000, categoria: 'Calzone', imagen: '🥙' },
];

const porciones = [
  { id: 'por_mai_peq', nombre: 'Maicitos Gratinados Pequeño', precio: 16000, categoria: 'Porciones', imagen: '🌽' },
  { id: 'por_mai_gran', nombre: 'Maicitos Gratinados Grande', precio: 21000, categoria: 'Porciones', imagen: '🌽' },
  { id: 'por_sal_peq', nombre: 'Salchipapas Pequeña', precio: 15000, categoria: 'Porciones', imagen: '🍟' },
  { id: 'por_sal_gran', nombre: 'Salchipapas Grande', precio: 24000, categoria: 'Porciones', imagen: '🍟' },
  { id: 'por_picada', nombre: 'Picada (Res, cerdo, chorizo, butifarra, papas)', precio: 50000, categoria: 'Porciones', imagen: '🫙' },
];

const jugos = [
  { id: 'jug_agua', nombre: 'Jugo en Agua', precio: 7000, categoria: 'Jugos', imagen: '🧃' },
  { id: 'jug_leche', nombre: 'Jugo en Leche', precio: 8000, categoria: 'Jugos', imagen: '🧃' },
  { id: 'jug_milo', nombre: 'Jugo Milo', precio: 9000, categoria: 'Jugos', imagen: '🧃' },
  { id: 'jug_lim', nombre: 'Limonada (Natural/Coco/Mango)', precio: 10000, categoria: 'Jugos', imagen: '🍋' },
  { id: 'jug_malt', nombre: 'Malteada', precio: 13000, categoria: 'Jugos', imagen: '🥤' },
];

const bebidasCal = [
  { id: 'bev_milo', nombre: 'Milo Caliente', precio: 9000, categoria: 'Bebidas Calientes', imagen: '☕' },
  { id: 'bev_frojos', nombre: 'Frutos Rojos Caliente', precio: 8000, categoria: 'Bebidas Calientes', imagen: '☕' },
  { id: 'bev_fama', nombre: 'Frutas Amarillas Caliente', precio: 8000, categoria: 'Bebidas Calientes', imagen: '☕' },
  { id: 'bev_inf', nombre: 'Infusión de Frutas', precio: 8000, categoria: 'Bebidas Calientes', imagen: '🍵' },
  { id: 'bev_cafe', nombre: 'Café en Leche', precio: 4000, categoria: 'Bebidas Calientes', imagen: '☕' },
  { id: 'bev_tinto', nombre: 'Tinto', precio: 3000, categoria: 'Bebidas Calientes', imagen: '☕' },
  { id: 'bev_arom', nombre: 'Aromática', precio: 3000, categoria: 'Bebidas Calientes', imagen: '🍵' },
];

const cervezas = [
  { id: 'cer_pil', nombre: 'Cerveza Pilsen', precio: 6000, categoria: 'Cervezas', imagen: '🍺' },
  { id: 'cer_agu', nombre: 'Cerveza Águila', precio: 6000, categoria: 'Cervezas', imagen: '🍺' },
  { id: 'cer_agul', nombre: 'Cerveza Águila Light', precio: 7000, categoria: 'Cervezas', imagen: '🍺' },
  { id: 'cer_club', nombre: 'Cerveza Club Colombia', precio: 7000, categoria: 'Cervezas', imagen: '🍺' },
  { id: 'cer_3cord', nombre: 'Cerveza 3 Cordilleras Rosé', precio: 10000, categoria: 'Cervezas', imagen: '🍺' },
  { id: 'cer_cor', nombre: 'Cerveza Corona', precio: 10000, categoria: 'Cervezas', imagen: '🍺' },
  { id: 'cer_art', nombre: 'Cerveza artesanal', precio: 13000, categoria: 'Cervezas', imagen: '🍺' },
];

const gaseosas = [
  { id: 'gas_manz_250', nombre: 'Postobon Manzana 250ml', precio: 4000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_uva_250', nombre: 'Postobon Uva 250ml', precio: 4000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_coca_250', nombre: 'Coca Cola 250ml', precio: 4000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_zero_250', nombre: 'Zero 250ml', precio: 4000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_tutti_m_250', nombre: 'Tutti Fruti Mango 250ml', precio: 4000, categoria: 'Gaseosas', imagen: '🧃' },
  { id: 'gas_manz_350', nombre: 'Manzana 350ml', precio: 5000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_col_350', nombre: 'Colombiana 350ml', precio: 5000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_coca_350', nombre: 'Coca Cola 350ml', precio: 5000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_qua_350', nombre: 'Quatro 350ml', precio: 5000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_tutti_m_350', nombre: 'Tutti Fruti Mora 350ml', precio: 5000, categoria: 'Gaseosas', imagen: '🧃' },
  { id: 'gas_spri_400', nombre: 'Sprite 400ml', precio: 6000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_col_15', nombre: 'Colombiana 1.5L', precio: 9000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_manz_15', nombre: 'Manzana 1.5L', precio: 9000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_qua_15', nombre: 'Quatro 1.5L', precio: 9000, categoria: 'Gaseosas', imagen: '🥤' },
  { id: 'gas_zero_15', nombre: 'Coca Cola Zero 1.5L', precio: 9000, categoria: 'Gaseosas', imagen: '🥤' },
];

const sodas = [
  { id: 'sod_300', nombre: 'Soda 300ml', precio: 5000, categoria: 'Sodas', imagen: '🫧' },
  { id: 'sod_bret_350', nombre: 'Bretaña 350ml', precio: 5000, categoria: 'Sodas', imagen: '🫧' },
  { id: 'sod_hatsu_fram', nombre: 'Soda Hatsu Frambuesa', precio: 8000, categoria: 'Sodas', imagen: '🍹' },
  { id: 'sod_hatsu_lim', nombre: 'Soda Hatsu Limón', precio: 8000, categoria: 'Sodas', imagen: '🍹' },
  { id: 'sod_mich', nombre: 'Michelada', precio: 7000, categoria: 'Sodas', imagen: '🍺' },
  { id: 'sod_abor', nombre: 'Aborzada (Frutos)', precio: 10000, categoria: 'Sodas', imagen: '🍹' },
];

const licores = [
  { id: 'vin_fria', nombre: 'Copa de Vino Fría', precio: 12000, categoria: 'Licores', imagen: '🍷' },
  { id: 'vin_cal', nombre: 'Copa de Vino Caliente', precio: 15000, categoria: 'Licores', imagen: '🍷' },
];

const aguas = [
  { id: 'agu_cris_600', nombre: 'Agua Cristal 600ml', precio: 4000, categoria: 'Aguas', imagen: '💧' },
  { id: 'agu_bris_manz', nombre: 'Brisa Manzana 600ml', precio: 5000, categoria: 'Aguas', imagen: '💧' },
];

const te = [
  { id: 'te_mr_tea', nombre: 'Mr. Tea', precio: 6000, categoria: 'Té', imagen: '🧋' },
  { id: 'te_hatsu_bla', nombre: 'Te Hatsu Blanco', precio: 8000, categoria: 'Té', imagen: '🧋' },
  { id: 'te_hatsu_roj', nombre: 'Te Hatsu Rojo', precio: 8000, categoria: 'Té', imagen: '🧋' },
  { id: 'te_hatsu_ama', nombre: 'Te Hatsu Amarillo', precio: 8000, categoria: 'Té', imagen: '🧋' },
  { id: 'te_hatsu_mor', nombre: 'Te Hatsu Morado', precio: 8000, categoria: 'Té', imagen: '🧋' },
];

/* ─── Adiciones y Otros ──────────────────────────────────────────────── */
const ADICION_TAMANHOS = [
  { key: 'por', label: 'Porción', desc: '1 p.' },
  { key: 'per', label: 'Personal', desc: 'Pizza 4p' },
  { key: 'peq', label: 'Pequeña', desc: 'Pizza 6p' },
  { key: 'med', label: 'Mediana', desc: 'Pizza 8p' },
  { key: 'gran', label: 'Grande', desc: 'Pizza 12p' },
];

const ADICION_TIPOS = [
  { nombre: 'Pepperoni', precios: [2000, 4000, 6500, 8500, 11000] },
  { nombre: 'Queso', precios: [2000, 4000, 6500, 8500, 11000] },
  { nombre: 'Jamón', precios: [1000, 2000, 3000, 4000, 5000] },
  { nombre: 'Pimentón', precios: [500, 1000, 1500, 2000, 2500] },
  { nombre: 'Piña', precios: [1000, 2000, 3000, 4000, 5000] },
  { nombre: 'Tocineta', precios: [2000, 4000, 6500, 8500, 11000] },
  { nombre: 'Champiñones', precios: [2000, 4000, 6500, 8500, 11000] },
  { nombre: 'Maíz Tierno', precios: [2000, 4000, 6500, 8500, 11000] },
  { nombre: 'Pollo', precios: [3000, 4500, 7500, 9500, 13000] },
  { nombre: 'Chorizo de Pollo', precios: [1500, 3500, 5500, 7000, 9000] },
  { nombre: 'Salchicha Ranchera', precios: [2000, 4000, 6500, 8500, 11000] },
  { nombre: 'Salami', precios: [1500, 3500, 5500, 7000, 9000] },
  { nombre: 'Atún', precios: [2500, 4000, 6500, 8000, 10000] },
  { nombre: 'Jalapeño', precios: [1500, 3500, 5500, 7000, 9000] },
  { nombre: 'Plátano', precios: [1000, 2000, 3000, 4000, 5000] },
  { nombre: 'Cábano', precios: [2000, 3000, 5000, 7000, 9000] },
  { nombre: 'Parmesano', precios: [2000, 3000, 5000, 7000, 9000] },
];

const adiciones = ADICION_TIPOS.map((tipo) => {
  const slug = tipo.nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return {
    id: `adi_${slug}`,
    nombre: `Adición de ${tipo.nombre}`,
    desc: 'Elige el tamaño de la adición',
    categoria: 'Adiciones',
    imagen: '➕',
    precioDesde: Math.min(...tipo.precios.filter((p) => p !== null)),
    variantes: ADICION_TAMANHOS
      .map((tam, idx) => {
        const precio = tipo.precios[idx];
        if (precio == null) return null;
        return {
          idVariante: `adi_${slug}_${tam.key}`,
          nombreTamanio: `${tam.label} · ${tam.desc}`,
          precio,
        };
      })
      .filter(Boolean),
  };
});

const otros = [
  { id: 'custom_item', nombre: 'Artículo Personalizado', desc: 'Añadir ítem manual con precio libre', precio: 0, categoria: 'Otros', imagen: '✏️' },
];

/* ─── Export unificado ────────────────────────────────────────────────── */
export const menuPizzeria = [
  ...pizzas,
  ...carnes,
  ...hamburguesas,
  ...lasagna,
  ...calzone,
  ...porciones,
  ...jugos,
  ...bebidasCal,
  ...cervezas,
  ...gaseosas,
  ...sodas,
  ...licores,
  ...aguas,
  ...te,
  ...adiciones,
  ...otros,
];

/** Categorías con emoji para la barra de filtros */
export const CATEGORIAS_MENU = [
  { id: 'Todos', emoji: '🏠' },
  { id: 'Pizzas', emoji: '🍕' },
  { id: 'Carnes', emoji: '🥩' },
  { id: 'Hamburguesas', emoji: '🍔' },
  { id: 'Lasagna', emoji: '🫕' },
  { id: 'Calzone', emoji: '🥙' },
  { id: 'Porciones', emoji: '🍟' },
  { id: 'Jugos', emoji: '🧃' },
  { id: 'Bebidas Calientes', emoji: '☕' },
  { id: 'Cervezas', emoji: '🍺' },
  { id: 'Gaseosas', emoji: '🥤' },
  { id: 'Sodas', emoji: '🫧' },
  { id: 'Licores', emoji: '🍷' },
  { id: 'Aguas', emoji: '💧' },
  { id: 'Té', emoji: '🧋' },
  { id: 'Adiciones', emoji: '➕' },
  { id: 'Otros', emoji: '📦' },
];