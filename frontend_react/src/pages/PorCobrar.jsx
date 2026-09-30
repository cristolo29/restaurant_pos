import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useMesas from '../store/useMesas'
import { mesasPorCobrar, tiempoTranscurrido } from '../utils/mesasDerivadas'
import { getPedido } from '../api/pedidos'
import ModalConfirm from '../components/ModalConfirm'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-4'

function Datos({ mesa }) {
  const tiempo = tiempoTranscurrido(mesa.pedido_inicio)
  return (
    <>
      <div className="text-3xl sm:text-4xl font-bold text-white mb-1.5">{mesa.numero}</div>
      {tiempo && <div className="text-xs text-[#f59e0b] font-medium">{tiempo}</div>}
      <div className="text-xs text-[#a1a1aa] mt-0.5">
        S/ {Number(mesa.pedido_total).toFixed(2)}
      </div>
    </>
  )
}

export default function PorCobrar() {
  const mesas = useMesas(s => s.mesas)
  const cargando = useMesas(s => s.cargando)
  const [abriendo, setAbriendo] = useState(null)
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()

  const { listas, enCocina } = mesasPorCobrar(mesas)

  const abrirCobro = async (mesa) => {
    if (abriendo) return
    setAbriendo(mesa.id)
    try {
      const pedido = await getPedido(mesa.pedido_id)
      navigate('/cobro', { state: { pedido, mesa } })
    } catch (e) {
      setModal({
        titulo: 'Error al abrir el cobro',
        mensaje: e.response?.data?.detail || 'Ocurrió un error inesperado.',
        labelConfirm: 'Entendido',
        colorConfirm: 'danger',
        onConfirm: () => {},
      })
    } finally {
      setAbriendo(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">
      <main className="p-4 sm:p-6 flex-1">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-5 sm:mb-8">Por cobrar</h2>

        {cargando && mesas.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-[#52525b] text-sm">Cargando...</div>
          </div>
        ) : listas.length === 0 && enCocina.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-[#52525b] text-sm">No hay mesas por cobrar</p>
          </div>
        ) : (
          <div className="space-y-8">
            {listas.length > 0 && (
              <section>
                <h3 className="text-[#22c55e] text-sm font-semibold uppercase tracking-widest mb-3">
                  Listas para cobrar
                </h3>
                <div className={GRID}>
                  {listas.map(mesa => (
                    <button
                      key={mesa.id}
                      onClick={() => abrirCobro(mesa)}
                      disabled={!!abriendo}
                      className="bg-[#27272a] rounded-2xl p-4 sm:p-6 text-center border border-[#3f3f46] hover:border-[#22c55e]/50 hover:shadow-lg hover:shadow-[#22c55e]/10 transition-all duration-200 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Datos mesa={mesa} />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {enCocina.length > 0 && (
              <section>
                <h3 className="text-[#f59e0b] text-sm font-semibold uppercase tracking-widest mb-3">
                  En cocina
                </h3>
                <div className={GRID}>
                  {enCocina.map(mesa => (
                    <div
                      key={mesa.id}
                      className="bg-[#27272a] rounded-2xl p-4 sm:p-6 text-center border border-[#3f3f46] opacity-50"
                    >
                      <Datos mesa={mesa} />
                      <div className="text-xs text-[#71717a] mt-1">
                        {mesa.items_pendientes} ítems en cocina
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
    </div>
  )
}
