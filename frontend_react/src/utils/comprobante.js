/** Utilidades puras del documento impreso del comprobante (sin React). */

export const FORMATOS = [
  { id: 'a4', etiqueta: 'A4' },
  { id: 'ticket', etiqueta: 'Ticket 80 mm' },
]
export const formatoValido = (f) => FORMATOS.some(x => x.id === f)

/** Moneda con miles: S/ 1,234.50. Trabaja en céntimos enteros; un valor inválido se muestra como S/ 0.00. */
export function formatearSoles(valor) {
  const n = Number(valor)
  const centimos = Number.isFinite(n) ? Math.round(Number((Math.abs(n) * 100).toPrecision(15))) : 0
  const enteros = String(Math.floor(centimos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const signo = n < 0 && centimos > 0 ? '-' : ''
  return `${signo}S/ ${enteros}.${String(centimos % 100).padStart(2, '0')}`
}

/** Título del documento = nombre de archivo que propone "Guardar como PDF": «Boleta B001-000001». */
export const tituloDocumento = (c) => `${c.tipo === 'factura' ? 'Factura' : 'Boleta'} ${c.numero}`

/** Cantidad sin ceros sobrantes: 2, 1.5. */
export const formatoCantidad = (q) => String(Number(q))
