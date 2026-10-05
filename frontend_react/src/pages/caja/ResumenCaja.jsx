import { AlertTriangle, Banknote, CreditCard, QrCode, Smartphone, Lock, Clock, Receipt, ArrowDownToLine, ArrowUpFromLine, Landmark, EyeOff } from 'lucide-react'
import { Button, Card } from '../../components/ui'
import { METODO_LABEL, soles } from '../admin/util'
import { hora } from '../../utils/dinero'
import ListaMovimientos from './ListaMovimientos'

const Linea = ({ k, v }) => (
  <div className="flex items-center justify-between min-h-11">
    <dt className="text-soft">{k}</dt>
    <dd className="text-ink font-semibold num">{v}</dd>
  </div>
)

const ICONOS = { efectivo: Banknote, tarjeta: CreditCard, yape: Smartphone, plin: QrCode }

/** Caja abierta: resumen en vivo del turno, movimientos de efectivo y botón para cerrar. */
export default function ResumenCaja({ caja, onCerrar, onMovimiento }) {
  const mov = caja.totales_movimientos
  const ciego = caja.monto_esperado === undefined || caja.monto_esperado === null
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
      </Card>

      <Card className="p-5">
        <h2 className="text-ink font-semibold mb-3">Efectivo en la gaveta</h2>
        <dl className="divide-y divide-line">
          <Linea k="Fondo inicial" v={soles(caja.monto_inicial)} />
          <Linea k="+ Cobrado en efectivo" v={soles(caja.efectivo_cobrado)} />
          <Linea k="+ Ingresos" v={soles(mov.ingreso)} />
          <Linea k="− Egresos" v={soles(mov.egreso)} />
          <Linea k="− Retiros" v={soles(mov.retiro)} />
        </dl>
        {ciego ? (
          <p className="mt-4 pt-4 border-t border-line text-muted text-sm flex items-center gap-2">
            <EyeOff className="size-5 shrink-0" aria-hidden="true" />
            El efectivo esperado se muestra al confirmar tu conteo (cierre a ciegas).
          </p>
        ) : (
          <div className="mt-4 pt-4 border-t border-line flex items-baseline justify-between gap-3">
            <div>
              <p className="text-ink font-semibold">Efectivo esperado en caja</p>
              <p className="text-muted text-caption">Fondo + cobrado en efectivo + ingresos − egresos − retiros</p>
            </div>
            <p className="text-accent text-3xl font-bold num">{soles(caja.monto_esperado)}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Button variant="secondary" icon={ArrowDownToLine} onClick={() => onMovimiento('ingreso')} className="min-h-14">Ingreso</Button>
          <Button variant="secondary" icon={ArrowUpFromLine} onClick={() => onMovimiento('egreso')} className="min-h-14">Egreso</Button>
          <Button variant="secondary" icon={Landmark} onClick={() => onMovimiento('retiro')} className="min-h-14">Retiro</Button>
        </div>
      </Card>

      <ListaMovimientos movimientos={caja.movimientos} cajaId={caja.id} />

      <Button variant="primary" size="lg" icon={Lock} onClick={onCerrar} className="text-lg sm:self-end sm:min-w-64">
        Cerrar caja
      </Button>
    </div>
  )
}
