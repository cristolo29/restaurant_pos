import { alturaTicketMm, formatoValido, tituloDocumento } from '../../utils/comprobante'

const CLAVE = 'comprobante.formato'

/** Formato recordado en este navegador (localStorage puede no estar disponible: se ignora el error). */
export function leerFormato(porDefecto) {
  try {
    const f = localStorage.getItem(CLAVE)
    return formatoValido(f) ? f : porDefecto
  } catch { return porDefecto }
}
export function guardarFormato(f) {
  try { localStorage.setItem(CLAVE, f) } catch { /* sin almacenamiento: no se recuerda */ }
}

/** `@page` de cada formato. A4 con márgenes de 14 mm y numeración; ticket de 80 mm sin márgenes (el ancho útil lo da el documento). */
export function cssPagina(formato, alturaMm = 297) {
  if (formato === 'ticket') return `@page { size: 80mm ${alturaMm}mm; margin: 0; }`
  return '@page { size: A4; margin: 14mm 14mm 16mm; @bottom-center { content: "Página " counter(page) " de " counter(pages); font: 9pt sans-serif; color: #000; } }'
}

function medirTicket() {
  const copia = document.querySelector('.cp-print')
  const ticket = copia?.querySelector('.cp-ticket')
  if (!copia || !ticket) return null
  copia.classList.add('cp-medir')
  const px = ticket.getBoundingClientRect().height
  copia.classList.remove('cp-medir')
  return alturaTicketMm(px)
}

/**
 * Imprime con el nombre de archivo útil («Boleta B001-000001»): `document.title` es lo que el navegador propone
 * al «Guardar como PDF». Se restaura al terminar (afterprint) o, si el evento no llega, a los 60 s.
 * El ticket fija su alto de página exacto para salir en una sola hoja continua.
 */
export function imprimirComprobante(c, formato) {
  const tituloOriginal = document.title
  document.title = tituloDocumento(c)
  // Se reescribe el <style> de @page de la copia de impresión (así no hay dos reglas @page en conflicto).
  const estilo = document.querySelector('.cp-print style')
  const cssOriginal = estilo?.textContent
  const alto = formato === 'ticket' ? medirTicket() : null
  if (alto && estilo) estilo.textContent = cssPagina('ticket', alto)
  let respaldo
  const restaurar = () => {
    document.title = tituloOriginal
    if (estilo) estilo.textContent = cssOriginal
    window.removeEventListener('afterprint', restaurar)
    clearTimeout(respaldo)
  }
  window.addEventListener('afterprint', restaurar)
  respaldo = setTimeout(restaurar, 60000)
  window.print()
}
