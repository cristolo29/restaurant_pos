import api from './client'

export const abrirCaja = (monto_inicial) =>
  api.post('/api/caja/abrir', { monto_inicial }).then(r => r.data)

// Devuelve la caja abierta del usuario o null si no tiene.
export const getCajaActual = () =>
  api.get('/api/caja/actual').then(r => r.data)

// `conteo` (opcional): { "200": 1, "0.50": 3 }; el servidor verifica que sume `monto_contado`.
// `pin_autorizacion` (opcional): PIN de un administrador, solo si la diferencia supera la tolerancia.
export const cerrarCaja = ({ monto_contado, observaciones, conteo, pin_autorizacion }) =>
  api.post('/api/caja/cerrar', {
    monto_contado,
    observaciones: observaciones || null,
    ...(conteo ? { conteo } : {}),
    ...(pin_autorizacion ? { pin_autorizacion } : {}),
  }).then(r => r.data)

// Devuelve la caja actualizada (con la lista de movimientos). tipo: ingreso | egreso | retiro.
export const registrarMovimiento = ({ tipo, monto, motivo }) =>
  api.post('/api/caja/movimientos', { tipo, monto, motivo }).then(r => r.data)

export const getCajas = () =>
  api.get('/api/caja').then(r => r.data)
