import { Bell, CheckCheck, ChefHat, Clock, Flame, Utensils } from 'lucide-react'

/** Estado de un ítem ya enviado a cocina, visto por el mozo/cajero. */
export const ESTADO_ITEM = {
  pendiente:      { label: 'Pendiente',      tono: 'neutral', icono: Clock },
  en_preparacion: { label: 'En cocina',      tono: 'warning', icono: Flame },
  listo:          { label: 'Listo para servir', tono: 'success', icono: Bell },
  entregado:      { label: 'Entregado',      tono: 'info',    icono: CheckCheck },
}

export const ICONOS = { ChefHat, Utensils }

export const NOTAS_RAPIDAS = [
  'Sin cebolla', 'Sin ají', 'Poco picante', 'Sin hielo',
  'Término medio', 'Bien cocido', 'Para llevar', 'Aparte la salsa',
]
