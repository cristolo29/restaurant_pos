import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, UtensilsCrossed, Wifi, WifiOff } from 'lucide-react'
import useAuth from '../store/useAuth'
import useMesas from '../store/useMesas'
import useConexion from '../store/useConexion'
import useCaja from '../store/useCaja'
import { destinosParaRol, mostrarBarra, etiquetaRol } from '../config/navegacion'
import { mesasPorCobrar, totalPlatosListos } from '../utils/mesasDerivadas'
import { Toaster, cn } from './ui'

function Badge({ n }) {
  if (!n || n <= 0) return null
  return (
    <span
      aria-label={`${n} pendiente${n > 1 ? 's' : ''}`}
      className="num absolute top-1.5 right-3 md:right-4 min-w-5 h-5 px-1 rounded-full bg-danger text-white text-xs font-bold leading-5 text-center"
    >
      {n}
    </span>
  )
}

/** Estado de la caja bajo la etiqueta del destino: texto + punto, nunca solo color. */
function EstadoCaja({ abierta }) {
  return (
    <span className={cn('flex items-center gap-1 text-[0.6875rem] font-semibold leading-none', abierta ? 'text-success' : 'text-warning')}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', abierta ? 'bg-success' : 'bg-warning')} />
      {abierta ? 'Abierta' : 'Cerrada'}
    </span>
  )
}

function Conexion({ enLinea, compacto = false }) {
  const Icono = enLinea ? Wifi : WifiOff
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', enLinea ? 'text-success' : 'text-danger')}
      role="status"
    >
      <Icono className="size-4" aria-hidden="true" />
      <span className={compacto ? 'sr-only' : undefined}>{enLinea ? 'En línea' : 'Sin conexión'}</span>
    </span>
  )
}

