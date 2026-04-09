import api from './client'

// Mesas
export const getMesas        = () => api.get('/api/mesas').then(r => r.data)
export const crearMesa       = (d) => api.post('/api/mesas', d).then(r => r.data)
export const actualizarMesa  = (id, d) => api.put(`/api/mesas/${id}`, d).then(r => r.data)
export const eliminarMesa    = (id) => api.delete(`/api/mesas/${id}`).then(r => r.data)

// Categorías
export const getCategorias       = () => api.get('/api/categorias/todas').then(r => r.data)
export const crearCategoria      = (d) => api.post('/api/categorias', d).then(r => r.data)
export const actualizarCategoria = (id, d) => api.put(`/api/categorias/${id}`, d).then(r => r.data)
export const eliminarCategoria   = (id) => api.delete(`/api/categorias/${id}`).then(r => r.data)

// Productos
export const getProductos       = () => api.get('/api/productos/todos').then(r => r.data)
export const crearProducto      = (d) => api.post('/api/productos', d).then(r => r.data)
export const actualizarProducto = (id, d) => api.put(`/api/productos/${id}`, d).then(r => r.data)
export const eliminarProducto   = (id) => api.delete(`/api/productos/${id}`).then(r => r.data)

// Usuarios
export const getUsuarios       = () => api.get('/api/usuarios').then(r => r.data)
export const crearUsuario      = (d) => api.post('/api/usuarios', d).then(r => r.data)
export const actualizarUsuario = (id, d) => api.put(`/api/usuarios/${id}`, d).then(r => r.data)
export const eliminarUsuario   = (id) => api.delete(`/api/usuarios/${id}`).then(r => r.data)

// Roles
export const getRoles = () => api.get('/api/roles').then(r => r.data)

// Salones
export const getSalones       = () => api.get('/api/salones/todos').then(r => r.data)
export const crearSalon       = (d) => api.post('/api/salones', d).then(r => r.data)
export const actualizarSalon  = (id, d) => api.put(`/api/salones/${id}`, d).then(r => r.data)
export const eliminarSalon    = (id) => api.delete(`/api/salones/${id}`).then(r => r.data)

// Comprobantes
export const getComprobantes = () => api.get('/api/comprobantes').then(r => r.data)
