import api from './client'

export const getMesas = () => api.get('/api/mesas').then(r => r.data)
