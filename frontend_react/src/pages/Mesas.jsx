import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Armchair, BellRing, Banknote, ChefHat, Clock, RefreshCw, UserRound, Users, UtensilsCrossed } from 'lucide-react'
import useMesas from '../store/useMesas'
import useAuth from '../store/useAuth'
import { tiempoTranscurrido } from '../utils/mesasDerivadas'
import { estadoMesa } from '../utils/estadoMesa'
import { ocuparMesa, getSalonesActivos } from '../api/mesas'
import { getPedidoAbierto } from '../api/pedidos'
import ModalConfirm from '../components/ModalConfirm'
import { Chip, EmptyState, PageHeader, Skeleton, Button, cn } from '../components/ui'

const VISUAL = {
  libre:     { icono: Armchair,        tarjeta: 'border-line hover:border-success/60',                 texto: 'text-success' },
  ocupada:   { icono: UtensilsCrossed, tarjeta: 'border-warning/40 bg-warning/5 hover:border-warning', texto: 'text-warning' },
  enCocina:  { icono: ChefHat,         tarjeta: 'border-warning/40 bg-warning/5 hover:border-warning', texto: 'text-warning' },
  porCobrar: { icono: Banknote,        tarjeta: 'border-info/50 bg-info/10 hover:border-info',         texto: 'text-blue-300' },
  listo:     { icono: BellRing,        tarjeta: 'border-success bg-success/10 ring-1 ring-success/40', texto: 'text-success' },
}

function TarjetaMesa({ mesa, ocupando, bloqueada, onClick }) {
  const estado = estadoMesa(mesa)
  const v = VISUAL[estado.id]
  const Icono = v.icono
  const libre = estado.id === 'libre'
  const tiempo = !libre ? tiempoTranscurrido(mesa.pedido_inicio) : null
  const total = Number(mesa.pedido_total)

  return (
    <button
      onClick={onClick}
      disabled={bloqueada}
      aria-label={`Mesa ${mesa.numero}, ${estado.etiqueta}${tiempo ? `, ${tiempo}` : ''}`}
      className={cn(
        'relative flex flex-col items-center gap-1.5 bg-surface rounded-panel border p-4 min-h-36 text-center transition-all active:scale-[0.97] disabled:cursor-wait',
        v.tarjeta,
        bloqueada && !ocupando && 'opacity-60',
      )}
    >
      {ocupando ? (
        <RefreshCw className="size-6 text-muted animate-spin my-auto" aria-label="Abriendo mesa" />
      ) : (
        <>
          <span className={cn('inline-flex items-center gap-1.5 text-caption font-semibold', v.texto)}>
            <Icono className="size-4" aria-hidden="true" />
            {estado.etiqueta}
          </span>
          <span className="num text-4xl font-bold text-ink leading-none my-1">{mesa.numero}</span>
          {libre ? (
            <span className="inline-flex items-center gap-1 text-caption text-muted">
              <Users className="size-4" aria-hidden="true" />
              {mesa.capacidad} personas
            </span>
          ) : (
            <span className="flex flex-col items-center gap-0.5 text-caption">
              {tiempo && (
                <span className="inline-flex items-center gap-1 text-soft num">
                  <Clock className="size-4" aria-hidden="true" />
                  {tiempo}
                </span>
              )}
              {total > 0 && <span className="num font-semibold text-ink">S/ {total.toFixed(2)}</span>}
            </span>
          )}
        </>
      )}
    </button>
  )
}

