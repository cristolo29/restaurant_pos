import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useMesas from '../store/useMesas'
import { tiempoTranscurrido } from '../utils/mesasDerivadas'
import { ocuparMesa } from '../api/mesas'
import { getPedidoAbierto } from '../api/pedidos'
import ModalConfirm from '../components/ModalConfirm'

export default function Mesas() {
  const mesas = useMesas(s => s.mesas)
  const cargando = useMesas(s => s.cargando)
  const cargar = useMesas(s => s.cargar)
  const [mesaActiva, setMesaActiva] = useState(null)
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()

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
      setModal({
        titulo: 'Error al abrir mesa',
        mensaje: e.response?.data?.detail || 'Ocurrió un error inesperado.',
        labelConfirm: 'Entendido',
        colorConfirm: 'danger',
        onConfirm: () => {},
      })
    } finally {
      setMesaActiva(null)
    }
  }

  const disponibles = mesas.filter(m => m.estado === 'disponible').length
  const ocupadas    = mesas.filter(m => m.estado === 'ocupada').length

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      <main className="p-4 sm:p-6 flex-1">

        {/* Título + stats — compacto en móvil */}
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Mesas</h2>
            <p className="text-[#71717a] text-xs sm:text-sm mt-0.5">Selecciona una mesa</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 sm:gap-2">
              <div className="bg-[#27272a] border border-[#22c55e]/20 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-center">
                <p className="text-[#22c55e] text-base sm:text-lg font-bold leading-none">{disponibles}</p>
                <p className="text-[#71717a] text-xs mt-0.5">Libres</p>
              </div>
              <div className="bg-[#27272a] border border-[#f59e0b]/20 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-center">
                <p className="text-[#f59e0b] text-base sm:text-lg font-bold leading-none">{ocupadas}</p>
                <p className="text-[#71717a] text-xs mt-0.5">Ocupadas</p>
              </div>
            </div>
            <button
              onClick={cargar}
              className="bg-[#27272a] border border-[#3f3f46] text-[#a1a1aa] w-9 h-9 rounded-xl text-base hover:text-white hover:border-[#52525b] transition-all flex items-center justify-center"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Grid de mesas */}
        {cargando ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-[#52525b] text-sm">Cargando mesas...</div>
          </div>
        ) : mesas.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-[#52525b] text-sm">No hay mesas configuradas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-4">
            {mesas.map(mesa => {
              const libre   = mesa.estado === 'disponible'
              const loading = mesaActiva === mesa.id
              return (
                <button
                  key={mesa.id}
                  onClick={() => seleccionar(mesa)}
                  disabled={!!mesaActiva}
                  className={`group relative bg-[#27272a] rounded-2xl p-4 sm:p-6 text-center border transition-all duration-200 active:scale-95 disabled:cursor-wait
                    ${libre
                      ? 'border-[#3f3f46] hover:border-[#22c55e]/50 hover:shadow-lg hover:shadow-[#22c55e]/10'
                      : 'border-[#3f3f46] hover:border-[#f59e0b]/50 hover:shadow-lg hover:shadow-[#f59e0b]/10'
                    }`}
                >
                  {/* Indicador de estado */}
                  <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${libre ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />

                  {loading ? (
                    <div className="text-[#71717a] text-xl py-3">···</div>
                  ) : (
                    <>
                      <div className="text-3xl sm:text-4xl font-bold text-white mb-1.5">{mesa.numero}</div>
                      <div className={`text-xs uppercase tracking-widest font-semibold mb-1
                        ${libre ? 'text-[#22c55e]' : 'text-[#f59e0b]'}`}>
                        {libre ? 'Libre' : 'Ocupada'}
                      </div>
                      {!libre && mesa.pedido_inicio ? (
                        <>
                          <div className="text-xs text-[#f59e0b] font-medium">
                            {tiempoTranscurrido(mesa.pedido_inicio)}
                          </div>
                          {mesa.pedido_total > 0 && (
                            <div className="text-xs text-[#a1a1aa] mt-0.5">
                              S/ {Number(mesa.pedido_total).toFixed(2)}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-xs text-[#52525b]">{mesa.capacidad} pers.</div>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </main>

      {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
    </div>
  )
}
