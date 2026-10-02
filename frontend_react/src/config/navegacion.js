import { Armchair, ClipboardList, Banknote, ChefHat, LayoutDashboard, Receipt, Settings, Vault } from 'lucide-react'

/**
 * Configuración única de navegación por rol.
 * Destino = { id, label, corto (etiqueta para la barra inferior móvil), icono (componente lucide), path }
 */
const DESTINOS = {
  mesas:         { id: 'mesas',       label: 'Mesas',       icono: Armchair,        path: '/mesas' },
  'mis-pedidos': { id: 'mis-pedidos', label: 'Mis pedidos', icono: ClipboardList,   path: '/mis-pedidos' },
  'por-cobrar':  { id: 'por-cobrar',  label: 'Por cobrar',  icono: Banknote,        path: '/por-cobrar' },
  caja:          { id: 'caja',        label: 'Caja',        icono: Vault,           path: '/caja' },
  comprobantes:  { id: 'comprobantes', label: 'Comprobantes', corto: 'Comprob.', icono: Receipt,       path: '/comprobantes' },
  cocina:        { id: 'cocina',      label: 'Cocina',      icono: ChefHat,         path: '/cocina' },
  dashboard:     { id: 'dashboard',   label: 'Dashboard',   icono: LayoutDashboard, path: '/dashboard' },
  admin:         { id: 'admin',       label: 'Admin',       icono: Settings,        path: '/admin' },
}

const NAVEGACION = {
  mozo:     { home: '/mesas',      destinos: ['mesas', 'mis-pedidos'] },
  cajero:   { home: '/por-cobrar', destinos: ['por-cobrar', 'mesas', 'caja'] },
  cocinero: { home: '/cocina',     destinos: [] },
  admin:    { home: '/dashboard',  destinos: ['dashboard', 'mesas', 'por-cobrar', 'caja', 'comprobantes', 'cocina', 'admin'] },
}

const ROLES = { admin: 'Administrador', mozo: 'Mozo', cajero: 'Cajero', cocinero: 'Cocina' }

const SIN_BARRA = ['/comanda', '/cobro']

export function homeParaRol(rol) {
  return NAVEGACION[rol]?.home ?? '/mesas'
}

export function destinosParaRol(rol) {
  return (NAVEGACION[rol]?.destinos ?? []).map(id => DESTINOS[id])
}

export function mostrarBarra(rol, pathname) {
  return !(SIN_BARRA.includes(pathname) || rol === 'cocinero')
}

export function etiquetaRol(rol) {
  return ROLES[rol] ?? rol
}
