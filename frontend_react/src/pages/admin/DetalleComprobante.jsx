import ImpresionComprobante from '../../components/comprobante/ImpresionComprobante'

/**
 * Detalle del comprobante en el admin: vista previa del documento (A4 o Ticket 80 mm, a elección y recordado)
 * e «Imprimir». El documento es el mismo que usa la pantalla de cobro.
 */
export default function DetalleComprobante({ c }) {
  return <ImpresionComprobante c={c} porDefecto="a4" />
}
