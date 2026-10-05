import { esCobrable } from './mesasDerivadas'

/**
 * Estado visual de una mesa para el mozo. Prioridad: lo que más urge arriba.
 * El estado siempre se comunica con texto + icono; el color solo refuerza.
 */
export const ESTADOS_MESA = {
  listo:     { id: 'listo',     etiqueta: 'Plato listo',   tono: 'listo' },
  porCobrar: { id: 'porCobrar', etiqueta: 'Por cobrar',    tono: 'info' },
  enCocina:  { id: 'enCocina',  etiqueta: 'En cocina',     tono: 'warning' },
  ocupada:   { id: 'ocupada',   etiqueta: 'Ocupada',       tono: 'warning' },
  libre:     { id: 'libre',     etiqueta: 'Libre',         tono: 'success' },
}

export function estadoMesa(mesa) {
  if (mesa.estado === 'disponible') return ESTADOS_MESA.libre
  if ((mesa.items_listos ?? 0) > 0) return ESTADOS_MESA.listo
  if (esCobrable(mesa)) return ESTADOS_MESA.porCobrar
  if ((mesa.items_pendientes ?? 0) > 0) return ESTADOS_MESA.enCocina
  return ESTADOS_MESA.ocupada
}
