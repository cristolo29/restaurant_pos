import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useMesas from '../store/useMesas'
import useAuth from '../store/useAuth'
import { mesasDelMozo, tiempoTranscurrido } from '../utils/mesasDerivadas'
import { getPedido } from '../api/pedidos'
import ModalConfirm from '../components/ModalConfirm'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-4'

export default function MisPedidos() {
  const mesas = useMesas(s => s.mesas)
  const cargando = useMesas(s => s.cargando)
  const usuario = useAuth(s => s.usuario)
  const [abriendo, setAbriendo] = useState(null)
  const [modal, setModal] = useState(null)
  const navigate = useNavigate()

  const misMesas = mesasDelMozo(mesas, usuario.id)

  const abrirMesa = async (mesa) => {
    if (abriendo) return
    setAbriendo(mesa.id)
    try {
      const pedido = await getPedido(mesa.pedido_id)
      navigate('/comanda', { state: { pedido, mesa } })
    } catch (e) {
      setModal({
        titulo: 'Error al abrir la mesa',
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
    <div className="bg-[#18181b] text-white">
      <main className="p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-5 sm:mb-8">Mis pedidos</h2>

        {cargando && mesas.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-[#52525b] text-sm">Cargando...</div>
          </div>
        ) : misMesas.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-[#52525b] text-sm">No tienes pedidos abiertos</p>
          </div>
        ) : (
          <div className={GRID}>
            {misMesas.map(mesa => {
              const tiempo = tiempoTranscurrido(mesa.pedido_inicio)
              return (
                <button
                  key={mesa.id}
                  onClick={() => abrirMesa(mesa)}
                  disabled={abriendo !== null}
                  className="bg-[#27272a] rounded-2xl p-4 sm:p-6 text-center border border-[#3f3f46] hover:border-[#f59e0b]/50 hover:shadow-lg hover:shadow-[#f59e0b]/10 transition-all duration-200 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                >
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1.5">{mesa.numero}</div>
                  {tiempo && <div className="text-xs text-[#f59e0b] font-medium">{tiempo}</div>}
                  <div className="text-xs text-[#a1a1aa] mt-0.5">
                    S/ {Number(mesa.pedido_total ?? 0).toFixed(2)}
                  </div>
                  {mesa.items_listos > 0 && (
                    <div className="inline-block mt-2 px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] text-xs font-semibold">
                      {mesa.items_listos} listos
                    </div>
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
