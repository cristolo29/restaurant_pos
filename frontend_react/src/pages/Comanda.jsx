import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getCategorias, getProductos } from '../api/productos'
import { getPedido, abrirPedido, agregarItem, cancelarPedido, cancelarItem } from '../api/pedidos'
import { liberarMesa } from '../api/mesas'
import useAuth from '../store/useAuth'
import { toast } from '../store/useToast'
import ModalConfirm from '../components/ModalConfirm'
import { Button, cn } from '../components/ui'
import CartaProductos from './comanda/CartaProductos'
import PanelPedido from './comanda/PanelPedido'
import ModalNota from './comanda/ModalNota'

export default function Comanda() {
  const { state } = useLocation()
  const navigate  = useNavigate()
  const usuario   = useAuth(s => s.usuario)
  const puedecobrar = usuario?.rol_nombre !== 'mozo'

  const [categorias, setCategorias]       = useState([])
  const [productos, setProductos]         = useState([])
  const [cargandoCarta, setCargandoCarta] = useState(true)
  const [pedido, setPedido]               = useState(state?.pedido || null)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [busqueda, setBusqueda]           = useState('')
  const [carrito, setCarrito]             = useState([])
  const [productoNota, setProductoNota]   = useState(null)
  const [enviando, setEnviando]           = useState(false)
  const [modal, setModal]                 = useState(null)
  const [tabActivo, setTabActivo]         = useState('carta')
  const contadorKey = useRef(0)

  const mesa = state?.mesa

  useEffect(() => {
    if (!state?.mesa) { navigate('/mesas'); return }
    Promise.all([getCategorias(), getProductos()])
      .then(([cats, prods]) => {
        setCategorias(cats)
        setProductos(prods)
        if (cats.length > 0) setCategoriaActiva(cats[0].id)
      })
      .catch(() => toast.error('No se pudo cargar la carta. Revisa la conexión y vuelve a intentarlo.'))
      .finally(() => setCargandoCarta(false))
  }, [])

  const recargarPedido = async () => {
    const data = await getPedido(pedido.id)
    setPedido(data)
  }

  useEffect(() => {
    if (!pedido?.id) return
    const intervalo = setInterval(async () => {
      try {
        const data = await getPedido(pedido.id)
        setPedido(data)
      } catch { /* ignorar silenciosamente */ }
    }, 15000)
    return () => clearInterval(intervalo)
  }, [pedido?.id])

  const agregarAlCarrito = (producto, notaTexto = '', cambiarTab = false) => {
    if (cambiarTab) setTabActivo('pedido')
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === producto.id && i.nota === notaTexto)
      if (existe) {
        return prev.map(i =>
          i.producto_id === producto.id && i.nota === notaTexto
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * Number(producto.precio) }
            : i
        )
      }
      return [...prev, {
        _key: ++contadorKey.current,
        producto_id: producto.id,
        nombre:      producto.nombre,
        precio:      Number(producto.precio),
        cantidad:    1,
        subtotal:    Number(producto.precio),
        nota:        notaTexto,
      }]
    })
    setProductoNota(null)
  }

  const quitarDelCarrito = (key) => {
    setCarrito(prev => {
      const item = prev.find(i => i._key === key)
      if (!item) return prev
      if (item.cantidad > 1) {
        return prev.map(i => i._key === key
          ? { ...i, cantidad: i.cantidad - 1, subtotal: (i.cantidad - 1) * i.precio }
          : i
        )
      }
      return prev.filter(i => i._key !== key)
    })
  }

  // Envía ítem por ítem y retira del carrito lo ya enviado: si algo falla a mitad,
  // un reintento no duplica en cocina lo que ya llegó.
  const enviarACocina = async () => {
    if (carrito.length === 0 || enviando) return
    setEnviando(true)
    let pedidoActual = pedido
    let enviados = 0
    try {
      if (!pedidoActual) {
        pedidoActual = await abrirPedido(mesa.id, usuario.id)
        setPedido(pedidoActual)
      }
      for (const i of carrito) {
        await agregarItem(pedidoActual.id, i.producto_id, i.cantidad, i.nota)
        setCarrito(prev => prev.filter(x => x._key !== i._key))
        enviados++
      }
      setPedido(await getPedido(pedidoActual.id))
      toast.exito(enviados === 1 ? 'Enviado a cocina' : `${enviados} productos enviados a cocina`)
    } catch (e) {
      if (pedidoActual?.id) { try { setPedido(await getPedido(pedidoActual.id)) } catch { /* sin red */ } }
      const falta = carrito.length - enviados
      const detalle = e.response?.data?.detail
      toast.error(
        enviados > 0
          ? `Solo se enviaron ${enviados}. Faltan ${falta} en "Por enviar": revisa e inténtalo de nuevo.`
          : (typeof detalle === 'string' ? detalle : 'No se pudo enviar a cocina. Tu pedido sigue aquí: inténtalo de nuevo.')
      )
    } finally {
      setEnviando(false)
    }
  }

  const eliminarItemEnviado = (item) => {
    setModal({
      titulo: '¿Quitar del pedido?',
      mensaje: `"${item.nombre}" será cancelado y cocina dejará de prepararlo.`,
      labelConfirm: 'Quitar',
      colorConfirm: 'danger',
      pedirMotivo: true,
      onConfirm: async (motivo) => {
        await cancelarItem(item.id, motivo)
        await recargarPedido()
      },
    })
  }

  const anular = () => {
    setModal({
      titulo: '¿Anular pedido?',
      mensaje: `Se cancelará todo el pedido de la Mesa ${mesa?.numero} y la mesa quedará disponible.`,
      labelConfirm: 'Anular pedido',
      colorConfirm: 'danger',
      pedirMotivo: true,
      onConfirm: async (motivo) => {
        if (pedido) await cancelarPedido(pedido.id, motivo)
        else        await liberarMesa(mesa.id)
        navigate('/mesas')
      },
    })
  }

  const volver = async () => {
    try {
      const actual = pedido ? await getPedido(pedido.id) : null
      const hayOrden = actual?.items?.some(i => i.estado !== 'cancelado')
      if (!hayOrden) {
        if (actual) await cancelarPedido(actual.id, 'Pedido vacío: se salió de la comanda sin enviar ítems')
        else        await liberarMesa(mesa.id)
      }
    } catch { /* no bloquear la navegación */ }
    navigate('/mesas')
  }

  const irACobro = () => {
    const enCocina = itemsEnviados.filter(i => i.estado === 'pendiente' || i.estado === 'en_preparacion')
    if (enCocina.length > 0) {
      setModal({
        titulo: 'Ítems aún en cocina',
        mensaje: `Hay ${enCocina.length} ítem(s) que aún no están listos. Espera a que cocina los marque como listos antes de cobrar.`,
        labelConfirm: 'Entendido',
        colorConfirm: 'warning',
        soloAviso: true,
        onConfirm: () => {},
      })
      return
    }
    if (carrito.length > 0) {
      setModal({
        titulo: 'Ítems sin enviar',
        mensaje: 'Tienes ítems en "Por enviar" que no fueron enviados a cocina. ¿Continuar al cobro de todas formas?',
        labelConfirm: 'Continuar',
        colorConfirm: 'warning',
        onConfirm: () => navigate('/cobro', { state: { pedido, mesa } }),
      })
      return
    }
    navigate('/cobro', { state: { pedido, mesa } })
  }

  const productosFiltrados = busqueda.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : productos.filter(p => p.categoria_id === categoriaActiva)

  const itemsEnviados = pedido?.items?.filter(i => i.estado !== 'cancelado') || []
  const totalCarrito  = carrito.reduce((s, i) => s + i.subtotal, 0)
  const totalEnviado  = itemsEnviados.reduce((s, i) => s + Number(i.subtotal), 0)
  const totalGeneral  = totalCarrito + totalEnviado
  const totalItems    = carrito.length + itemsEnviados.length
  const listos        = itemsEnviados.filter(i => i.estado === 'listo').length

  // Reglas de anulación (el backend es la autoridad; aquí solo se evita ofrecer lo que rechazaría)
  const rol = usuario?.rol_nombre
  const esMozo = rol === 'mozo'
  const sinPermiso = rol !== 'mozo' && rol !== 'cajero' && rol !== 'admin'
  const pedidoAjeno = esMozo && !!pedido && pedido.usuario_id !== usuario?.id
  const hayItemsEnCocina = itemsEnviados.some(i => i.estado !== 'pendiente')
  const motivoNoAnular = sinPermiso ? 'Tu rol no puede anular pedidos.'
    : !esMozo || !pedido ? ''
    : pedidoAjeno ? 'Solo puedes anular pedidos que abriste tú.'
    : hayItemsEnCocina ? 'Hay ítems enviados a cocina: pide a un cajero o administrador que anule el pedido.'
    : ''
  const motivoNoQuitar = (item) => sinPermiso ? 'Tu rol no puede quitar ítems.'
    : !esMozo ? ''
    : pedidoAjeno ? 'Solo puedes quitar ítems de tus pedidos.'
    : item.estado !== 'pendiente' ? 'Ya está en cocina: pide a un cajero o administrador que lo quite.'
    : ''

  const cantidadEnCarrito = (productoId) =>
    carrito.reduce((s, i) => (i.producto_id === productoId ? s + i.cantidad : s), 0)

  const tab = (id, label, count) => (
    <button
      role="tab"
      id={`tab-${id}`}
      aria-selected={tabActivo === id}
      aria-controls={`panel-${id}`}
      onClick={() => setTabActivo(id)}
      className={cn(
        'flex-1 min-h-12 inline-flex items-center justify-center gap-2 text-sm font-semibold border-b-2 transition-colors',
        tabActivo === id ? 'text-accent border-accent' : 'text-muted border-transparent',
      )}
    >
      {label}
      {count > 0 && (
        <span className={cn('num text-xs font-bold px-1.5 min-w-5 rounded-full', id === 'pedido' && listos > 0 ? 'bg-success text-on-accent' : 'bg-accent text-on-accent')}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <div className="h-dvh bg-app text-ink flex flex-col">

      <header className="bg-surface px-2 sm:px-4 min-h-16 flex items-center gap-2 border-b border-line shrink-0">
        <Button variant="ghost" iconOnly icon={ArrowLeft} onClick={volver} aria-label="Volver a mesas" />
        <div className="min-w-0">
          <h1 className="text-ink font-bold text-lg leading-tight truncate">Mesa {mesa?.numero}</h1>
          <p className="text-muted text-caption leading-tight truncate">
            {pedido ? `Pedido #${pedido.id}` : 'Pedido nuevo'}
            {mesa?.capacidad ? ` · ${mesa.capacidad} personas` : ''}
          </p>
        </div>
      </header>

      <div role="tablist" aria-label="Vista de la comanda" className="md:hidden flex border-b border-line bg-surface shrink-0">
        {tab('carta', 'Carta', 0)}
        {tab('pedido', 'Pedido', totalItems)}
      </div>

      <div className="flex flex-1 min-h-0">
        <section
          id="panel-carta"
          aria-label="Carta"
          className={cn('flex-col flex-1 min-w-0 border-r border-line', tabActivo === 'carta' ? 'flex' : 'hidden', 'md:flex')}
        >
          <CartaProductos
            cargando={cargandoCarta}
            categorias={categorias}
            categoriaActiva={categoriaActiva}
            onCategoria={setCategoriaActiva}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            productos={productosFiltrados}
            cantidadEnCarrito={cantidadEnCarrito}
            onAgregar={(p) => agregarAlCarrito(p)}
            onNota={setProductoNota}
          />
        </section>

        <section
          id="panel-pedido"
          aria-label="Pedido actual"
          className={cn('flex-col bg-sunken shrink-0 w-full md:w-96', tabActivo === 'pedido' ? 'flex' : 'hidden', 'md:flex')}
        >
          <PanelPedido
            carrito={carrito}
            enviados={itemsEnviados}
            totalCarrito={totalCarrito}
            totalEnviado={totalEnviado}
            totalGeneral={totalGeneral}
            enviando={enviando}
            puedeCobrar={puedecobrar}
            puedeIrACobro={!!pedido && itemsEnviados.length > 0}
            onMas={(item) => agregarAlCarrito({ id: item.producto_id, nombre: item.nombre, precio: item.precio }, item.nota)}
            onMenos={quitarDelCarrito}
            onEnviar={enviarACocina}
            onQuitarEnviado={eliminarItemEnviado}
            onCobrar={irACobro}
            onAnular={anular}
            motivoNoAnular={motivoNoAnular}
            motivoNoQuitar={motivoNoQuitar}
          />
        </section>
      </div>

      {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
      {productoNota && (
        <ModalNota
          producto={productoNota}
          onAgregar={(p, nota) => agregarAlCarrito(p, nota)}
          onCancelar={() => setProductoNota(null)}
        />
      )}
    </div>
  )
}
