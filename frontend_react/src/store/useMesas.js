import { create } from 'zustand'
import { getMesas } from '../api/mesas'

const INTERVALO_MS = 10000

const useMesas = create((set, get) => ({
  mesas: [],
  cargando: true,
  cargar: async () => {
    try {
      const mesas = await getMesas()
      set({ mesas, cargando: false })
    } catch {
      set({ cargando: false })
    }
  },
  iniciarPolling: () => {
    const { cargar } = get()
    cargar()
    const id = setInterval(cargar, INTERVALO_MS)
    return () => clearInterval(id)
  },
}))

export default useMesas
