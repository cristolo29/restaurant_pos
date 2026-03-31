import api from './client'

export const login = (pin) => api.post('/api/login', { pin }).then(r => r.data)
export const getRoles = () => api.get('/api/roles').then(r => r.data)
