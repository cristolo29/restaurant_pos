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

/**
 * Estado del formulario de arqueo. Cierre a ciegas: si la caja no trae `monto_esperado` (el servidor no se lo
 * envía al cajero), no hay diferencia que mostrar ni observaciones obligatorias en el cliente: el servidor decide.
 */
export function estadoArqueo(caja, contadoC, observaciones) {
  const ciego = caja.monto_esperado === undefined || caja.monto_esperado === null
  const esperadoC = ciego ? null : Math.round(Number(caja.monto_esperado) * 100)
  const dif = ciego || contadoC === null ? null : describirDiferencia(contadoC - esperadoC)
  const obs = observaciones.trim()
  const falta = !!dif && dif.tipo !== 'cuadra' && obs.length < OBS_MIN
  return { ciego, esperadoC, contadoC, dif, obs, falta, listo: contadoC !== null && !falta }
}

/** Billetes y monedas peruanas estándar (claves canónicas del servidor), en céntimos. */
export const DENOMINACIONES = [
  { clave: '200', centimos: 20000, tipo: 'billete' },
  { clave: '100', centimos: 10000, tipo: 'billete' },
  { clave: '50', centimos: 5000, tipo: 'billete' },
  { clave: '20', centimos: 2000, tipo: 'billete' },
  { clave: '10', centimos: 1000, tipo: 'billete' },
  { clave: '5', centimos: 500, tipo: 'moneda' },
  { clave: '2', centimos: 200, tipo: 'moneda' },
  { clave: '1', centimos: 100, tipo: 'moneda' },
  { clave: '0.50', centimos: 50, tipo: 'moneda' },
  { clave: '0.20', centimos: 20, tipo: 'moneda' },
  { clave: '0.10', centimos: 10, tipo: 'moneda' },
]

/** Total del conteo en céntimos enteros (sin coma flotante). */
export const totalConteo = (conteo) =>
  DENOMINACIONES.reduce((suma, d) => suma + d.centimos * (conteo[d.clave] || 0), 0)

/** Conteo para el servidor: solo denominaciones con cantidad > 0. */
export const conteoParaEnviar = (conteo) =>
  Object.fromEntries(DENOMINACIONES.filter(d => (conteo[d.clave] || 0) > 0).map(d => [d.clave, conteo[d.clave]]))

/** Textos y signo de cada tipo de movimiento de efectivo. */
export const TIPO_MOVIMIENTO = {
  ingreso: { etiqueta: 'Ingreso de efectivo', corto: 'Ingreso', signo: '+' },
  egreso: { etiqueta: 'Egreso de efectivo', corto: 'Egreso', signo: '−' },
  retiro: { etiqueta: 'Retiro de efectivo', corto: 'Retiro', signo: '−' },
}
