import api from './client'

export const abrirCaja = (monto_inicial) =>
  api.post('/api/caja/abrir', { monto_inicial }).then(r => r.data)

// Devuelve la caja abierta del usuario o null si no tiene.
export const getCajaActual = () =>
  api.get('/api/caja/actual').then(r => r.data)

export const cerrarCaja = (monto_contado, observaciones) =>
  api.post('/api/caja/cerrar', { monto_contado, observaciones: observaciones || null }).then(r => r.data)

export const getCajas = () =>
  api.get('/api/caja').then(r => r.data)
