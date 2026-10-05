import { Printer } from 'lucide-react'
import { Button } from './ui'
import { soles } from '../pages/admin/util'
import { TIPO_MOVIMIENTO, fechaHora } from '../utils/dinero'

// Documento en papel: blanco y negro siempre, igual que el arqueo y el comprobante.
const ESTILO_IMPRESION = `
  @media print {
    @page { margin: 8mm; }
    body * { visibility: hidden; }
    #comprobante-movimiento, #comprobante-movimiento * { visibility: visible; }
    #comprobante-movimiento { position: fixed; top: 0; left: 0; width: 100%; border: none !important; border-radius: 0 !important; }
    #comprobante-movimiento .no-print { display: none !important; }
  }
`

const Fila = ({ k, v, fuerte = false }) => (
  <div className={`flex justify-between gap-6 ${fuerte ? 'font-bold text-lg' : ''}`}>
    <span className={fuerte ? '' : 'text-zinc-500'}>{k}</span>
    <span className="text-right">{v}</span>
  </div>
)

/** Comprobante interno corto de un movimiento de efectivo (no es comprobante de pago), imprimible. */
export default function ComprobanteMovimiento({ movimiento, cajaId }) {
  const t = TIPO_MOVIMIENTO[movimiento.tipo]
  return (
    <div id="comprobante-movimiento" className="bg-white text-zinc-900 rounded-control border border-zinc-300 text-base">
      <style>{ESTILO_IMPRESION}</style>
      <div className="no-print flex justify-end px-4 py-3 border-b border-zinc-200">
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>Imprimir comprobante</Button>
      </div>
      <div className="px-5 sm:px-8 py-6 flex flex-col gap-4">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tracking-tight">Orbezo Resto Bar</p>
            <p className="text-zinc-500 text-sm">Comprobante interno de caja</p>
          </div>
          <div className="border-2 border-zinc-900 rounded-lg px-4 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide">Mov. N.º</p>
            <p className="text-xl font-bold tabular-nums">{movimiento.id}</p>
          </div>
        </div>
        <div className="border-y border-zinc-300 py-3 flex flex-col gap-1.5">
          <Fila k="Tipo" v={<strong>{t.etiqueta}</strong>} />
          <Fila k="Fecha y hora" v={fechaHora(movimiento.created_at)} />
          <Fila k="Caja N.º" v={cajaId} />
          <Fila k="Responsable" v={movimiento.usuario_nombre || '—'} />
        </div>
        <Fila k="Monto" v={<span className="text-2xl tabular-nums">{t.signo} {soles(movimiento.monto)}</span>} fuerte />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Motivo</p>
          <p className="mt-1 break-words">{movimiento.motivo}</p>
        </div>
        <p className="text-zinc-500 text-xs">Documento interno de control de efectivo. No es un comprobante de pago.</p>
        <div className="grid grid-cols-2 gap-10 pt-8 text-center text-sm text-zinc-500">
          <p className="border-t border-zinc-400 pt-1">Entrega / Registra</p>
          <p className="border-t border-zinc-400 pt-1">Recibe / Autoriza</p>
        </div>
      </div>
    </div>
  )
}
