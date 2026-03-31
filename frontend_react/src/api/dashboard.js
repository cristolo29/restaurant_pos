import api from './client'

export const getDashboard = () => api.get('/api/dashboard').then(r => r.data)
