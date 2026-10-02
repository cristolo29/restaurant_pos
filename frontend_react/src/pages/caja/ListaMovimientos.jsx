import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Printer, ArrowLeftRight } from 'lucide-react'
import { Button, Card, EmptyState, Modal, StatusBadge } from '../../components/ui'
import ComprobanteMovimiento from '../../components/ComprobanteMovimiento'
import { soles } from '../admin/util'
import { TIPO_MOVIMIENTO, hora } from '../../utils/dinero'

const VISTA = {
  ingreso: { tone: 'success', Icono: ArrowDownToLine },
  egreso: { tone: 'warning', Icono: ArrowUpFromLine },
  retiro: { tone: 'info', Icono: Landmark },
}

/** Movimientos de efectivo del turno: hora, tipo (texto + icono), monto, usuario y motivo. Solo lectura. */
export default function ListaMovimientos({ movimientos, cajaId }) {
  const [ver, setVer] = useState(null)
  const lista = [...movimientos].reverse() // más reciente primero

  return (
    <Card className="p-5">
      <h2 className="text-ink font-semibold mb-1 flex items-center gap-2">
        <ArrowLeftRight className="size-5 text-muted" aria-hidden="true" /> Movimientos de efectivo
      </h2>
      {lista.length === 0 ? (
        <EmptyState className="py-8" title="Sin movimientos en este turno" description="Registra aquí los ingresos, egresos y retiros de la gaveta." />
      ) : (
        <ul className="divide-y divide-line">
          {lista.map(m => {
            const { tone, Icono } = VISTA[m.tipo]
            const t = TIPO_MOVIMIENTO[m.tipo]
            return (
              <li key={m.id} className="flex items-center gap-3 py-2.5 min-h-14">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 flex-wrap">
                    <StatusBadge tone={tone} icon={Icono}>{t.corto}</StatusBadge>
                    <span className="text-muted text-caption num">{hora(m.created_at)} · {m.usuario_nombre}</span>
                  </p>
                  <p className="text-soft text-sm mt-0.5 break-words">{m.motivo}</p>
                </div>
                <p className="text-ink font-semibold num shrink-0">{t.signo} {soles(m.monto)}</p>
                <Button variant="ghost" iconOnly icon={Printer} aria-label={`Imprimir comprobante del movimiento ${m.id}`} onClick={() => setVer(m)} />
              </li>
            )
          })}
        </ul>
      )}
      {ver && (
        <Modal title={`Movimiento ${ver.id}`} onClose={() => setVer(null)} className="sm:max-w-lg">
          <ComprobanteMovimiento movimiento={ver} cajaId={cajaId} />
        </Modal>
      )}
    </Card>
  )
}
