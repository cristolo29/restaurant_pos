// Pruebas ejecutables sin dependencias:  node --test "src/**/*.test.js"  (o: npm test)
import test from 'node:test'
import assert from 'node:assert/strict'
import { importeEnLetras } from './importeEnLetras.js'

const casos = [
  [0, 'SON: CERO CON 00/100 SOLES'],
  [1, 'SON: UNO CON 00/100 SOLES'],
  [15, 'SON: QUINCE CON 00/100 SOLES'],
  [21, 'SON: VEINTIUNO CON 00/100 SOLES'],
  [30, 'SON: TREINTA CON 00/100 SOLES'],
  [31, 'SON: TREINTA Y UNO CON 00/100 SOLES'],
  [100, 'SON: CIEN CON 00/100 SOLES'],
  [101, 'SON: CIENTO UNO CON 00/100 SOLES'],
  [500, 'SON: QUINIENTOS CON 00/100 SOLES'],
  [1000, 'SON: MIL CON 00/100 SOLES'],
  [1001, 'SON: MIL UNO CON 00/100 SOLES'],
  [2000, 'SON: DOS MIL CON 00/100 SOLES'],
  [21000, 'SON: VEINTIUN MIL CON 00/100 SOLES'],
  [31000, 'SON: TREINTA Y UN MIL CON 00/100 SOLES'],
  [100000, 'SON: CIEN MIL CON 00/100 SOLES'],
  [1000000, 'SON: UN MILLÓN CON 00/100 SOLES'],
  [1000001, 'SON: UN MILLÓN UNO CON 00/100 SOLES'],
  [2000000, 'SON: DOS MILLONES CON 00/100 SOLES'],
  [0.05, 'SON: CERO CON 05/100 SOLES'],
  [0.5, 'SON: CERO CON 50/100 SOLES'],
  [105.5, 'SON: CIENTO CINCO CON 50/100 SOLES'],
  [999999.99, 'SON: NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE CON 99/100 SOLES'],
  [2266, 'SON: DOS MIL DOSCIENTOS SESENTA Y SEIS CON 00/100 SOLES'],
]
for (const [monto, esperado] of casos) {
  test(`importeEnLetras(${monto})`, () => assert.equal(importeEnLetras(monto), esperado))
}

test('redondea a 2 decimales sin errores de coma flotante', () => {
  assert.equal(importeEnLetras(0.1 + 0.2), 'SON: CERO CON 30/100 SOLES')
  assert.equal(importeEnLetras(1.005), 'SON: UNO CON 01/100 SOLES')
  assert.equal(importeEnLetras(0.285), 'SON: CERO CON 29/100 SOLES')
  assert.equal(importeEnLetras(19.999), 'SON: VEINTE CON 00/100 SOLES')
  assert.equal(importeEnLetras('68.00'), 'SON: SESENTA Y OCHO CON 00/100 SOLES')
})

test('valores no válidos devuelven cadena vacía (no se imprime nada)', () => {
  for (const malo of [NaN, undefined, null, 'abc', -1, Infinity, 1e12]) assert.equal(importeEnLetras(malo), '')
})
