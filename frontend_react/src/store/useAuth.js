import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuth = create(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      setUsuario: (usuario, token) => set({ usuario, token }),
      cerrarSesion: () => set({ usuario: null, token: null }),
    }),
    { name: 'auth' }
  )
)

export default useAuth
