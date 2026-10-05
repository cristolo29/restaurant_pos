import test from 'node:test'
import assert from 'node:assert/strict'
import { leerEmisor } from './emisor.js'

test('sin variables: solo el nombre por defecto, nada inventado', () => {
  assert.deepEqual(leerEmisor({}), { nombre: 'Orbezo Resto Bar', ruc: '', direccion: '', telefono: '', logo: '', leyenda: '' })
})

test('con variables: las lee y recorta espacios', () => {
  const e = leerEmisor({ VITE_EMISOR_NOMBRE: ' Mi Local ', VITE_EMISOR_RUC: '20000000001 ', VITE_COMPROBANTE_LEYENDA: 'Documento interno' })
  assert.equal(e.nombre, 'Mi Local')
  assert.equal(e.ruc, '20000000001')
  assert.equal(e.leyenda, 'Documento interno')
  assert.equal(e.direccion, '')
})
