/** Convierte lo que escribe el usuario a céntimos enteros (evita errores de coma flotante). null si no es válido. */
export function aCentimos(texto) {
  const t = String(texto ?? '').trim().replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

export const deCentimos = (c) => (c / 100).toFixed(2)

/** Diferencia contado − esperado en céntimos → { tipo, centimos, texto } con texto explícito (no solo color). */
export function describirDiferencia(centimos) {
  if (centimos === 0) return { tipo: 'cuadra', centimos, texto: 'La caja cuadra' }
  if (centimos < 0) return { tipo: 'falta', centimos, texto: `Faltan S/ ${deCentimos(-centimos)}` }
  return { tipo: 'sobra', centimos, texto: `Sobran S/ ${deCentimos(centimos)}` }
}

export const fechaHora = (iso) =>
  iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const hora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'

export const OBS_MIN = 3

/** Estado del formulario de arqueo a partir del esperado de la caja y lo escrito. */
export function estadoArqueo(caja, contado, observaciones) {
  const esperadoC = Math.round(Number(caja.monto_esperado) * 100)
  const contadoC = aCentimos(contado)
  const dif = contadoC === null ? null : describirDiferencia(contadoC - esperadoC)
  const obs = observaciones.trim()
  const falta = dif && dif.tipo !== 'cuadra' && obs.length < OBS_MIN
  return { esperadoC, contadoC, dif, obs, falta, listo: contadoC !== null && !falta }
}
