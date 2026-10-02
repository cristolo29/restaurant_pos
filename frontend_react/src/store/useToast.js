import { create } from 'zustand'

let siguienteId = 1

/** Notificaciones no bloqueantes. Uso: useToast.getState().mostrar('Enviado', 'success') */
const useToast = create((set, get) => ({
  toasts: [],
  mostrar: (mensaje, tipo = 'info', duracion = 4000) => {
    const id = siguienteId++
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, mensaje, tipo }] }))
    if (duracion > 0) setTimeout(() => get().cerrar(id), duracion)
    return id
  },
  cerrar: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))

export const toast = {
  exito: (m) => useToast.getState().mostrar(m, 'success'),
  error: (m) => useToast.getState().mostrar(m, 'danger', 6000),
  info:  (m) => useToast.getState().mostrar(m, 'info'),
}

export default useToast
