import { Wallet, TrendingUp, Receipt, Armchair, ClipboardList } from 'lucide-react'
import { Card, Skeleton, cn } from '../../components/ui'
import { soles } from './util'

function Kpi({ icon: Icon, label, valor, sub, tono }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className={cn('size-10 rounded-control grid place-items-center mb-3', tono)}>
        {Icon && <Icon className="size-5" aria-hidden="true" />}
      </div>
      <p className="text-muted text-caption uppercase tracking-wider">{label}</p>
      <p className="num text-ink text-2xl font-bold mt-0.5">{valor}</p>
      {sub && <p className="text-muted text-caption mt-0.5">{sub}</p>}
    </Card>
  )
}

export function KpisSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4" aria-busy="true">
      {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-panel" />)}
    </div>
  )
}

export default function DashboardKpis({ data }) {
  const ventas = Number(data.ventas_hoy)
  const nComp = Number(data.comprobantes_hoy)
  // Derivado solo para presentación: ventas del día / comprobantes emitidos.
  const ticketPromedio = nComp > 0 ? ventas / nComp : 0
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      <Kpi icon={Wallet} label="Ventas hoy" valor={soles(ventas)} tono="bg-accent/10 text-accent" />
      <Kpi icon={TrendingUp} label="Ticket promedio" valor={soles(ticketPromedio)} sub="por comprobante" tono="bg-success/10 text-success" />
      <Kpi icon={Receipt} label="Comprobantes" valor={data.comprobantes_hoy} sub="emitidos hoy" tono="bg-info/10 text-blue-300" />
      <Kpi icon={Armchair} label="Mesas ocupadas" valor={`${data.mesas_ocupadas} / ${data.mesas_total}`}
        sub={`${data.mesas_total - data.mesas_ocupadas} disponibles`} tono="bg-warning/10 text-warning" />
      <Kpi icon={ClipboardList} label="Pedidos abiertos" valor={data.pedidos_abiertos} sub="en este momento" tono="bg-success/10 text-success" />
    </div>
  )
}
