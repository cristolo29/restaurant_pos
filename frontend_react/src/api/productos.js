import api from './client'

export const getCategorias = () => api.get('/api/categorias').then(r => r.data)
export const getProductos = () => api.get('/api/productos').then(r => r.data)
