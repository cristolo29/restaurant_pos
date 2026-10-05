import ImpresionComprobante from './comprobante/ImpresionComprobante'

/**
 * Impresión del comprobante tras cobrar: selector de formato (por defecto Ticket 80 mm) + «Imprimir».
 * Conserva las props de siempre; el documento es el mismo que usa el detalle del admin
 * (components/comprobante/DocumentoComprobante). Los datos de pago salen del comprobante del servidor;
 * `metodo`, `vuelto` y `montoPagado` solo completan lo que falte.
 */
export default function TicketBoleta({ comprobante, mesa, metodo, vuelto, montoPagado }) {
  const c = {
    ...comprobante,
    metodo_pago: comprobante.metodo_pago ?? metodo,
    vuelto: comprobante.vuelto ?? vuelto,
    monto_pagado: comprobante.monto_pagado ?? montoPagado,
  }
  return <ImpresionComprobante c={c} mesa={mesa?.numero} porDefecto="ticket" vistaPrevia={false} />
}