export default function Mesas() {
  const mesas = useMesas(s => s.mesas)
  const cargando = useMesas(s => s.cargando)
  const cargar = useMesas(s => s.cargar)
  const usuario = useAuth(s => s.usuario)
  const [mesaActiva, setMesaActiva] = useState(null)
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [salones, setSalones] = useState([])
  const navigate = useNavigate()

  const esMozo = usuario?.rol_nombre === 'mozo'

  useEffect(() => {
    getSalonesActivos().then(setSalones).catch(() => setSalones([]))
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
      setModal({
        titulo: 'No se pudo abrir la mesa',
        mensaje: e.response?.data?.detail || 'Ocurrió un error inesperado. Inténtalo de nuevo.',
        labelConfirm: 'Entendido',
        colorConfirm: 'warning',
        soloAviso: true,
        onConfirm: () => {},
      })
    } finally {
      setMesaActiva(null)
    }
  }

  const conteo = useMemo(() => {
    const c = { todas: mesas.length, libres: 0, ocupadas: 0, porCobrar: 0, listos: 0, mias: 0 }
    for (const m of mesas) {
      const e = estadoMesa(m).id
      if (e === 'libre') c.libres++
      else c.ocupadas++
      if (e === 'porCobrar') c.porCobrar++
      if (e === 'listo') c.listos++
      if (m.mozo_id != null && m.mozo_id === usuario?.id && e !== 'libre') c.mias++
    }
    return c
  }, [mesas, usuario?.id])

  const filtros = [
    { id: 'todas', label: 'Todas', count: conteo.todas },
    { id: 'libres', label: 'Libres', count: conteo.libres },
    { id: 'ocupadas', label: 'Ocupadas', count: conteo.ocupadas },
    { id: 'porCobrar', label: 'Por cobrar', count: conteo.porCobrar },
    ...(esMozo ? [{ id: 'mias', label: 'Mis mesas', count: conteo.mias }] : []),
  ]

  const visibles = mesas.filter(m => {
    const e = estadoMesa(m).id
    switch (filtro) {
      case 'libres': return e === 'libre'
      case 'ocupadas': return e !== 'libre'
      case 'porCobrar': return e === 'porCobrar'
      case 'mias': return e !== 'libre' && m.mozo_id === usuario?.id
      default: return true
    }
  })

  // Agrupar por salón solo si hay más de uno con mesas.
  // Orden estable: salones por id, mesas por número (desempate por id).
  const grupos = useMemo(() => {
    const porSalon = new Map()
    for (const m of visibles) {
      if (!porSalon.has(m.salon_id)) porSalon.set(m.salon_id, [])
      porSalon.get(m.salon_id).push(m)
    }
    const ordenar = (lista) => [...lista].sort((a, b) =>
      String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }) || a.id - b.id)
    if (porSalon.size <= 1) return [{ id: 'unico', nombre: null, mesas: ordenar(visibles) }]
    return [...porSalon.entries()]
      .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
      .map(([id, lista]) => ({
        id,
        nombre: salones.find(s => s.id === id)?.nombre ?? (id == null ? 'Sin salón' : `Salón ${id}`),
        mesas: ordenar(lista),
      }))
  }, [visibles, salones])

  const grid = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:gap-4'

  return (
    <div className="min-h-dvh bg-app text-ink">
      <main className="p-4 sm:p-6">
        <PageHeader title="Mesas" subtitle="Toca una mesa para abrirla o continuar su pedido">
          {conteo.listos > 0 && (
            <span role="status" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-success bg-success/10 rounded-full px-3 py-1.5">
              <BellRing className="size-4" aria-hidden="true" />
              {conteo.listos} {conteo.listos > 1 ? 'mesas con platos listos' : 'mesa con platos listos'}
            </span>
          )}
          <Button variant="secondary" iconOnly icon={RefreshCw} onClick={cargar} aria-label="Actualizar mesas" />
        </PageHeader>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filtrar mesas">
          {filtros.map(f => (
            <Chip key={f.id} activo={filtro === f.id} count={f.count} onClick={() => setFiltro(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>

        {cargando ? (
          <div className={grid} aria-busy="true" aria-label="Cargando mesas">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-panel" />)}
          </div>
        ) : mesas.length === 0 ? (
          <EmptyState icon={Armchair} title="No hay mesas configuradas" description="Un administrador puede crearlas desde Admin → Mesas." />
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="Ninguna mesa coincide con el filtro"
            action={<Button variant="secondary" onClick={() => setFiltro('todas')}>Ver todas</Button>}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {grupos.map(g => (
              <section key={g.id} aria-label={g.nombre ?? 'Mesas'}>
                {g.nombre && <h2 className="text-soft font-semibold text-sm uppercase tracking-wider mb-3">{g.nombre}</h2>}
                <div className={grid}>
                  {g.mesas.map(mesa => (
                    <TarjetaMesa
                      key={mesa.id}
                      mesa={mesa}
                      ocupando={mesaActiva === mesa.id}
                      bloqueada={!!mesaActiva}
                      onClick={() => seleccionar(mesa)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
    </div>
  )
}
