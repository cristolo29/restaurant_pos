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

import { datosDocumento } from './comprobante.js'

const BASE = {
  tipo: 'boleta', numero: 'B001-000001', created_at: '04/10/2026 13:11', metodo_pago: 'efectivo',
  monto_pagado: 100, vuelto: 32, subtotal: 57.63, igv: 10.37, descuento: 0, total: 68,
  nro_doc_cliente: null, razon_social: null, direccion_cliente: null,
  items: [{ descripcion: 'Lomo Saltado', cantidad: 2, precio_unit: 28, subtotal: 56 }],
}

test('datosDocumento: boleta sin cliente muestra «Cliente sin documento»', () => {
  const d = datosDocumento(BASE)
  assert.equal(d.tipoTexto, 'BOLETA DE VENTA')
  assert.equal(d.cliente.sinDocumento, true)
  assert.equal(d.fecha, '04/10/2026')
  assert.equal(d.hora, '13:11')
  assert.equal(d.letras, 'SON: SESENTA Y OCHO CON 00/100 SOLES')
})

test('datosDocumento: boleta con DNI usa «Cliente» y factura usa RUC y «Razón social»', () => {
  const b = datosDocumento({ ...BASE, nro_doc_cliente: '45871236', razon_social: 'Rosa Quispe' }).cliente
  assert.deepEqual([b.etiquetaDoc, b.etiquetaNombre, b.sinDocumento], ['DNI', 'Cliente', false])
  const f = datosDocumento({ ...BASE, tipo: 'factura', nro_doc_cliente: '20512345678', razon_social: 'ACME SAC', direccion_cliente: 'Av. X 1' })
  assert.equal(f.tipoTexto, 'FACTURA')
  assert.deepEqual([f.cliente.etiquetaDoc, f.cliente.etiquetaNombre, f.cliente.direccion], ['RUC', 'Razón social', 'Av. X 1'])
})

test('datosDocumento: monto pagado y vuelto solo en efectivo', () => {
  assert.equal(datosDocumento(BASE).pagoEfectivo, true)
  assert.equal(datosDocumento({ ...BASE, metodo_pago: 'yape' }).pagoEfectivo, false)
  assert.equal(datosDocumento(BASE).metodo, 'Efectivo')
})

test('datosDocumento: mesa y atendido por vienen del comprobante o de lo que pase el llamador', () => {
  assert.equal(datosDocumento({ ...BASE, mesa: '03', atendido_por: 'Ana' }).mesa, '03')
  assert.equal(datosDocumento(BASE, { mesa: '07', atendidoPor: 'Luis' }).atendidoPor, 'Luis')
  assert.equal(datosDocumento(BASE).mesa, '')
})

import { alturaTicketMm } from './comprobante.js'

test('alturaTicketMm convierte píxeles CSS a mm con holgura para no generar una segunda hoja', () => {
  assert.equal(alturaTicketMm(96), 30)  // 25.4 mm redondeado hacia arriba (26) + 4 mm de holgura
  assert.equal(alturaTicketMm(0), 4)
  assert.ok(alturaTicketMm(3000) > 3000 * 25.4 / 96)
})
