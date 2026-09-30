/**
 * Configuración única de navegación por rol.
 * Destino = { id, label, icono, path }
 */
const DESTINOS = {
  mesas:         { id: 'mesas',       label: 'Mesas',          icono: '🪑',   path: '/mesas' },
  'mis-pedidos': { id: 'mis-pedidos', label: 'Mis pedidos',    icono: '📋',   path: '/mis-pedidos' },
  'por-cobrar':  { id: 'por-cobrar',  label: 'Por cobrar',     icono: '💵',   path: '/por-cobrar' },
  cocina:        { id: 'cocina',      label: 'Cocina',         icono: '👨‍🍳', path: '/cocina' },
  dashboard:     { id: 'dashboard',   label: 'Dashboard',      icono: '📊',   path: '/dashboard' },
  admin:         { id: 'admin',       label: 'Administración', icono: '⚙️',   path: '/admin' },
}

const NAVEGACION = {
  mozo:     { home: '/mesas',      destinos: ['mesas', 'mis-pedidos'] },
  cajero:   { home: '/por-cobrar', destinos: ['por-cobrar', 'mesas'] },
  cocinero: { home: '/cocina',     destinos: [] },
  admin:    { home: '/dashboard',  destinos: ['dashboard', 'mesas', 'por-cobrar', 'cocina', 'admin'] },
}

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
