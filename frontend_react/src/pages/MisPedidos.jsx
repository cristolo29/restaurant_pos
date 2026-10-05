import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, BellRing, ChevronRight, ClipboardList } from 'lucide-react'
import useMesas from '../store/useMesas'
import useAuth from '../store/useAuth'
import { mesasDelMozo, tiempoTranscurrido } from '../utils/mesasDerivadas'
import { getPedido } from '../api/pedidos'
import ModalConfirm from '../components/ModalConfirm'
import { Button, PageHeader, EmptyState, Skeleton, StatusBadge, cn } from '../components/ui'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 sm:gap-4'

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
        soloAviso: true,
        onConfirm: () => {},
      })
    } finally {
      setAbriendo(null)
    }
  }

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col">
      <main className="p-4 sm:p-6 flex-1">
        <PageHeader title="Mis pedidos" subtitle="Los platos listos aparecen primero" />

        {cargando && mesas.length === 0 ? (
          <div className={GRID} aria-busy="true" aria-label="Cargando pedidos">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-panel" />)}
          </div>
        ) : misMesas.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No tienes pedidos abiertos"
            description="Abre una mesa desde el mapa de mesas para tomar un pedido."
            action={<Button variant="primary" onClick={() => navigate('/mesas')}>Ir a mesas</Button>}
          />
        ) : (
          <div className={GRID}>
            {misMesas.map(mesa => {
              const tiempo = tiempoTranscurrido(mesa.pedido_inicio)
              const listos = mesa.items_listos > 0
              return (
                <button
                  key={mesa.id}
                  type="button"
                  onClick={() => abrirMesa(mesa)}
                  disabled={abriendo !== null}
                  aria-busy={abriendo === mesa.id || undefined}
                  className={cn(
                    'bg-surface rounded-panel p-4 text-left border transition-colors active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 flex flex-col',
                    listos ? 'border-success/60' : 'border-line hover:border-line-strong',
                  )}
                >
                  {listos ? (
                    <StatusBadge tone="success" icon={BellRing} className="self-start mb-2">
                      {mesa.items_listos} {mesa.items_listos === 1 ? 'listo' : 'listos'} para servir
                    </StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" icon={ClipboardList} className="self-start mb-2">Pedido abierto</StatusBadge>
                  )}
                  <p className="text-ink text-lg font-bold">Mesa {mesa.numero}</p>
                  {tiempo && (
                    <p className="text-muted text-caption flex items-center gap-1 mt-0.5">
                      <Clock className="size-3.5" aria-hidden="true" /> {tiempo}
                    </p>
                  )}
                  <p className="text-ink text-2xl font-bold num mt-2">
                    S/ {Number(mesa.pedido_total ?? 0).toFixed(2)}
                  </p>
                  <span className={cn('mt-3 pt-3 border-t border-line flex items-center justify-between font-semibold', listos ? 'text-success' : 'text-soft')}>
                    {abriendo === mesa.id ? 'Abriendo...' : listos ? 'Servir y continuar' : 'Abrir pedido'}
                    <ChevronRight className="size-5" aria-hidden="true" />
                  </span>
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
