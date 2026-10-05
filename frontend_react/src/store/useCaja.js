import { create } from 'zustand'
import { getCajaActual } from '../api/caja'

/** Caja abierta del usuario (cajero/admin). `cargada` distingue «aún no sé» de «no hay caja». */
const useCaja = create((set) => ({
  caja: null,
  cargada: false,
  error: false,
  cargar: async () => {
    try {
      const caja = await getCajaActual()
      set({ caja, cargada: true, error: false })
      return caja
    } catch {
      set({ error: true, cargada: true })
      return null
    }
  },
  fijar: (caja) => set({ caja, cargada: true, error: false }),
  limpiar: () => set({ caja: null, cargada: false, error: false }),
}))

export default useCaja
