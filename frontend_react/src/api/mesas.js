import api from './client'

export const getMesas    = () => api.get('/api/mesas').then(r => r.data)
export const ocuparMesa  = (mesa_id) => api.put(`/api/mesas/${mesa_id}/ocupar`).then(r => r.data)
export const liberarMesa = (mesa_id) => api.put(`/api/mesas/${mesa_id}/liberar`).then(r => r.data)
