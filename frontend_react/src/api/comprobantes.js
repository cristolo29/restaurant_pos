import api from './client'

export const emitirComprobante = (datos) =>
  api.post('/api/comprobantes', datos).then(r => r.data)
