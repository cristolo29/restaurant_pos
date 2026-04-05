import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCategorias, getProductos } from '../api/productos'
import { getPedido, abrirPedido, agregarItem, cancelarPedido, cancelarItem } from '../api/pedidos'
import { liberarMesa } from '../api/mesas'
import useAuth from '../store/useAuth'

export default function Comanda() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const usuario = useAuth(s => s.usuario)
  const puedecobrar = usuario?.rol_nombre !== 'mozo'

  const [categorias, setCategorias] = useState([])
  const [productos, setProductos] = useState([])
  const [pedido, setPedido] = useState(state?.pedido || null)
  const [categoriaActiva, setCategoriaActiva] = useState(null)
  const [carrito, setCarrito] = useState([])        // items pendientes de enviar
  const [nota, setNota] = useState('')
  const [productoNota, setProductoNota] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const mesa = state?.mesa

  useEffect(() => {
    if (!state?.mesa) { navigate('/mesas'); return }
    Promise.all([getCategorias(), getProductos()]).then(([cats, prods]) => {
      setCategorias(cats)
      setProductos(prods)
      if (cats.length > 0) setCategoriaActiva(cats[0].id)
    })
  }, [])

  const recargarPedido = async () => {
    const data = await getPedido(pedido.id)
    setPedido(data)
  }

  // Agregar al carrito local
  const agregarAlCarrito = (producto, notaTexto = '', cambiarTab = true) => {
    if (cambiarTab) setTabActivo('pedido')
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === producto.id && i.nota === notaTexto)
      if (existe) {
        return prev.map(i =>
          i.producto_id === producto.id && i.nota === notaTexto
            ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * producto.precio }
            : i
        )
      }
      return [...prev, {
        _key: Date.now(),
        producto_id: producto.id,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        cantidad: 1,
        subtotal: Number(producto.precio),
        nota: notaTexto,
      }]
    })
    setProductoNota(null)
    setNota('')
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

  // Enviar carrito a cocina — crea el pedido si aún no existe
  const enviarACocina = async () => {
    if (carrito.length === 0) return
    setEnviando(true)
    try {
      let pedidoActual = pedido
      if (!pedidoActual) {
        pedidoActual = await abrirPedido(mesa.id, usuario.id)
        setPedido(pedidoActual)
      }
      await Promise.all(
        carrito.map(i => agregarItem(pedidoActual.id, i.producto_id, i.cantidad, i.nota))
      )
      setCarrito([])
      const data = await getPedido(pedidoActual.id)
      setPedido(data)
    } finally {
      setEnviando(false)
    }
  }

  // Cancelar item ya enviado
  const eliminarItemEnviado = async (item) => {
    if (!confirm(`¿Quitar "${item.nombre}" del pedido?`)) return
    await cancelarItem(item.id)
    await recargarPedido()
  }

  const anular = async () => {
    if (!confirm('¿Anular y liberar la mesa?')) return
    if (pedido) {
      await cancelarPedido(pedido.id)
    } else {
      await liberarMesa(mesa.id)
    }
    navigate('/mesas')
  }

  const irACobro = () => {
    if (carrito.length > 0 && !confirm('Tienes items sin enviar a cocina. ¿Continuar al cobro de todas formas?')) return
    navigate('/cobro', { state: { pedido, mesa } })
  }

  const [tabActivo, setTabActivo] = useState('carta') // 'carta' | 'pedido'

  const productosFiltrados = productos.filter(p => p.categoria_id === categoriaActiva)
  const itemsEnviados = pedido?.items?.filter(i => i.estado !== 'cancelado') || []
  const totalCarrito = carrito.reduce((s, i) => s + i.subtotal, 0)
  const totalEnviado = itemsEnviados.reduce((s, i) => s + i.subtotal, 0)
  const totalGeneral = totalCarrito + totalEnviado
  const totalItems   = carrito.length + itemsEnviados.length

  const estadoBadge = (estado) => {
    const map = {
      pendiente:       'bg-[#3f3f46] text-[#a1a1aa]',
      en_preparacion:  'bg-amber-900/40 text-amber-400',
      listo:           'bg-green-900/40 text-green-400',
      entregado:       'bg-blue-900/40 text-blue-400',
    }
    const labels = { pendiente: 'Pendiente', en_preparacion: 'En cocina', listo: '✓ Listo', entregado: 'Entregado' }
    return { cls: map[estado] || map.pendiente, label: labels[estado] || estado }
  }

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      {/* Header */}
      <header className="bg-[#27272a] px-6 py-4 flex justify-between items-center border-b border-[#3f3f46] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/mesas')}
            className="text-[#71717a] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#3f3f46]"
          >
            ← Mesas
          </button>
          <div className="w-px h-5 bg-[#3f3f46]" />
          <div>
            <span className="text-white font-bold">Mesa {mesa?.numero}</span>
            <span className="text-[#71717a] text-sm ml-2">
              {pedido ? `· Pedido #${pedido.id}` : '· Sin pedido aún'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={anular}
            className="border border-[#ef4444]/40 text-[#ef4444] px-3 py-1.5 rounded-lg text-sm hover:bg-[#ef4444]/10 transition-colors"
          >
            Anular
          </button>
          {puedecobrar && (
            <button
              onClick={irACobro}
              disabled={!pedido || itemsEnviados.length === 0}
              className="bg-[#f59e0b] text-black px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#d97706] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cobrar →
            </button>
          )}
        </div>
      </header>

      {/* Tabs — solo visible en móvil */}
      <div className="md:hidden flex border-b border-[#3f3f46] bg-[#27272a]">
        <button
          onClick={() => setTabActivo('carta')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors
            ${tabActivo === 'carta' ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]' : 'text-[#71717a]'}`}
        >
          Carta
        </button>
        <button
          onClick={() => setTabActivo('pedido')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors relative
            ${tabActivo === 'pedido' ? 'text-[#f59e0b] border-b-2 border-[#f59e0b]' : 'text-[#71717a]'}`}
        >
          Pedido
          {totalItems > 0 && (
            <span className="ml-1.5 bg-[#f59e0b] text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>

        {/* Panel izquierdo — Carta */}
        <div className={`flex-col flex-1 overflow-hidden border-r border-[#3f3f46]
          ${tabActivo === 'carta' ? 'flex' : 'hidden'} md:flex`}>

          {/* Categorías */}
          <div className="flex gap-2 px-4 py-3 border-b border-[#3f3f46] overflow-x-auto shrink-0">
            {categorias.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoriaActiva(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all font-medium
                  ${categoriaActiva === cat.id
                    ? 'bg-[#f59e0b] text-black'
                    : 'bg-[#3f3f46] text-[#a1a1aa] hover:text-white'
                  }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>

          {/* Productos */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 content-start">
            {productosFiltrados.map(prod => (
              <div key={prod.id} className="bg-[#27272a] border border-[#3f3f46] rounded-xl overflow-hidden hover:border-[#52525b] transition-colors">
                <button
                  onClick={() => agregarAlCarrito(prod, '', true)}
                  className="w-full p-4 text-left hover:bg-[#3f3f46] transition-colors"
                >
                  <p className="text-white font-medium text-sm leading-tight mb-1">{prod.nombre}</p>
                  <p className="text-[#f59e0b] font-bold text-base">S/ {Number(prod.precio).toFixed(2)}</p>
                </button>
                <button
                  onClick={() => setProductoNota(prod)}
                  className="w-full px-4 py-1.5 text-xs text-[#71717a] hover:text-[#a1a1aa] border-t border-[#3f3f46] transition-colors text-left"
                >
                  📝 Con nota
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Panel derecho — Pedido */}
        <div className={`flex-col bg-[#1f1f22] shrink-0 w-full md:w-80
          ${tabActivo === 'pedido' ? 'flex' : 'hidden'} md:flex`}>

          <div className="px-4 py-3 border-b border-[#3f3f46]">
            <p className="text-white font-semibold">Pedido actual</p>
            <p className="text-[#71717a] text-xs">{itemsEnviados.length} enviado(s) · {carrito.length} en carrito</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

            {/* Carrito local — pendiente de enviar */}
            {carrito.length > 0 && (
              <div>
                <p className="text-[#71717a] text-xs uppercase tracking-wider mb-2 px-1">Por enviar</p>
                <div className="flex flex-col gap-2">
                  {carrito.map(item => (
                    <div key={item._key} className="bg-[#27272a] border border-[#f59e0b]/30 rounded-xl p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.nombre}</p>
                          {item.nota && <p className="text-[#f59e0b] text-xs mt-0.5 truncate">📝 {item.nota}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => quitarDelCarrito(item._key)}
                            className="w-6 h-6 rounded-md bg-[#3f3f46] text-[#a1a1aa] hover:bg-[#ef4444]/20 hover:text-[#ef4444] text-xs transition-colors flex items-center justify-center"
                          >
                            −
                          </button>
                          <span className="text-white text-sm w-5 text-center">{item.cantidad}</span>
                          <button
                            onClick={() => agregarAlCarrito({ id: item.producto_id, nombre: item.nombre, precio: item.precio }, item.nota, false)}
                            className="w-6 h-6 rounded-md bg-[#3f3f46] text-[#a1a1aa] hover:bg-[#f59e0b]/20 hover:text-[#f59e0b] text-xs transition-colors flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-[#a1a1aa] text-xs mt-1">S/ {item.subtotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                {/* Botón enviar a cocina */}
                <button
                  onClick={enviarACocina}
                  disabled={enviando}
                  className="w-full mt-3 bg-[#f59e0b] text-black py-2.5 rounded-xl text-sm font-bold hover:bg-[#d97706] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {enviando ? 'Enviando...' : '🍳 Enviar a cocina'}
                </button>
              </div>
            )}

            {/* Items ya enviados */}
            {itemsEnviados.length > 0 && (
              <div>
                <p className="text-[#71717a] text-xs uppercase tracking-wider mb-2 px-1">En cocina / entregados</p>
                <div className="flex flex-col gap-2">
                  {itemsEnviados.map(item => {
                    const badge = estadoBadge(item.estado)
                    return (
                      <div key={item.id} className="bg-[#27272a] border border-[#3f3f46] rounded-xl p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.nombre}</p>
                            {item.nota && <p className="text-[#f59e0b] text-xs mt-0.5 truncate">📝 {item.nota}</p>}
                            <p className="text-[#71717a] text-xs mt-1">{item.cantidad}x · S/ {Number(item.subtotal).toFixed(2)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <button
                              onClick={() => eliminarItemEnviado(item)}
                              className="text-[#52525b] hover:text-[#ef4444] transition-colors text-xs px-1"
                              title="Quitar del pedido"
                            >
                              ✕
                            </button>
                            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {carrito.length === 0 && itemsEnviados.length === 0 && (
              <div className="flex-1 flex items-center justify-center py-16">
                <p className="text-[#3f3f46] text-sm text-center">Sin items.<br/>Selecciona productos de la carta.</p>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="border-t border-[#3f3f46] p-4">
            {carrito.length > 0 && (
              <div className="flex justify-between text-xs text-[#71717a] mb-1">
                <span>Por enviar</span>
                <span>S/ {totalCarrito.toFixed(2)}</span>
              </div>
            )}
            {itemsEnviados.length > 0 && (
              <div className="flex justify-between text-xs text-[#71717a] mb-1">
                <span>En cocina</span>
                <span>S/ {totalEnviado.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 mb-3">
              <span className="text-[#a1a1aa] text-sm">Total</span>
              <span className="text-white text-xl font-bold">S/ {totalGeneral.toFixed(2)}</span>
            </div>
            {puedecobrar ? (
              <button
                onClick={irACobro}
                disabled={!pedido || itemsEnviados.length === 0}
                className="w-full bg-[#f59e0b] text-black py-3 rounded-xl font-bold hover:bg-[#d97706] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Ir a cobrar
              </button>
            ) : (
              <p className="text-center text-[#52525b] text-xs py-2">Solo el cajero puede cobrar</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal nota */}
      {productoNota && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-1">{productoNota.nombre}</h3>
            <p className="text-[#71717a] text-sm mb-4">Agrega una nota para cocina (opcional)</p>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Ej: sin cebolla, término medio..."
              className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl p-3 text-white text-sm placeholder-[#71717a] resize-none focus:outline-none focus:border-[#f59e0b] transition-colors"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setProductoNota(null); setNota('') }}
                className="flex-1 bg-[#3f3f46] text-[#a1a1aa] py-2.5 rounded-xl text-sm hover:bg-[#52525b] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => agregarAlCarrito(productoNota, nota, true)}
                className="flex-1 bg-[#f59e0b] text-black py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d97706] transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
