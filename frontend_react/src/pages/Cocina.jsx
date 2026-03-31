import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../store/useAuth'
import api from '../api/client'

const FILTROS = [
  { id: 'todos',          label: 'Todos' },
  { id: 'pendiente',      label: 'Pendientes' },
  { id: 'en_preparacion', label: 'En preparación' },
  { id: 'listo',          label: 'Listos' },
]

const SIGUIENTE = { pendiente: 'en_preparacion', en_preparacion: 'listo' }

const BADGE = {
  pendiente:      { cls: 'bg-[#3f3f46] text-[#a1a1aa]',      label: '▶ Iniciar' },
  en_preparacion: { cls: 'bg-amber-900/50 text-amber-400',    label: '✓ Listo' },
  listo:          { cls: 'bg-green-900/50 text-green-400',    label: '✅ Entregar' },
}

export default function Cocina() {
  const [pedidos, setPedidos]       = useState([])
  const [filtro, setFiltro]         = useState('todos')
  const [sincronizado, setSincronizado] = useState(true)
  const [itemCargando, setItemCargando] = useState(null)
  const usuario  = useAuth(s => s.usuario)
  const cerrarSesion = useAuth(s => s.cerrarSesion)
  const navigate = useNavigate()

  const cargar = async () => {
    try {
      const mesas = await api.get('/api/mesas').then(r => r.data)
      const ocupadas = mesas.filter(m => m.estado === 'ocupada')
      const resultados = await Promise.all(
        ocupadas.map(m =>
          api.get(`/api/pedidos/mesa/${m.id}/abierto`)
            .then(r => ({ ...r.data, mesa_numero: m.numero }))
            .catch(() => null)
        )
      )
      setPedidos(resultados.filter(Boolean))
      setSincronizado(true)
    } catch {
      setSincronizado(false)
    }
  }

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, 8000)
    return () => clearInterval(intervalo)
  }, [])

  const avanzar = async (itemId, estadoActual) => {
    const siguiente = SIGUIENTE[estadoActual]
    if (!siguiente) return
    setItemCargando(itemId)
    try {
      await api.put(`/api/pedidos/items/${itemId}/estado`, { estado: siguiente })
      await cargar()
    } finally {
      setItemCargando(null)
    }
  }

  // Armar tickets filtrando por estado
  const tickets = pedidos.map(pedido => {
    const items = pedido.items.filter(i => {
      if (i.estado === 'entregado' || i.estado === 'cancelado') return false
      if (filtro === 'todos') return true
      return i.estado === filtro
    })
    return items.length > 0 ? { pedido, items } : null
  }).filter(Boolean)

  const totalPendientes = pedidos.reduce((s, p) =>
    s + p.items.filter(i => i.estado === 'pendiente').length, 0)

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      {/* Header */}
      <header className="bg-[#27272a] px-6 py-4 flex justify-between items-center border-b border-[#3f3f46] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center">
            🍳
          </div>
          <div>
            <span className="text-white font-bold">Cocina</span>
            {totalPendientes > 0 && (
              <span className="ml-2 bg-[#f59e0b] text-black text-xs font-bold px-2 py-0.5 rounded-full">
                {totalPendientes} pendiente{totalPendientes > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${sincronizado ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`} />
            <span className="text-xs text-[#71717a]">{sincronizado ? 'En vivo' : 'Sin conexión'}</span>
          </div>
          <span className="text-[#71717a] text-sm">{usuario?.nombre}</span>
          <button
            onClick={() => { cerrarSesion(); navigate('/login') }}
            className="text-[#71717a] hover:text-[#f59e0b] text-sm transition-colors px-2 py-1 rounded-lg hover:bg-[#f59e0b]/10"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="bg-[#27272a] border-b border-[#3f3f46] px-6 py-3 flex gap-2 overflow-x-auto">
        {FILTROS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap font-medium transition-all
              ${filtro === f.id
                ? 'bg-[#f59e0b] text-black'
                : 'bg-[#3f3f46] text-[#a1a1aa] hover:text-white'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tickets */}
      <main className="flex-1 p-5 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4 content-start">
        {tickets.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 gap-3">
            <span className="text-5xl">✅</span>
            <p className="text-[#52525b] text-base">Sin pedidos activos</p>
          </div>
        ) : (
          tickets.map(({ pedido, items }) => (
            <div key={pedido.id} className="bg-[#27272a] border border-[#3f3f46] rounded-2xl overflow-hidden">

              {/* Ticket header */}
              <div className="px-4 py-3 border-b border-[#3f3f46] flex justify-between items-center bg-[#1f1f22]">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-lg">Mesa {pedido.mesa_numero}</span>
                  <span className="text-[#52525b] text-xs">#{pedido.id}</span>
                </div>
                <span className="text-[#71717a] text-xs">{items.length} item{items.length > 1 ? 's' : ''}</span>
              </div>

              {/* Items */}
              <div className="divide-y divide-[#3f3f46]">
                {items.map(item => {
                  const badge = BADGE[item.estado] || BADGE.pendiente
                  const cargando = itemCargando === item.id
                  const esUltimo = item.estado === 'listo'
                  return (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="bg-[#3f3f46] text-white text-sm font-bold px-2.5 py-1 rounded-lg min-w-[36px] text-center">
                        {item.cantidad}x
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.nombre || 'Producto'}</p>
                        {item.nota && (
                          <p className="text-[#f59e0b] text-xs mt-0.5 truncate">📝 {item.nota}</p>
                        )}
                      </div>
                      <button
                        onClick={() => avanzar(item.id, item.estado)}
                        disabled={cargando || esUltimo}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50
                          ${esUltimo
                            ? 'bg-green-900/40 text-green-400 cursor-default'
                            : `${badge.cls} hover:opacity-80 cursor-pointer`
                          }`}
                      >
                        {cargando ? '...' : badge.label}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
