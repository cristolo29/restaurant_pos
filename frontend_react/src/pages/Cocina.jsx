import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCheck, ChefHat, Clock, CloudOff, Flame, LogOut, Play, StickyNote, Wifi } from 'lucide-react'
import useAuth from '../store/useAuth'
import api from '../api/client'
import { toast } from '../store/useToast'
import { Button, Chip, EmptyState, Skeleton, StatusBadge, cn } from '../components/ui'

const FILTROS = [
  { id: 'todos',          label: 'Todos' },
  { id: 'pendiente',      label: 'Pendientes' },
  { id: 'en_preparacion', label: 'En preparación' },
  { id: 'listo',          label: 'Listos' },
]

const SIGUIENTE = { pendiente: 'en_preparacion', en_preparacion: 'listo' }

// Acción que ejecuta el botón (verbo) y estado actual (etiqueta). Separados a propósito:
// el botón dice QUÉ HARÁS, la etiqueta dice EN QUÉ ESTÁ.
const ACCION = {
  pendiente:      { label: 'Iniciar',      icono: Play,      variante: 'secondary' },
  en_preparacion: { label: 'Marcar listo', icono: CheckCheck, variante: 'success' },
}
const ESTADO = {
  pendiente:      { label: 'Pendiente',      tono: 'neutral' },
  en_preparacion: { label: 'En preparación', tono: 'warning', icono: Flame },
  listo:          { label: 'Listo, esperando al mozo', tono: 'success', icono: CheckCheck },
}

const MIN_ALERTA = 10
const MIN_URGENTE = 20

function minutosDesde(iso, ahora) {
  if (!iso) return null
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000))
}

function tonoEspera(min) {
  if (min == null) return 'ok'
  if (min >= MIN_URGENTE) return 'urgente'
  if (min >= MIN_ALERTA) return 'alerta'
  return 'ok'
}

const ESTILO_ESPERA = {
  ok:      { barra: 'border-t-success', texto: 'text-success' },
  alerta:  { barra: 'border-t-warning', texto: 'text-warning' },
  urgente: { barra: 'border-t-danger',  texto: 'text-danger' },
}

