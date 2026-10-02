import { AlertTriangle, Banknote, CreditCard, QrCode, Smartphone, Lock, Clock, Receipt } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { METODO_LABEL, soles } from '../admin/util'
import { hora } from '../../utils/dinero'

const ICONOS = { efectivo: Banknote, tarjeta: CreditCard, yape: Smartphone, plin: QrCode }

/** Caja abierta: resumen en vivo del turno y botón para cerrar. */
export default function ResumenCaja({ caja, onCerrar }) {
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {caja.advertencia && (
        <p role="status" className="bg-warning/10 border border-warning/40 text-warning rounded-control px-4 py-3 flex items-center gap-2 font-medium">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" /> {caja.advertencia}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-muted text-sm flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" /> Abierta a las</p>
          <p className="text-ink text-2xl font-bold num mt-1">{hora(caja.abierta_at)}</p>
          <p className="text-muted text-sm mt-3">Fondo inicial</p>
          <p className="text-ink text-xl font-semibold num">{soles(caja.monto_inicial)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-muted text-sm flex items-center gap-1.5"><Receipt className="size-4" aria-hidden="true" /> Comprobantes emitidos</p>
          <p className="text-ink text-2xl font-bold num mt-1">{caja.comprobantes}</p>
          <p className="text-muted text-sm mt-3">Total cobrado</p>
          <p className="text-ink text-xl font-semibold num">{soles(caja.total_cobrado)}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-ink font-semibold mb-3">Cobrado por método de pago</h2>
        <ul className="divide-y divide-line">
          {Object.entries(caja.por_metodo).map(([m, v]) => {
            const Icono = ICONOS[m]
            return (
              <li key={m} className="flex items-center justify-between min-h-12">
                <span className="flex items-center gap-2 text-soft"><Icono className="size-5 text-muted" aria-hidden="true" /> {METODO_LABEL[m]}</span>
                <span className="text-ink font-semibold num">{soles(v)}</span>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 pt-4 border-t border-line flex items-baseline justify-between gap-3">
          <div>
            <p className="text-ink font-semibold">Efectivo esperado en caja</p>
            <p className="text-muted text-caption">Fondo inicial + cobrado en efectivo</p>
          </div>
          <p className="text-accent text-3xl font-bold num">{soles(caja.monto_esperado)}</p>
        </div>
      </Card>

      <Button variant="primary" size="lg" icon={Lock} onClick={onCerrar} className="text-lg sm:self-end sm:min-w-64">
        Cerrar caja
      </Button>
    </div>
  )
}
