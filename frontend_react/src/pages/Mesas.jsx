import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../store/useAuth'
import { getMesas, ocuparMesa } from '../api/mesas'
import { getPedidoAbierto } from '../api/pedidos'

export default function Mesas() {
  const [mesas, setMesas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mesaActiva, setMesaActiva] = useState(null)
  const usuario = useAuth(s => s.usuario)
  const cerrarSesion = useAuth(s => s.cerrarSesion)
  const navigate = useNavigate()

  const cargar = async () => {
    try {
      const data = await getMesas()
      setMesas(data)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, 10000)
    return () => clearInterval(intervalo)
  }, [])

  const seleccionar = async (mesa) => {
    if (mesaActiva) return
    setMesaActiva(mesa.id)
    try {
      if (mesa.estado === 'disponible') {
        await ocuparMesa(mesa.id)
        navigate('/comanda', { state: { pedido: null, mesa } })
      } else {
        let pedido = null
        try {
          pedido = await getPedidoAbierto(mesa.id)
        } catch (e) {
          if (e.response?.status !== 404) throw e
        }
        navigate('/comanda', { state: { pedido, mesa } })
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Error al abrir mesa')
    } finally {
      setMesaActiva(null)
    }
  }

  const disponibles = mesas.filter(m => m.estado === 'disponible').length
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length

  const iniciales = usuario?.nombre
    ?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      {/* Header */}
      <header className="bg-[#27272a] px-6 py-4 flex justify-between items-center border-b border-[#3f3f46] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center text-sm">
            🍽️
          </div>
          <span className="text-white font-bold text-lg">Orbezo</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-white text-sm font-medium">{usuario?.nombre}</p>
            <p className="text-[#71717a] text-xs capitalize">{usuario?.rol_nombre}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#f59e0b] text-sm font-bold">
            {iniciales}
          </div>
          <button
            onClick={() => { cerrarSesion(); navigate('/login') }}
            className="text-[#71717a] hover:text-[#f59e0b] text-sm transition-colors px-2 py-1 rounded-lg hover:bg-[#f59e0b]/10"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="p-6 flex-1">
        {/* Título + stats */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Mesas</h2>
            <p className="text-[#71717a] text-sm mt-1">Selecciona una mesa para comenzar</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className="bg-[#27272a] border border-[#22c55e]/20 rounded-xl px-4 py-2 text-center">
                <p className="text-[#22c55e] text-lg font-bold">{disponibles}</p>
                <p className="text-[#71717a] text-xs">Libres</p>
              </div>
              <div className="bg-[#27272a] border border-[#f59e0b]/20 rounded-xl px-4 py-2 text-center">
                <p className="text-[#f59e0b] text-lg font-bold">{ocupadas}</p>
                <p className="text-[#71717a] text-xs">Ocupadas</p>
              </div>
            </div>
            <button
              onClick={cargar}
              className="bg-[#27272a] border border-[#3f3f46] text-[#a1a1aa] px-3 py-2 rounded-xl text-sm hover:text-white hover:border-[#52525b] transition-all"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Grid */}
        {cargando ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-[#52525b] text-sm">Cargando mesas...</div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {mesas.map(mesa => {
              const libre = mesa.estado === 'disponible'
              const loading = mesaActiva === mesa.id
              return (
                <button
                  key={mesa.id}
                  onClick={() => seleccionar(mesa)}
                  disabled={!!mesaActiva}
                  className={`group relative bg-[#27272a] rounded-2xl p-6 text-center border transition-all duration-200 hover:-translate-y-1 disabled:cursor-wait
                    ${libre
                      ? 'border-[#3f3f46] hover:border-[#22c55e]/50 hover:bg-[#27272a] hover:shadow-lg hover:shadow-[#22c55e]/10'
                      : 'border-[#3f3f46] hover:border-[#f59e0b]/50 hover:bg-[#27272a] hover:shadow-lg hover:shadow-[#f59e0b]/10'
                    }`}
                >
                  <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${libre ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />

                  {loading ? (
                    <div className="text-[#71717a] text-2xl py-2">...</div>
                  ) : (
                    <>
                      <div className="text-4xl font-bold text-white mb-2">{mesa.numero}</div>
                      <div className={`text-xs uppercase tracking-widest font-semibold mb-1
                        ${libre ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
                        {libre ? 'Disponible' : 'Ocupada'}
                      </div>
                      <div className="text-xs text-[#52525b]">{mesa.capacidad} personas</div>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
