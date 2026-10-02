import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ChefHat, Receipt, ChevronRight, CircleDollarSign } from 'lucide-react'
import useMesas from '../store/useMesas'
import { mesasPorCobrar, tiempoTranscurrido } from '../utils/mesasDerivadas'
import { getPedido } from '../api/pedidos'
import ModalConfirm from '../components/ModalConfirm'
import { Card, PageHeader, EmptyState, Skeleton, StatusBadge, cn } from '../components/ui'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 sm:gap-4'

function Datos({ mesa }) {
  const tiempo = tiempoTranscurrido(mesa.pedido_inicio)
  return (
    <>
      <p className="text-ink text-lg font-bold">Mesa {mesa.numero}</p>
      {tiempo && (
        <p className="text-muted text-caption flex items-center gap-1 mt-0.5">
          <Clock className="size-3.5" aria-hidden="true" /> {tiempo}
        </p>
      )}
      <p className="text-ink text-2xl font-bold num mt-2">
        S/ {Number(mesa.pedido_total ?? 0).toFixed(2)}
      </p>
    </>
  )
}

function Titulo({ icon, tone, count, children }) {
  const Icon = icon
  return (
    <h2 className={cn('flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3', tone)}>
      <Icon className="size-4" aria-hidden="true" />
      {children}
      <span className="num text-caption text-muted normal-case tracking-normal">({count})</span>
    </h2>
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
        <PageHeader title="Por cobrar" subtitle="Toca una mesa lista para abrir su cuenta" />

        {cargando && mesas.length === 0 ? (
          <div className={GRID} aria-busy="true" aria-label="Cargando mesas">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-panel" />)}
          </div>
        ) : listas.length === 0 && enCocina.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title="No hay mesas por cobrar"
            description="Cuando una mesa tenga todo servido aparecerá aquí."
          />
        ) : (
          <div className="space-y-8">
            {listas.length > 0 && (
              <section aria-label="Listas para cobrar">
                <Titulo icon={Receipt} tone="text-success" count={listas.length}>Listas para cobrar</Titulo>
                <div className={GRID}>
                  {listas.map(mesa => (
                    <button
                      key={mesa.id}
                      type="button"
                      onClick={() => abrirCobro(mesa)}
                      disabled={!!abriendo}
                      aria-busy={abriendo === mesa.id || undefined}
                      className="bg-surface rounded-panel p-4 text-left border border-line hover:border-success/60 transition-colors active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 flex flex-col"
                    >
                      <StatusBadge tone="success" icon={Receipt} className="self-start mb-2">Lista para cobrar</StatusBadge>
                      <Datos mesa={mesa} />
                      <span className="mt-3 pt-3 border-t border-line flex items-center justify-between text-success font-semibold">
                        {abriendo === mesa.id ? 'Abriendo...' : 'Cobrar'}
                        <ChevronRight className="size-5" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {enCocina.length > 0 && (
              <section aria-label="En cocina">
                <Titulo icon={ChefHat} tone="text-warning" count={enCocina.length}>En cocina</Titulo>
                <div className={GRID}>
                  {enCocina.map(mesa => (
                    <Card key={mesa.id} className="p-4 flex flex-col">
                      <StatusBadge tone="warning" icon={ChefHat} className="self-start mb-2">
                        {mesa.items_pendientes} {mesa.items_pendientes === 1 ? 'ítem' : 'ítems'} en cocina
                      </StatusBadge>
                      <Datos mesa={mesa} />
                      <p className="text-muted text-caption mt-3 pt-3 border-t border-line">
                        Disponible para cobrar cuando termine
                      </p>
                    </Card>
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
