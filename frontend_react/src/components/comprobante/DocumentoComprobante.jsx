import './comprobante.css'
import { EMISOR } from '../../config/emisor'
import { datosDocumento } from '../../utils/comprobante'
import DocumentoA4 from './DocumentoA4'
import DocumentoTicket from './DocumentoTicket'

/**
 * Único documento del comprobante, con dos variantes: `a4` (documento) y `ticket` (rollo de 80 mm).
 * `mesa` y `atendidoPor` solo completan lo que el comprobante aún no traiga.
 */
export default function DocumentoComprobante({ c, variante = 'a4', mesa, atendidoPor, emisor = EMISOR }) {
  const d = datosDocumento(c, { mesa, atendidoPor })
  return variante === 'ticket' ? <DocumentoTicket d={d} emisor={emisor} /> : <DocumentoA4 d={d} emisor={emisor} />
}
