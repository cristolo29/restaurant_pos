import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../store/useAuth'
import useMesas from '../store/useMesas'
import useConexion from '../store/useConexion'
import { destinosParaRol, mostrarBarra } from '../config/navegacion'
import { mesasPorCobrar, totalPlatosListos } from '../utils/mesasDerivadas'

function Badge({ n }) {
  if (!n || n <= 0) return null
  return (
    <span className="absolute top-1 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[11px] font-bold leading-[18px] text-center">
      {n}
    </span>
  )
}

function PuntoConexion({ enLinea }) {
  return (
    <span
      title={enLinea ? 'En línea' : 'Sin conexión'}
      className={`inline-block w-2.5 h-2.5 rounded-full ${enLinea ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
    />
  )
}

export default function AppShell() {
  const usuario = useAuth(s => s.usuario)
  const cerrarSesion = useAuth(s => s.cerrarSesion)
  const mesas = useMesas(s => s.mesas)
  const enLinea = useConexion(s => s.enLinea)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const usuarioId = usuario?.id
  const rol = usuario?.rol_nombre

  useEffect(() => {
    if (usuarioId == null || rol === 'cocinero') return
    return useMesas.getState().iniciarPolling()
  }, [usuarioId, rol])

  useEffect(() => useConexion.getState().iniciarEscucha(), [])

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
    <div className="fixed top-0 inset-x-0 z-50 bg-[#ef4444] text-white text-sm font-medium text-center py-1.5 px-3">
      Sin conexión — los cambios pueden no guardarse
    </div>
  )

  if (!conBarra) {
    return (
      <>
        {banner}
        <Outlet />
      </>
    )
  }

  const claseLateral = ({ isActive }) =>
    `relative flex flex-col items-center justify-center gap-0.5 w-full min-h-[56px] py-2 text-[11px] leading-tight text-center transition-colors ${
      isActive ? 'text-[#f59e0b] bg-[#27272a]' : 'text-[#71717a] hover:text-white'
    }`

  const claseInferior = ({ isActive }) =>
    `relative flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-[11px] leading-tight text-center transition-colors ${
      isActive ? 'text-[#f59e0b]' : 'text-[#71717a]'
    }`

  return (
    <>
      {banner}

      {/* Barra lateral (≥ md) */}
      <nav className="hidden md:flex fixed inset-y-0 left-0 w-20 z-40 flex-col bg-[#18181b] border-r border-[#3f3f46]">
        <div className="flex-1 overflow-y-auto pt-2">
          {destinos.map(d => (
            <NavLink key={d.id} to={d.path} className={claseLateral}>
              <span className="text-xl">{d.icono}</span>
              <span>{d.label}</span>
              <Badge n={badges[d.id]} />
            </NavLink>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 py-3 border-t border-[#3f3f46]">
          <div className="relative w-9 h-9 rounded-full bg-[#27272a] border border-[#3f3f46] flex items-center justify-center text-xs font-bold text-[#f59e0b]">
            {iniciales}
          </div>
          <PuntoConexion enLinea={enLinea} />
          <button
            onClick={salir}
            className="min-h-[44px] w-full text-xs text-[#71717a] hover:text-white transition-colors"
          >
            Salir
          </button>
        </div>
      </nav>

      {/* Franja superior (< md), no sticky */}
      <div className="md:hidden h-10 flex items-center justify-between px-4 bg-[#18181b] border-b border-[#3f3f46]">
        <span className="flex items-center gap-2 text-sm text-white truncate">
          <PuntoConexion enLinea={enLinea} />
          <span className="truncate">{usuario?.nombre}</span>
        </span>
        <button
          onClick={salir}
          className="min-h-[44px] px-2 text-xs text-[#71717a] hover:text-white transition-colors"
        >
          Salir
        </button>
      </div>

      <div className="pb-16 md:pb-0 md:pl-20">
        <Outlet />
      </div>

      {/* Barra inferior (< md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 z-40 flex bg-[#18181b] border-t border-[#3f3f46]">
        {destinos.map(d => (
          <NavLink key={d.id} to={d.path} className={claseInferior}>
            <span className="text-xl">{d.icono}</span>
            <span>{d.label}</span>
            <Badge n={badges[d.id]} />
          </NavLink>
        ))}
      </nav>
    </>
  )
}
