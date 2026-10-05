/** Utilidades puras del documento impreso del comprobante (sin React). */
import { importeEnLetras } from './importeEnLetras.js'

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

const METODOS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin' }

/**
 * Datos ya listos para pintar el documento (A4 y ticket usan los mismos).
 * Los importes son los que devuelve el backend: aquí solo se presentan, no se recalculan.
 * `extras` completa lo que el comprobante aún no trae (p. ej. la mesa en la pantalla de cobro).
 */
export function datosDocumento(c, extras = {}) {
  const esFactura = c.tipo === 'factura'
  const [fecha = '', hora = ''] = String(c.created_at || '').split(' ')
  const tieneCliente = !!(c.nro_doc_cliente || c.razon_social || c.direccion_cliente)
  return {
    esFactura,
    tipoTexto: esFactura ? 'FACTURA' : 'BOLETA DE VENTA',
    numero: c.numero,
    fecha,
    hora,
    mesa: c.mesa ?? extras.mesa ?? '',
    atendidoPor: c.atendido_por ?? extras.atendidoPor ?? '',
    metodo: METODOS[c.metodo_pago] || c.metodo_pago || '',
    pagoEfectivo: c.metodo_pago === 'efectivo',
    montoPagado: c.monto_pagado,
    vuelto: c.vuelto,
    cliente: {
      sinDocumento: !tieneCliente,
      etiquetaDoc: esFactura ? 'RUC' : 'DNI',
      doc: c.nro_doc_cliente || '',
      etiquetaNombre: esFactura ? 'Razón social' : 'Cliente',
      nombre: c.razon_social || '',
      direccion: c.direccion_cliente || '',
    },
    items: (c.items || []).map(i => ({
      cantidad: formatoCantidad(i.cantidad), descripcion: i.descripcion, precioUnit: i.precio_unit, importe: i.subtotal,
    })),
    subtotal: c.subtotal,
    igv: c.igv,
    descuento: Number(c.descuento) || 0,
    total: c.total,
    letras: importeEnLetras(c.total),
  }
}

/** Alto de página del ticket (mm) a partir del alto medido del contenido (px CSS, 96 por pulgada), con holgura. */
export const alturaTicketMm = (px) => Math.ceil((Math.max(0, px) * 25.4) / 96) + 4