export default function AppShell() {
  const usuario = useAuth(s => s.usuario)
  const cerrarSesion = useAuth(s => s.cerrarSesion)
  const mesas = useMesas(s => s.mesas)
  const enLinea = useConexion(s => s.enLinea)
  const caja = useCaja(s => s.caja)
  const cajaCargada = useCaja(s => s.cargada)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const usuarioId = usuario?.id
  const rol = usuario?.rol_nombre

  useEffect(() => {
    if (usuarioId == null || rol === 'cocinero') return
    return useMesas.getState().iniciarPolling()
  }, [usuarioId, rol])

  // El shell sigue montado al navegar: refrescar mesas en cada cambio de ruta
  // (la primera ejecución la cubre el polling, que carga al montar).
  const primeraRuta = useRef(true)
  useEffect(() => {
    if (primeraRuta.current) {
      primeraRuta.current = false
      return
    }
    if (usuarioId == null || rol === 'cocinero') return
    useMesas.getState().cargar()
  }, [pathname, usuarioId, rol])

  useEffect(() => useConexion.getState().iniciarEscucha(), [])

  // Cajero/admin: conocer si hay caja abierta (para el indicador y para avisar en Cobro).
  const usaCaja = rol === 'cajero' || rol === 'admin'
  useEffect(() => {
    if (usuarioId == null || !usaCaja) return
    useCaja.getState().cargar()
  }, [usuarioId, usaCaja, pathname])
  useEffect(() => () => useCaja.getState().limpiar(), [usuarioId])

  const destinos = destinosParaRol(rol)
  const conBarra = destinos.length > 0 && mostrarBarra(rol, pathname)

  const badges = {
    'por-cobrar': mesasPorCobrar(mesas).listas.length,
    'mis-pedidos': usuarioId != null ? totalPlatosListos(mesas, usuarioId) : 0,
  }

  const iniciales = (usuario?.nombre ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('')

  function salir() {
    cerrarSesion()
    navigate('/login')
  }

  const banner = !enLinea && (
    <div role="alert" className="flex items-center justify-center gap-2 bg-danger text-white text-sm font-medium py-2 px-3">
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      Sin conexión: los cambios pueden no guardarse
    </div>
  )

  if (!conBarra) {
    return (
      <>
        {banner}
        <Outlet />
        <Toaster />
      </>
    )
  }

  const claseLateral = ({ isActive }) =>
    cn(
      'relative flex flex-col items-center justify-center gap-1 w-full min-h-[68px] py-2 text-[0.8125rem] font-medium leading-tight text-center transition-colors border-l-[3px]',
      isActive
        ? 'text-accent bg-surface border-accent'
        : 'text-muted border-transparent hover:text-ink hover:bg-surface/60',
    )

  const claseInferior = ({ isActive }) =>
    cn(
      'relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-14 text-xs font-medium leading-tight text-center transition-colors border-t-[3px]',
      isActive ? 'text-accent border-accent' : 'text-muted border-transparent',
    )

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-accent focus:text-on-accent focus:px-4 focus:py-2 focus:rounded-control"
      >
        Saltar al contenido
      </a>
      <div className="md:pl-24">{banner}</div>

      {/* Barra lateral (≥ md) */}
      <nav aria-label="Principal" className="hidden md:flex fixed inset-y-0 left-0 w-24 z-40 flex-col bg-sunken border-r border-line">
        <div className="grid place-items-center h-16 border-b border-line text-accent">
          <UtensilsCrossed className="size-7" aria-hidden="true" />
          <span className="sr-only">Orbezo POS</span>
        </div>
        <div className="flex-1 overflow-y-auto pt-2">
          {destinos.map(d => (
            <NavLink key={d.id} to={d.path} className={claseLateral}>
              <d.icono className="size-6" aria-hidden="true" />
              <span>{d.label}</span>
              {d.id === 'caja' && cajaCargada && <EstadoCaja abierta={!!caja} />}
              <Badge n={badges[d.id]} />
            </NavLink>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1.5 px-1 py-3 border-t border-line">
          <div
            aria-hidden="true"
            className="grid place-items-center size-10 rounded-full bg-surface border border-line text-sm font-bold text-accent"
          >
            {iniciales}
          </div>
          <p className="text-xs text-soft font-medium truncate max-w-full px-1">{usuario?.nombre}</p>
          <p className="text-xs text-faint -mt-1">{etiquetaRol(rol)}</p>
          <Conexion enLinea={enLinea} />
          <button
            onClick={salir}
            className="mt-1 flex items-center justify-center gap-1.5 min-h-11 w-full text-sm text-muted hover:text-ink hover:bg-surface rounded-control transition-colors"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Salir
          </button>
        </div>
      </nav>

      {/* Franja superior (< md), no sticky */}
      <div className="md:hidden min-h-11 flex items-center justify-between px-4 bg-sunken border-b border-line">
        <span className="flex items-center gap-2 text-sm text-ink min-w-0">
          <Conexion enLinea={enLinea} compacto />
          <span className="truncate font-medium">{usuario?.nombre}</span>
          <span className="text-faint text-xs shrink-0">· {etiquetaRol(rol)}</span>
        </span>
        <button
          onClick={salir}
          aria-label="Cerrar sesión"
          className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Salir
        </button>
      </div>

      <div id="contenido" className="pb-16 md:pb-0 md:pl-24">
        <Outlet />
      </div>

      {/* Barra inferior (< md) */}
      <nav aria-label="Principal" className="md:hidden fixed bottom-0 inset-x-0 h-16 z-40 flex bg-sunken border-t border-line">
        {destinos.map(d => (
          <NavLink key={d.id} to={d.path} className={claseInferior}
            aria-label={d.id === 'caja' && cajaCargada ? `Caja ${caja ? 'abierta' : 'cerrada'}` : d.label}>
            <d.icono className="size-6" aria-hidden="true" />
            <span aria-hidden="true">{d.corto ?? d.label}</span>
            {d.id === 'caja' && cajaCargada && <EstadoCaja abierta={!!caja} />}
            <Badge n={badges[d.id]} />
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </>
  )
}
