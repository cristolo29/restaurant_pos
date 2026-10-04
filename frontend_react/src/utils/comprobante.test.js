import test from 'node:test'
import assert from 'node:assert/strict'
import { formatearSoles, tituloDocumento, formatoCantidad, FORMATOS, formatoValido } from './comprobante.js'

test('formatearSoles agrupa miles y fija 2 decimales', () => {
  assert.equal(formatearSoles(0), 'S/ 0.00')
  assert.equal(formatearSoles(12.5), 'S/ 12.50')
  assert.equal(formatearSoles(1234.5), 'S/ 1,234.50')
  assert.equal(formatearSoles('2266'), 'S/ 2,266.00')
  assert.equal(formatearSoles(1234567.891), 'S/ 1,234,567.89')
  assert.equal(formatearSoles(0.285), 'S/ 0.29')
})

test('formatearSoles con valor inválido muestra S/ 0.00 y no NaN', () => {
  assert.equal(formatearSoles(undefined), 'S/ 0.00')
  assert.equal(formatearSoles(null), 'S/ 0.00')
  assert.equal(formatearSoles('x'), 'S/ 0.00')
})

test('formatearSoles negativo conserva el signo', () => {
  assert.equal(formatearSoles(-1234.5), '-S/ 1,234.50')
})

test('tituloDocumento propone un nombre de archivo útil', () => {
  assert.equal(tituloDocumento({ tipo: 'boleta', numero: 'B001-000001' }), 'Boleta B001-000001')
  assert.equal(tituloDocumento({ tipo: 'factura', numero: 'F001-000001' }), 'Factura F001-000001')
})

test('formatoCantidad muestra enteros y conserva fracciones reales', () => {
  assert.equal(formatoCantidad(2), '2')
  assert.equal(formatoCantidad('3.000'), '3')
  assert.equal(formatoCantidad(1.5), '1.5')
})

test('formatoValido solo acepta a4 o ticket', () => {
  assert.deepEqual(FORMATOS.map(f => f.id), ['a4', 'ticket'])
  assert.equal(formatoValido('a4'), true)
  assert.equal(formatoValido('ticket'), true)
  assert.equal(formatoValido('pdf'), false)
  assert.equal(formatoValido(null), false)
})
