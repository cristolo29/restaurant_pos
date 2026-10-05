const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
  'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const VEINTES = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
  'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

/** 1..999 en letras ("UNO" al final; el apócope "UN" lo aplica quien lo antepone a MIL/MILLÓN). */
function centenas(n) {
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 20) partes.push(UNIDADES[r])
    else if (r < 30) partes.push(VEINTES[r - 20])
    else partes.push(DECENAS[Math.floor(r / 10)] + (r % 10 ? ` Y ${UNIDADES[r % 10]}` : ''))
  }
  return partes.join(' ')
}

const apocope = (texto) => texto.replace(/UNO$/, 'UN')

function enteroEnLetras(n) {
  if (n === 0) return 'CERO'
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes = []
  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocope(centenas(millones))} MILLONES`)
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocope(centenas(miles))} MIL`)
  if (resto) partes.push(centenas(resto))
  return partes.join(' ')
}

/**
 * Importe en letras para comprobantes peruanos: "SON: CIENTO CINCO CON 50/100 SOLES".
 * Trabaja en céntimos enteros (sin errores de coma flotante). Devuelve '' si el valor no es válido
 * (no numérico, negativo o ≥ 1 000 000 000), para no imprimir nada en vez de un texto erróneo.
 */
export function importeEnLetras(monto) {
  const n = typeof monto === 'string' && monto.trim() === '' ? NaN : Number(monto)
  if (monto === null || !Number.isFinite(n) || n < 0) return ''
  const centimos = Math.round(Number((n * 100).toPrecision(15)))
  if (centimos >= 100_000_000_000) return ''
  const soles = Math.floor(centimos / 100)
  const cts = String(centimos % 100).padStart(2, '0')
  return `SON: ${enteroEnLetras(soles)} CON ${cts}/100 SOLES`
}
