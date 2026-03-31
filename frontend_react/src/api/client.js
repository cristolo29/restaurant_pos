import axios from 'axios'
import useAuth from '../store/useAuth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// Inyectar token en cada request
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si el servidor responde 401, cerrar sesión y redirigir al login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuth.getState().cerrarSesion()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
