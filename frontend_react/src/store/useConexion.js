import { create } from 'zustand'

const useConexion = create((set, get) => ({
  enLinea: navigator.onLine,
  setEnLinea: (v) => set({ enLinea: v }),
  iniciarEscucha: () => {
    const alConectar = () => get().setEnLinea(true)
    const alDesconectar = () => get().setEnLinea(false)
    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)
    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
    }
  },
}))

export default useConexion
