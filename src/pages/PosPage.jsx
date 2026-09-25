// src/pages/PosPage.jsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getProductos, getCategorias, crearPedido, actualizarPedidoCompleto } from '../lib/api';
import { useCajaAbierta } from '../hooks/useCajaAbierta';
import ProductCard from '../components/ProductCard';
import CheckoutSidebar from '../components/CheckoutSidebar';
import TicketImpresion, { ETIQUETAS_PAGO } from '../components/TicketImpresion';
import ModalVariantes from '../components/ModalVariantes';
import ModalComboBebida from '../components/ModalComboBebida';
import ModalCustomItem from '../components/ModalCustomItem';
import ModalQR from '../components/ModalQR';
import ModalCuentas from '../components/ModalCuentas';

/* ── localStorage keys ── */
const LS_CART      = 'pos_v1_cart';
const LS_PAGO      = 'pos_v1_tipopago';
const LS_DOMICILIO = 'pos_v1_domicilio';
const LS_COSTO_DOM = 'pos_v1_costo_domicilio';
const LS_ULTIMO_RECIBO = 'pos_v1_ultimo_recibo';
const LS_IMPRIMIR_COPIA = 'pos_v1_imprimir_copia';
const LS_ENVIAR_WHATSAPP = 'pos_v1_enviar_whatsapp';

const formatCOP = (v) =>
  v.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

/** Arma el texto plano de la factura para enviar por WhatsApp (wa.me solo soporta texto, no adjuntar archivos) */
function construirTextoFactura(recibo) {
  const { cart, total, ordenNumero, fechaHora, tipoPago, esDomicilio, propina = 0, costoDomicilio = 0, mesa, pagoActual = 0, montoPagadoHistorico = 0 } = recibo;
  const subtotal = total - propina - costoDomicilio;
  const lineas = [
    '🍕 *Pizzería Don Peñolinni*',
    `Orden #${ordenNumero} · ${fechaHora}`,
    esDomicilio ? 'Domicilio' : mesa ? `Mesa: ${mesa}` : 'Venta mostrador',
    '',
    ...cart.map((i) => `${i.cantidad}x ${i.nombre} — ${formatCOP(i.precio * i.cantidad)}`),
    '',
    `Subtotal: ${formatCOP(subtotal)}`,
  ];
  if (propina > 0) lineas.push(`Propina: ${formatCOP(propina)}`);
  if (costoDomicilio > 0) lineas.push(`Domicilio: ${formatCOP(costoDomicilio)}`);
  lineas.push(`*TOTAL: ${formatCOP(total)}*`);
  if (montoPagadoHistorico > 0) lineas.push(`Abonos anteriores: ${formatCOP(montoPagadoHistorico)}`);
  const saldo = total - (montoPagadoHistorico + pagoActual);
  if (saldo > 0) lineas.push(`Saldo restante: ${formatCOP(saldo)}`);
  lineas.push('', `Pago: ${ETIQUETAS_PAGO[tipoPago] || tipoPago}`, '', '¡Gracias por tu compra! 🙌');
  return lineas.join('\n');
}

/** Pide el número del cliente y abre WhatsApp con la factura ya redactada, lista para enviar */
function enviarPorWhatsApp(recibo) {
  const numeroCrudo = prompt('Número de WhatsApp del cliente (ej: 3001234567):');
  if (!numeroCrudo) return;
  let digitos = numeroCrudo.replace(/\D/g, '');
  if (digitos.length === 10) digitos = '57' + digitos; // celular colombiano sin indicativo
  const texto = construirTextoFactura(recibo);
  window.open(`https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`, '_blank');
}

function lsRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export default function PosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const { cajaAbierta, cargandoCaja } = useCajaAbierta();
  const cajaCerrada = !cargandoCaja && !cajaAbierta;
  const puedeAbrirCaja = ['admin', 'cajero'].includes(usuario?.rol);

  /* ── Datos del menú (cargados del backend) ── */
  const [menuProductos, setMenuProductos] = useState([]);
  const [categoriasMenu, setCategoriasMenu] = useState([]);
  const [cargando, setCargando] = useState(true);

  /* ── UI ── */
  const [theme, setTheme]                       = useState('dark');
  const [categoriaActiva, setCategoriaActiva]   = useState('Todos');
  const [busqueda, setBusqueda]                 = useState('');
  const [mostrarAtajos, setMostrarAtajos]       = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen]     = useState(false);
  const [showQR, setShowQR]                     = useState(false);
  const [showCuentas, setShowCuentas]           = useState(false);
  const [pedidoActivoId, setPedidoActivoId]     = useState(null);
  const [ordenActivaNum, setOrdenActivaNum]     = useState(null);
  const [modoEdicion, setModoEdicion]           = useState(null); // null | 'editar' | 'cobrar'
  const [mesaInfo, setMesaInfo]                 = useState(null); // { numero, nombre, grupoNombre } — viene del diagrama

  /* ── Carrito (persistido) ── */
  const [cart, setCart] = useState(() => lsRead(LS_CART, []));

  /* ── Modal variantes / custom / combo ── */
  const [productoVariante, setProductoVariante] = useState(null);
  const [productoCombo, setProductoCombo]       = useState(null);
  const [showCustomItem, setShowCustomItem]     = useState(false);

  /* ── Checkout (persistido) ── */
  const [tipoPago, setTipoPago]             = useState(() => lsRead(LS_PAGO, 'efectivo'));
  const [esDomicilio, setEsDomicilio]       = useState(() => lsRead(LS_DOMICILIO, false));
  const [costoDomicilio, setCostoDomicilio] = useState(() => lsRead(LS_COSTO_DOM, ''));
  const [conPropina, setConPropina]         = useState(false);
  const [imprimirCopia, setImprimirCopia]   = useState(() => lsRead(LS_IMPRIMIR_COPIA, false));
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(() => lsRead(LS_ENVIAR_WHATSAPP, false));
  const [mesa, setMesa]                     = useState('');

  /* ── Ultimo Recibo ── */
  const [ultimoRecibo, setUltimoRecibo] = useState(() => lsRead(LS_ULTIMO_RECIBO, null));
  const [isReprinting, setIsReprinting] = useState(false);

  /* ── Checkout extra data ── */
  const [montoEntregado, setMontoEntregado] = useState('');
  const [facturarAhorita, setFacturarAhorita] = useState(false);
  const [montoAbonar, setMontoAbonar] = useState('');
  const [montoPagadoHistorico, setMontoPagadoHistorico] = useState(0);
  const [estadoOriginal, setEstadoOriginal] = useState('pendiente');

  /* ── Bloqueo de edición: cocina ya tomó este pedido, solo se puede ver ── */
  const edicionBloqueada = modoEdicion === 'editar' && estadoOriginal !== 'pendiente';

  /* ── Debouncing ── */
  const [isProcesando, setIsProcesando] = useState(false);

  /* ── Toast de restauración ── */
  const [toastMsg, setToastMsg] = useState(() => {
    const saved = lsRead(LS_CART, []);
    if (saved.length > 0) {
      const n = saved.reduce((a, i) => a + i.cantidad, 0);
      return `🔄 Orden anterior restaurada — ${n} producto${n !== 1 ? 's' : ''}`;
    }
    return null;
  });

  /* ── Datos de sesión ── */
  const [ordenNumero] = useState(() => Math.floor(Math.random() * 9000) + 1000);
  const [fechaHora]   = useState(() =>
    new Date().toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  );

  /* ── Persistencia ── */
  useEffect(() => { localStorage.setItem(LS_CART,      JSON.stringify(cart));        }, [cart]);
  useEffect(() => { localStorage.setItem(LS_PAGO,      JSON.stringify(tipoPago));    }, [tipoPago]);
  useEffect(() => { localStorage.setItem(LS_DOMICILIO, JSON.stringify(esDomicilio)); }, [esDomicilio]);
  useEffect(() => { localStorage.setItem(LS_COSTO_DOM, JSON.stringify(costoDomicilio)); }, [costoDomicilio]);
  useEffect(() => { localStorage.setItem(LS_ULTIMO_RECIBO, JSON.stringify(ultimoRecibo)); }, [ultimoRecibo]);
  useEffect(() => { localStorage.setItem(LS_IMPRIMIR_COPIA, JSON.stringify(imprimirCopia)); }, [imprimirCopia]);
  useEffect(() => { localStorage.setItem(LS_ENVIAR_WHATSAPP, JSON.stringify(enviarWhatsapp)); }, [enviarWhatsapp]);

  /* ── Toast auto-dismiss ── */
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  /* ── Cerrar drawer al agrandar ventana ── */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setCartDrawerOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ── Cargar menú desde el backend ── */
  useEffect(() => {
    let mounted = true;
    async function fetchMenu() {
      try {
        const [prods, cats] = await Promise.all([getProductos(), getCategorias()]);
        if (!mounted) return;
        setMenuProductos(prods);
        // Construir categorías con 'Todos' al inicio
        const catList = [{ id: 'Todos', emoji: '🏠' }, ...cats.map(c => ({ id: c.nombre, emoji: c.emoji }))];
        setCategoriasMenu(catList);
      } catch (err) {
        console.error('Error cargando menú:', err);
      } finally {
        if (mounted) setCargando(false);
      }
    }
    fetchMenu();
    return () => { mounted = false; };
  }, []);

  /* ── Carrito ── */
  const handleAgregar = useCallback((itemPlano) => {
    if (edicionBloqueada) return;
    if (itemPlano.id === 'custom_item') {
      setShowCustomItem(true);
      return;
    }
    setCart((prev) => {
      const existe = prev.find((i) => i.id === itemPlano.id);
      if (existe) return prev.map((i) =>
        i.id === itemPlano.id ? { ...i, cantidad: i.cantidad + 1 } : i
      );
      return [...prev, { ...itemPlano, cantidad: 1 }];
    });
  }, [edicionBloqueada]);

  const handleSeleccionarVariante = useCallback((base, variante) => {
    const nombreFinal = variante.nombreCustom || `${base.nombre} · ${variante.nombreTamanio}`;
    handleAgregar({
      id:     variante.idVariante,
      nombre: nombreFinal,
      precio: variante.precio,
      imagen: base.imagen,
    });
    setProductoVariante(null);
  }, [handleAgregar]);

  const handleSeleccionarCombo = useCallback((producto, bebida) => {
    const comboIdRaw = parseInt(producto.id.replace('prod_', ''), 10);
    const bebidaIdRaw = parseInt(bebida.id.replace('prod_', ''), 10);
    handleAgregar({
      id: `combo_${comboIdRaw}_${bebidaIdRaw}`,
      nombre: `${producto.nombre} · ${bebida.nombre}`,
      precio: producto.precio,
      imagen: producto.imagen,
      comboExtra: { comboProductoId: comboIdRaw, bebidaProductoId: bebidaIdRaw, bebidaNombre: bebida.nombre },
    });
    setProductoCombo(null);
  }, [handleAgregar]);

  const handleIncrementar = useCallback((id) => {
    if (edicionBloqueada) return;
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, cantidad: i.cantidad + 1 } : i));
  }, [edicionBloqueada]);

  const handleDecrementar = useCallback((id) => {
    if (edicionBloqueada) return;
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      if (item.cantidad === 1) return prev.filter((i) => i.id !== id);
      return prev.map((i) => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  }, [edicionBloqueada]);

  const resetOrden = useCallback(() => {
    setCart([]); setTipoPago('efectivo'); setEsDomicilio(false); setCostoDomicilio(''); setCartDrawerOpen(false); setMesa(''); setMontoEntregado('');
    setFacturarAhorita(false); setMontoAbonar(''); setMontoPagadoHistorico(0); setEstadoOriginal('pendiente');
    setPedidoActivoId(null); setOrdenActivaNum(null); setModoEdicion(null); setMesaInfo(null);
  }, []);

  /* ── Carga un pedido existente al carrito (reutilizado por el diagrama de mesas y Cuentas Abiertas) ── */
  const cargarPedidoEnCarrito = useCallback((pedidoDB, modo = 'cobrar') => {
    setPedidoActivoId(pedidoDB.id);
    setOrdenActivaNum(pedidoDB.numero_orden);
    setMesa(pedidoDB.mesa_id ? String(pedidoDB.mesa_id) : '');
    setEsDomicilio(pedidoDB.tipo === 'domicilio');
    setTipoPago(pedidoDB.metodo_pago || 'efectivo');
    setMontoPagadoHistorico(pedidoDB.monto_pagado || 0);
    setEstadoOriginal(pedidoDB.estado || 'pendiente');
    setModoEdicion(modo);
    setFacturarAhorita(false);
    setMontoAbonar('');

    const loadedCart = pedidoDB.items.map((item) => ({
      id: item.variante_id ? `var_${item.variante_id}` : (item.producto_id ? `prod_${item.producto_id}` : 'custom_item'),
      nombre: item.nombre_display,
      precio: item.precio_unitario,
      cantidad: item.cantidad,
      notas: item.notas || '',
      imagen: '🍽️'
    }));
    setCart(loadedCart);
    setShowCuentas(false);
  }, []);

  /* ── Estado que llega al navegar desde el diagrama de mesas ── */
  useEffect(() => {
    const st = location.state;
    if (!st) return;

    if (st.pedido) {
      cargarPedidoEnCarrito(st.pedido, st.modo || 'cobrar');
    } else if (st.mesaId) {
      resetOrden();
      setMesa(String(st.mesaId));
    }

    if (st.mesaId) {
      setMesaInfo({ numero: st.mesaNumero, nombre: st.mesaNombre, grupoNombre: st.grupoNombre });
    }

    // Limpiar el state de navegación para que un refresh no repita la carga
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelar = useCallback(() => {
    if (cart.length === 0) return;
    resetOrden();
  }, [cart.length, resetOrden]);

  const procesarPedidoDB = async (estado) => {
    const sub = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const prop = conPropina ? Math.round(sub * 0.10) : 0;
    const dom  = esDomicilio ? (parseInt(String(costoDomicilio).replace(/\D/g, '')) || 0) : 0;
    const tot  = sub + prop + dom;

    // Un ítem de combo se manda como 2 líneas adyacentes: el combo (precio completo)
    // seguido de su bebida elegida a $0 (esComboExtra) — el backend las enlaza y
    // así la bebida real entregada pasa por el mismo descuento de inventario que
    // cualquier otra venta de esa bebida.
    const itemsDB = cart.flatMap(item => {
      if (item.comboExtra) {
        return [
          {
            producto_id: item.comboExtra.comboProductoId,
            variante_id: null,
            nombre_display: item.nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio,
            subtotal: item.precio * item.cantidad,
            notas: item.notas || ''
          },
          {
            producto_id: item.comboExtra.bebidaProductoId,
            variante_id: null,
            nombre_display: `${item.comboExtra.bebidaNombre} (incluida en combo)`,
            cantidad: item.cantidad,
            precio_unitario: 0,
            subtotal: 0,
            notas: '',
            esComboExtra: true
          }
        ];
      }
      return [{
        producto_id: item.id.startsWith('var_') ? null : item.id,
        variante_id: item.id.startsWith('var_') ? item.id : null,
        nombre_display: item.nombre,
        cantidad: item.cantidad,
        precio_unitario: item.precio,
        subtotal: item.precio * item.cantidad,
        notas: item.notas || ''
      }];
    });

    const saldoRestante = tot - montoPagadoHistorico;
    const abonoRaw = parseInt(String(montoAbonar).replace(/\D/g, ''));
    const pago_actual = facturarAhorita ? (!isNaN(abonoRaw) ? abonoRaw : saldoRestante) : 0;

    const pedido = {
      mesa_id: mesa ? parseInt(mesa, 10) : null,
      usuario_id: usuario?.id,
      estado,
      tipo: esDomicilio ? 'domicilio' : (mesa ? 'mesa' : 'mostrador'),
      subtotal: sub,
      impuestos: 0,
      total: tot,
      propina: prop,
      costo_domicilio: dom,
      metodo_pago: tipoPago,
      pago_actual,
      items: itemsDB,
      modo: modoEdicion || 'cobrar',
    };

    if (pedidoActivoId) {
      return actualizarPedidoCompleto(pedidoActivoId, pedido);
    }
    return crearPedido(pedido);
  };

  const handleCobrar = useCallback(async () => {
    if (cart.length === 0 || isProcesando || edicionBloqueada || cajaCerrada) return;
    setIsProcesando(true);

    try {
      // 1. Guardar en BD. Si ya existe mantenemos su estado. Si es nuevo, 'pendiente' para que vaya a cocina.
      await procesarPedidoDB(pedidoActivoId ? estadoOriginal : 'pendiente');

      // 2. Imprimir recibo
      const sub = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
      const prop = conPropina ? Math.round(sub * 0.10) : 0;
      const dom  = esDomicilio ? (parseInt(String(costoDomicilio).replace(/\D/g, '')) || 0) : 0;
      const tot = sub + prop + dom;
      const saldoRestante = tot - montoPagadoHistorico;
      const abonoRaw = parseInt(String(montoAbonar).replace(/\D/g, ''));
      const pago_actual = facturarAhorita ? (!isNaN(abonoRaw) ? abonoRaw : saldoRestante) : 0;

      const recibo = {
        cart, total: tot, ordenNumero, fechaHora,
        tipoPago, esDomicilio, propina: prop, costoDomicilio: dom, mesa,
        montoEntregado: tipoPago === 'efectivo' ? (parseInt(montoEntregado.toString().replace(/\D/g, '')) || 0) : 0,
        pagoActual: pago_actual,
        montoPagadoHistorico,
      };
      setUltimoRecibo(recibo);

      if (enviarWhatsapp) enviarPorWhatsApp(recibo);

      setTimeout(() => {
        window.print();
        if (imprimirCopia) {
          setIsReprinting(true);
          setTimeout(() => {
            window.print();
            setTimeout(() => { setIsReprinting(false); resetOrden(); setIsProcesando(false); }, 100);
          }, 150);
        } else {
          setTimeout(() => { resetOrden(); setIsProcesando(false); }, 100);
        }
      }, 100);
    } catch (err) {
      console.error('Error al cobrar:', err);
      alert(err?.message || 'Error al guardar el pedido en la base de datos');
      setIsProcesando(false);
    }
  }, [cart, isProcesando, edicionBloqueada, cajaCerrada, conPropina, ordenNumero, fechaHora, tipoPago, esDomicilio, mesa, imprimirCopia, enviarWhatsapp, montoEntregado, resetOrden, usuario]);

  const handleEnviarCocina = useCallback(async () => {
    if (cart.length === 0 || isProcesando || edicionBloqueada) return;
    setIsProcesando(true);

    try {
      // 1. Guardar en BD (mantenemos su estado original si existe, o 'pendiente')
      await procesarPedidoDB(pedidoActivoId ? estadoOriginal : 'pendiente');

      // 2. Enviar por WhatsApp si el toggle está activo (no solo al cobrar —
      // el mesero puede querer mandarle el pedido al cliente sin facturar todavía)
      if (enviarWhatsapp) {
        const sub = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
        const prop = conPropina ? Math.round(sub * 0.10) : 0;
        const dom  = esDomicilio ? (parseInt(String(costoDomicilio).replace(/\D/g, '')) || 0) : 0;
        enviarPorWhatsApp({
          cart, total: sub + prop + dom, ordenNumero, fechaHora,
          tipoPago, esDomicilio, propina: prop, costoDomicilio: dom, mesa,
          pagoActual: 0, montoPagadoHistorico,
        });
      }

      // 3. Feedback visual y reset
      setToastMsg('👨‍🍳 Pedido enviado a cocina');
      setTimeout(() => {
        resetOrden();
        setIsProcesando(false);
      }, 500);
    } catch (err) {
      console.error('Error al enviar:', err);
      alert(err?.message || 'Error al enviar el pedido');
      setIsProcesando(false);
    }
  }, [cart, isProcesando, edicionBloqueada, conPropina, tipoPago, esDomicilio, costoDomicilio, mesa, enviarWhatsapp, ordenNumero, fechaHora, montoPagadoHistorico, resetOrden, usuario]);

  const handleReimprimir = useCallback(() => {
    if (!ultimoRecibo) return;
    setIsReprinting(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsReprinting(false), 500);
    }, 150);
  }, [ultimoRecibo]);

  const handleEnviarWhatsApp = useCallback(() => {
    if (!ultimoRecibo) return;
    enviarPorWhatsApp(ultimoRecibo);
  }, [ultimoRecibo]);

  /* ── Atajos de teclado y Accesibilidad ── */
  useEffect(() => {
    const focusables = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const onKey = (e) => {
      const tag = e.target.tagName.toLowerCase();
      const isTextInput = tag === 'input' || tag === 'textarea';
      const isSelect = tag === 'select';

      // Enter en la caja de búsqueda (mueve el foco al primer producto)
      if (isTextInput && e.target.id === 'input-busqueda' && e.key === 'Enter') {
        e.preventDefault();
        document.querySelector('[id^="btn-agregar-"]')?.focus();
        return;
      }

      // 1. Manejo exclusivo de ESCAPE (debe funcionar SIEMPRE, incluso en inputs)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.target.blur(); // Quitar foco al input actual
        if (productoVariante) setProductoVariante(null);
        else if (showCustomItem) setShowCustomItem(false);
        else if (showQR) setShowQR(false);
        else if (showCuentas) setShowCuentas(false);
        else if (cartDrawerOpen) setCartDrawerOpen(false);
        else if (mostrarAtajos) setMostrarAtajos(false);
        else handleCancelar();
        return;
      }

      // Bloquear atajos si se está escribiendo texto
      if (isTextInput) return;

      // Si es un <select>, dejar que Space, Enter y las Flechas funcionen nativamente
      // para abrir o cambiar las opciones. (Pero WASD sí navegará fuera de él).
      if (isSelect && (e.key.startsWith('Arrow') || e.key === ' ' || e.key === 'Enter')) {
        return;
      }

      // 2. Navegación Espacial 2D con WASD y Flechas
      const navKeys = {
        'ArrowUp': 'UP',    'w': 'UP',
        'ArrowDown': 'DOWN',  's': 'DOWN',
        'ArrowLeft': 'LEFT',  'a': 'LEFT',
        'ArrowRight': 'RIGHT', 'd': 'RIGHT'
      };

      if (navKeys[e.key]) {
        e.preventDefault();
        const dir = navKeys[e.key];
        const nodes = Array.from(document.querySelectorAll(focusables)).filter(
          el => !el.disabled && el.offsetParent !== null && el.id !== 'input-busqueda'
        );
        if (nodes.length === 0) return;
        
        const current = document.activeElement;
        if (!nodes.includes(current)) {
          // Si nada tiene foco o es inválido, ir al primero
          nodes[0].focus();
          return;
        }

        const currRect = current.getBoundingClientRect();
        const cx = currRect.left + currRect.width / 2;
        const cy = currRect.top + currRect.height / 2;

        let bestNode = null;
        let minDistance = Infinity;

        nodes.forEach((node) => {
          if (node === current) return;
          const rect = node.getBoundingClientRect();
          const nx = rect.left + rect.width / 2;
          const ny = rect.top + rect.height / 2;

          let valid = false;
          // Comprobar estrictamente la dirección
          if (dir === 'UP' && ny < cy - 10) valid = true;
          if (dir === 'DOWN' && ny > cy + 10) valid = true;
          if (dir === 'LEFT' && nx < cx - 10) valid = true;
          if (dir === 'RIGHT' && nx > cx + 10) valid = true;

          if (valid) {
            let dist = 0;
            // Penalizar fuertemente las desviaciones del eje principal
            if (dir === 'UP' || dir === 'DOWN') {
              dist = Math.abs(ny - cy) + Math.abs(nx - cx) * 5;
            } else {
              dist = Math.abs(nx - cx) + Math.abs(ny - cy) * 5;
            }

            if (dist < minDistance) {
              minDistance = dist;
              bestNode = node;
            }
          }
        });

        if (bestNode) {
          bestNode.focus();
        }
        return;
      }

      // 3. Atajos Rápidos
      switch (e.key) {
        case ' ': // Espacio para ir al buscador
          e.preventDefault();
          document.getElementById('input-busqueda')?.focus();
          break;
        case 'i': // Filtro de categorías
          e.preventDefault();
          document.getElementById('filtro-todos')?.focus();
          break;
        case 'o': // Primer producto de la cuadrícula
          e.preventDefault();
          document.querySelector('[id^="btn-agregar-"]')?.focus();
          break;
        case 'p': // Checkout sidebar
          e.preventDefault();
          document.getElementById('select-tipo-pago')?.focus();
          break;
        case 'Enter': // Cobrar orden (si tienes foco general)
          if (!isProcesando && cart.length > 0 && !productoVariante) {
            e.preventDefault(); handleCobrar();
          }
          break;
        case '?': // Mostrar atajos
          e.preventDefault();
          setMostrarAtajos((v) => !v);
          break;
        default: {
          const num = parseInt(e.key, 10);
          if (!isNaN(num) && num >= 1 && num <= Math.min(9, categoriasMenu.length)) {
            e.preventDefault();
            setCategoriaActiva(categoriasMenu[num - 1].id);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isProcesando, cart.length, productoVariante, cartDrawerOpen, mostrarAtajos, handleCobrar, handleCancelar, showQR]);

  /* ── Filtrado ── */
  const productosFiltrados = useMemo(() =>
    menuProductos.filter((p) => {
      const coincideCategoria = categoriaActiva === 'Todos' || p.categoria === categoriaActiva;
      const coincideBusqueda  = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      return coincideCategoria && coincideBusqueda;
    }),
    [categoriaActiva, busqueda, menuProductos]
  );

    const subtotal   = cart.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
    const propina    = conPropina ? Math.round(subtotal * 0.10) : 0;
    const domicilio  = esDomicilio ? (parseInt(String(costoDomicilio).replace(/\D/g, '')) || 0) : 0;
    const total      = subtotal + propina + domicilio;
  const totalItems = cart.reduce((acc, i) => acc + i.cantidad, 0);

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════ */
  return (
    <div data-theme={theme} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ── TICKET INVISIBLE (Solo Imprime) ── */}
      {isReprinting && ultimoRecibo ? (
        <TicketImpresion cart={ultimoRecibo.cart} total={ultimoRecibo.total} ordenNumero={ultimoRecibo.ordenNumero}
          fechaHora={ultimoRecibo.fechaHora} tipoPago={ultimoRecibo.tipoPago} esDomicilio={ultimoRecibo.esDomicilio}
          propina={ultimoRecibo.propina} costoDomicilio={ultimoRecibo.costoDomicilio || 0}
          mesa={ultimoRecibo.mesa} montoEntregado={ultimoRecibo.montoEntregado} isCopia={true} 
          pagoActual={ultimoRecibo.pagoActual} montoPagadoHistorico={ultimoRecibo.montoPagadoHistorico} />
      ) : (
        <TicketImpresion cart={cart} total={total} ordenNumero={ordenActivaNum || ordenNumero}
          fechaHora={fechaHora} tipoPago={tipoPago} esDomicilio={esDomicilio}
          propina={propina} costoDomicilio={esDomicilio ? (parseInt(String(costoDomicilio).replace(/\D/g, '')) || 0) : 0}
          mesa={mesa} montoEntregado={tipoPago === 'efectivo' ? (parseInt(montoEntregado.toString().replace(/\D/g, '')) || 0) : 0} isCopia={false}
          pagoActual={facturarAhorita ? (parseInt(String(montoAbonar).replace(/\D/g, '')) || (total - montoPagadoHistorico)) : 0} montoPagadoHistorico={montoPagadoHistorico} />
      )}

      <ModalVariantes producto={productoVariante}
        onSeleccionar={handleSeleccionarVariante} onCerrar={() => setProductoVariante(null)} />

      <ModalComboBebida producto={productoCombo}
        onSeleccionar={handleSeleccionarCombo} onCerrar={() => setProductoCombo(null)} />


      {showCustomItem && (
        <ModalCustomItem 
          onSeleccionar={(item) => {
            handleAgregar(item);
            setShowCustomItem(false);
          }} 
          onCerrar={() => setShowCustomItem(false)} 
        />
      )}

      {/* Modal QR */}
      {showQR && <ModalQR onCerrar={() => setShowQR(false)} />}

      {showCuentas && (
        <ModalCuentas
          onCerrar={() => setShowCuentas(false)}
          onSeleccionar={(pedidoDB) => cargarPedidoEnCarrito(pedidoDB, 'cobrar')}
        />
      )}

      {/* Toast restauración */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl
                        shadow-2xl text-sm font-semibold text-white pointer-events-none"
          style={{ background: 'rgba(5,150,105,0.95)', backdropFilter: 'blur(8px)' }}>
          {toastMsg}
        </div>
      )}

      {/* Panel atajos */}
      {mostrarAtajos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--modal-overlay)' }}
          onClick={() => setMostrarAtajos(false)}>
          <div className="rounded-2xl p-6 shadow-2xl w-full max-w-sm"
            style={{ background: 'var(--bg-surf4)', border: '1px solid var(--border-1)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-1)' }}>⌨️ Atajos de teclado</h3>
              <button onClick={() => setMostrarAtajos(false)} className="text-sm px-2 py-1 rounded-lg"
                style={{ background: 'var(--bg-surf6)', color: 'var(--text-3)' }}>✕ Cerrar</button>
            </div>
            <div className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
              {[['Enter','Cobrar / Imprimir'],['Esc','Cerrar modal · Cancelar orden'],
                ['1 – 9','Cambiar de categoría'],['?','Mostrar / ocultar atajos']].map(([k, d]) => (
                <div key={k} className="flex items-center gap-3">
                  <kbd className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold"
                    style={{ background:'var(--bg-surf6)', border:'1px solid var(--border-2)',
                      color:'var(--text-1)', minWidth:'3.5rem', textAlign:'center' }}>{k}</kbd>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          LAYOUT PRINCIPAL
      ═══════════════════════════════════════════════════════════ */}
      <div className="no-print flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)' }}>

        {/* ─── ÁREA PRINCIPAL ─────────────────────────────────── */}
        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* ── Header ── */}
          <header className="flex items-center gap-3 px-4 sm:px-6 py-3 shrink-0 flex-wrap sm:flex-nowrap"
            style={{ background: 'var(--bg-surf1)', borderBottom: '1px solid var(--border-1)' }}>

            {/* Botón volver + Logo */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button onClick={() => navigate(mesaInfo ? '/mesas' : '/hub')}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center
                           text-sm transition-colors duration-150"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                title={mesaInfo ? 'Volver al diagrama de mesas' : 'Volver al Hub'}
              >←</button>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600
                              flex items-center justify-center text-base sm:text-lg shadow-md">🍕</div>
              <div className="hidden sm:block">
                <h1 className="text-base font-extrabold tracking-tight leading-none"
                  style={{ color: 'var(--text-1)' }}>Don Peñolinni POS</h1>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-4)' }}>Punto de Venta</p>
              </div>
              <h1 className="sm:hidden text-sm font-extrabold" style={{ color: 'var(--text-1)' }}>
                Don Peñolinni
              </h1>
            </div>

            {/* Buscador — crece para llenar espacio disponible */}
            <div className="relative flex-1 min-w-[120px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                style={{ color: 'var(--text-4)' }}>🔍</span>
              <input id="input-busqueda" type="text" placeholder="Buscar…"
                value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar producto"
                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(249,115,22,0.7)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-2)'; }} />
            </div>

            {/* Acciones de cabecera */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <div className="hidden lg:block text-right">
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{fechaHora}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-5)' }}>Bogotá D.C.</p>
              </div>
              
              {ultimoRecibo && (
                <button aria-label="Reimprimir último recibo" title="Reimprimir copia"
                  onClick={handleReimprimir}
                  className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl
                             text-base font-bold transition-colors duration-150"
                  style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                >
                  🖨️
                </button>
              )}
              {ultimoRecibo && (
                <button aria-label="Enviar última factura por WhatsApp" title="Enviar por WhatsApp"
                  onClick={handleEnviarWhatsApp}
                  className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl
                             text-base font-bold transition-colors duration-150"
                  style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
                >
                  💬
                </button>
              )}
              {/* Botón atajos (solo desktop) */}
              <button id="btn-atajos" aria-label="Atajos de teclado" title="Atajos [?]"
                onClick={() => setMostrarAtajos((v) => !v)}
                className="hidden lg:flex w-9 h-9 items-center justify-center rounded-xl
                           text-sm font-bold transition-colors duration-150"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-3)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}>?</button>
              {usuario?.rol !== 'mesero' && (
                <button aria-label="Cuentas Abiertas" title="Cuentas Abiertas"
                  onClick={() => setShowCuentas(true)}
                  className="hidden sm:flex w-9 h-9 items-center justify-center rounded-xl text-lg transition-colors duration-150"
                  style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}>
                  🧾
                </button>
              )}
              {/* Botón QR — conectar dispositivo */}
              <button
                id="btn-qr"
                aria-label="Conectar dispositivo por QR"
                title="Conectar tablet / celular"
                onClick={() => setShowQR(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl
                           text-base transition-colors duration-150"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}
              >
                📡
              </button>
              {/* Toggle tema */}
              <button id="btn-toggle-tema" aria-label="Cambiar tema"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-lg
                           transition-colors duration-150"
                style={{ background: 'var(--bg-surf6)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; }}>
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </header>

          {/* ── Filtros de categoría ── */}
          <div className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3"
            style={{ background: 'var(--bg-surf5)', borderBottom: '1px solid var(--border-1)' }}>
            <div className="flex flex-wrap gap-2">
              {categoriasMenu.map((cat, idx) => {
                const activo = categoriaActiva === cat.id;
                return (
                  <button key={cat.id}
                    id={`filtro-${cat.id.toLowerCase().replace(/\s+/g, '-')}`}
                    aria-label={`Filtrar por ${cat.id}`} aria-pressed={activo}
                    onClick={() => setCategoriaActiva(cat.id)}
                    title={idx < 9 ? `Atajo: tecla ${idx + 1}` : undefined}
                    className="flex items-center gap-1.5 sm:gap-2
                               px-3 sm:px-4 py-2 sm:py-2.5
                               rounded-full text-xs sm:text-sm
                               font-semibold whitespace-nowrap
                               transition-all duration-150 touch-manipulation select-none"
                    style={{
                      minHeight: '36px',
                      background: activo ? 'rgb(249,115,22)'          : 'transparent',
                      border:     activo ? '1px solid rgb(249,115,22)' : '1px solid var(--border-2)',
                      color:      activo ? '#fff'                      : 'var(--text-3)',
                      boxShadow:  activo ? '0 2px 14px rgba(249,115,22,0.35)' : 'none',
                    }}>
                    <span className="text-sm sm:text-base leading-none">{cat.emoji}</span>
                    <span>{cat.id}</span>
                    {idx < 9 && (
                      <span className="hidden lg:inline text-[10px] opacity-40 font-mono">
                        [{idx + 1}]
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Cuadrícula de productos ──
               pb-28 en mobile para que el FAB no tape la última fila */}
          <section className="flex-1 overflow-y-auto p-3 sm:p-5 pb-28 lg:pb-5">
            {cargando ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium" style={{ color: 'var(--text-4)' }}>Cargando menú...</p>
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3"
                style={{ color: 'var(--text-4)' }}>
                <span className="text-5xl">😔</span>
                <p className="text-base font-semibold">Sin resultados</p>
                <p className="text-sm">Intenta otra búsqueda o categoría</p>
              </div>
            ) : (
              /* Sin sidebar en mobile → más columnas disponibles */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {productosFiltrados.map((producto) => (
                  <ProductCard key={producto.id} producto={producto}
                    onAgregar={handleAgregar} onAbrirVariantes={setProductoVariante} onAbrirCombo={setProductoCombo} />
                ))}
              </div>
            )}
          </section>
        </main>

        {/* ─── SIDEBAR DESKTOP (oculto en mobile/tablet) ──────── */}
        <div className="hidden lg:flex lg:flex-col lg:h-screen lg:w-[340px] lg:min-w-[280px]">
          <CheckoutSidebar cart={cart} onIncrementar={handleIncrementar}
            onDecrementar={handleDecrementar} onCancelar={handleCancelar}
            onCobrar={handleCobrar} onEnviarCocina={handleEnviarCocina} isProcesando={isProcesando}
            tipoPago={tipoPago} setTipoPago={setTipoPago}
            esDomicilio={esDomicilio} setEsDomicilio={setEsDomicilio}
            costoDomicilio={costoDomicilio} setCostoDomicilio={setCostoDomicilio}
            conPropina={conPropina} setConPropina={setConPropina}
            mesa={mesa} setMesa={setMesa} mesaInfo={mesaInfo} edicionBloqueada={edicionBloqueada}
            cajaCerrada={cajaCerrada} puedeAbrirCaja={puedeAbrirCaja} onIrACaja={() => navigate('/estadisticas?tab=caja')}
            imprimirCopia={imprimirCopia} setImprimirCopia={setImprimirCopia}
            enviarWhatsapp={enviarWhatsapp} setEnviarWhatsapp={setEnviarWhatsapp}
            montoEntregado={montoEntregado} setMontoEntregado={setMontoEntregado}
            facturarAhorita={facturarAhorita} setFacturarAhorita={setFacturarAhorita}
            montoAbonar={montoAbonar} setMontoAbonar={setMontoAbonar}
            saldoRestante={total - montoPagadoHistorico} />
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════
          FAB MÓVIL — "Ver orden" (solo cuando hay ítems en el carrito)
          Visible únicamente en < lg (tablets y móviles)
      ═════════════════════════════════════════════════════════ */}
      {cart.length > 0 && (
        <button
          id="btn-ver-orden"
          aria-label={`Ver orden — ${totalItems} productos · ${formatCOP(total)}`}
          onClick={() => setCartDrawerOpen(true)}
          className="no-print fixed bottom-4 left-4 right-4 z-30 lg:hidden
                     flex items-center justify-between
                     px-5 py-3.5 rounded-2xl
                     font-bold text-white text-sm sm:text-base
                     shadow-xl transition-all duration-150 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgb(5,150,105), rgb(4,120,87))' }}
        >
          <span className="flex items-center gap-2">
            🛒
            <span>Ver orden</span>
            <span className="w-6 h-6 flex items-center justify-center rounded-full
                             bg-white/25 text-xs font-bold">
              {totalItems}
            </span>
          </span>
          <span className="text-lg font-extrabold tabular-nums">{formatCOP(total)}</span>
        </button>
      )}

      {/* ═════════════════════════════════════════════════════════
          DRAWER MÓVIL — El carrito desliza desde abajo
          Visible únicamente en < lg
      ═════════════════════════════════════════════════════════ */}
      {cartDrawerOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          {/* Overlay/backdrop */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.55)' }}
            onClick={() => setCartDrawerOpen(false)} />

          {/* Panel del drawer — desliza desde abajo, máximo 88vh */}
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl overflow-hidden"
            style={{
              maxHeight: '88vh',
              background: 'var(--bg-surf3)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
            }}
          >
            <CheckoutSidebar
              cart={cart}
              onIncrementar={handleIncrementar}
              onDecrementar={handleDecrementar}
              onCancelar={handleCancelar}
              onCobrar={handleCobrar}
              onEnviarCocina={handleEnviarCocina}
              isProcesando={isProcesando}
              tipoPago={tipoPago} setTipoPago={setTipoPago}
              esDomicilio={esDomicilio} setEsDomicilio={setEsDomicilio}
              costoDomicilio={costoDomicilio} setCostoDomicilio={setCostoDomicilio}
              conPropina={conPropina} setConPropina={setConPropina}
              mesa={mesa} setMesa={setMesa} mesaInfo={mesaInfo} edicionBloqueada={edicionBloqueada}
            cajaCerrada={cajaCerrada} puedeAbrirCaja={puedeAbrirCaja} onIrACaja={() => navigate('/estadisticas?tab=caja')}
              imprimirCopia={imprimirCopia} setImprimirCopia={setImprimirCopia}
              enviarWhatsapp={enviarWhatsapp} setEnviarWhatsapp={setEnviarWhatsapp}
              montoEntregado={montoEntregado} setMontoEntregado={setMontoEntregado}
              facturarAhorita={facturarAhorita} setFacturarAhorita={setFacturarAhorita}
              montoAbonar={montoAbonar} setMontoAbonar={setMontoAbonar}
              saldoRestante={total - montoPagadoHistorico}
              isDrawer
              onCerrar={() => setCartDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