function formatoEspera(min) {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export default function Cocina() {
  const [pedidos, setPedidos]       = useState([])
  const [filtro, setFiltro]         = useState('todos')
  const [sincronizado, setSincronizado] = useState(true)
  const [primeraCarga, setPrimeraCarga] = useState(true)
  const [itemCargando, setItemCargando] = useState(null)
  const [ahora, setAhora]           = useState(() => Date.now())
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
            .then(r => ({ ...r.data, mesa_numero: m.numero, inicio: m.pedido_inicio }))
            .catch(() => null)
        )
      )
      setPedidos(resultados.filter(Boolean))
      setSincronizado(true)
    } catch {
      setSincronizado(false)
    } finally {
      setPrimeraCarga(false)
    }
  }

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, 8000)
    return () => clearInterval(intervalo)
  }, [])

  // Reloj para los temporizadores de espera
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(reloj)
  }, [])

  const avanzar = async (itemId, estadoActual) => {
    const siguiente = SIGUIENTE[estadoActual]
    if (!siguiente) return
    setItemCargando(itemId)
    try {
      await api.put(`/api/pedidos/items/${itemId}/estado`, { estado: siguiente })
      await cargar()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo actualizar el ítem. Revisa la conexión e inténtalo de nuevo.')
    } finally {
      setItemCargando(null)
    }
  }

  const activos = (pedido) => pedido.items.filter(i => i.estado !== 'entregado' && i.estado !== 'cancelado')

  const conteo = { todos: 0, pendiente: 0, en_preparacion: 0, listo: 0 }
  for (const p of pedidos) {
    for (const i of activos(p)) {
      conteo.todos++
      if (conteo[i.estado] != null) conteo[i.estado]++
    }
  }

  // Tickets filtrados, los más antiguos primero (lo que lleva más tiempo esperando)
  const tickets = pedidos
    .map(pedido => {
      const items = activos(pedido).filter(i => filtro === 'todos' || i.estado === filtro)
      return items.length > 0 ? { pedido, items } : null
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.pedido.inicio ?? 0) - new Date(b.pedido.inicio ?? 0))

  return (
    <div className="min-h-dvh bg-app text-ink flex flex-col">

      <header className="bg-sunken px-4 sm:px-6 min-h-16 py-2 flex justify-between items-center gap-3 border-b border-line sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center size-10 rounded-control bg-accent/10 border border-accent/30 text-accent shrink-0">
            <ChefHat className="size-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold">Cocina</h1>
          {conteo.pendiente > 0 && (
            <span className="num bg-accent text-on-accent text-sm font-bold px-2.5 py-0.5 rounded-full">
              {conteo.pendiente} pendiente{conteo.pendiente > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <span role="status" className={cn('hidden sm:inline-flex items-center gap-1.5 text-sm font-medium', sincronizado ? 'text-success' : 'text-danger')}>
            {sincronizado ? <Wifi className="size-4" aria-hidden="true" /> : <CloudOff className="size-4" aria-hidden="true" />}
            {sincronizado ? 'En vivo' : 'Sin conexión'}
          </span>
          <span className="hidden md:inline text-muted text-sm">{usuario?.nombre}</span>
          <Button variant="ghost" size="sm" icon={LogOut} onClick={() => { cerrarSesion(); navigate('/login') }}>
            Salir
          </Button>
        </div>
      </header>

      {!sincronizado && (
        <div role="alert" className="flex items-center justify-center gap-2 bg-danger text-white text-sm font-medium py-2 px-3">
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
          Sin conexión con el servidor: lo que ves puede estar desactualizado
        </div>
      )}

      <div className="bg-surface border-b border-line px-4 sm:px-6 py-3 flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por estado">
        {FILTROS.map(f => (
          <Chip key={f.id} activo={filtro === f.id} count={conteo[f.id]} onClick={() => setFiltro(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <main className="flex-1 p-4 sm:p-5 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 content-start">
        {primeraCarga ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-panel" />)
        ) : tickets.length === 0 ? (
          <EmptyState
            className="col-span-full py-24"
            icon={CheckCheck}
            title={filtro === 'todos' ? 'Todo al día' : 'Sin ítems en este estado'}
            description={filtro === 'todos' ? 'No hay pedidos activos en cocina.' : 'Prueba con otro filtro.'}
          />
        ) : (
          tickets.map(({ pedido, items }) => {
            const min = minutosDesde(pedido.inicio, ahora)
            const espera = ESTILO_ESPERA[tonoEspera(min)]
            return (
              <article
                key={pedido.id}
                aria-label={`Mesa ${pedido.mesa_numero}`}
                className={cn('bg-surface border border-line border-t-4 rounded-panel overflow-hidden', espera.barra)}
              >
                <div className="px-4 py-3 border-b border-line flex justify-between items-center bg-sunken">
                  <h2 className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">Mesa {pedido.mesa_numero}</span>
                    <span className="text-faint text-sm num">#{pedido.id}</span>
                  </h2>
                  <span className={cn('inline-flex items-center gap-1.5 text-base font-semibold num', espera.texto)}>
                    <Clock className="size-4" aria-hidden="true" />
                    <span className="sr-only">Espera: </span>
                    {formatoEspera(min)}
                  </span>
                </div>

                <ul className="divide-y divide-line">
                  {items.map(item => {
                    const estado = ESTADO[item.estado] ?? ESTADO.pendiente
                    const accion = ACCION[item.estado]
                    const cargando = itemCargando === item.id
                    return (
                      <li key={item.id} className="px-4 py-3 flex flex-col gap-2">
                        <div className="flex items-start gap-3">
                          <span className="num bg-raised text-ink text-lg font-bold px-2.5 py-0.5 rounded-control min-w-11 text-center">
                            {item.cantidad}×
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-ink text-lg font-semibold leading-snug">{item.nombre || 'Producto'}</p>
                            <StatusBadge tone={estado.tono} icon={estado.icono} className="mt-1">{estado.label}</StatusBadge>
                          </div>
                        </div>
                        {item.nota && (
                          <p className="flex items-start gap-2 bg-warning/10 border border-warning/30 text-warning rounded-control px-3 py-2 text-base font-medium">
                            <StickyNote className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span className="min-w-0 break-words">{item.nota}</span>
                          </p>
                        )}
                        {accion && (
                          <Button
                            variant={accion.variante}
                            size="md"
                            icon={accion.icono}
                            loading={cargando}
                            block
                            onClick={() => avanzar(item.id, item.estado)}
                            aria-label={`${accion.label}: ${item.cantidad} ${item.nombre || 'producto'}, mesa ${pedido.mesa_numero}`}
                          >
                            {accion.label}
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </article>
            )
          })
        )}
      </main>
    </div>
  )
}
