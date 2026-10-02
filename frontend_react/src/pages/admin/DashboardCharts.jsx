import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, EmptyState } from '../../components/ui'
import { BarChart3 } from 'lucide-react'
import { soles } from './util'
import { COLORES_GRAFICO } from './chartColors'

function TooltipVentas({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-line rounded-control px-3 py-2 text-sm shadow-xl">
      <p className="text-muted mb-1">{label}</p>
      <p className="num text-accent font-bold">{soles(payload[0].value)}</p>
    </div>
  )
}

const Leyenda = ({ color, texto }) => (
  <span className="inline-flex items-center gap-1.5 text-muted text-caption">
    <span className="size-3 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />{texto}
  </span>
)

export function VentasSemana({ ventas }) {
  const hayVentas = ventas.some(v => Number(v.total) > 0)
  return (
    <Card className="lg:col-span-2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-ink font-semibold">Ventas últimos 7 días</h2>
          <p className="text-muted text-caption">Total en soles (S/)</p>
        </div>
        <div className="flex gap-4">
          <Leyenda color={COLORES_GRAFICO.acento} texto="Hoy" />
          <Leyenda color={COLORES_GRAFICO.serie} texto="Días anteriores" />
        </div>
      </div>
      {!hayVentas ? (
        <EmptyState icon={BarChart3} title="Sin ventas en los últimos 7 días" className="py-10" />
      ) : (
        <>
          <div role="img" aria-label={`Ventas por día: ${ventas.map(v => `${v.dia} ${soles(v.total)}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ventas} barSize={32}>
                <CartesianGrid vertical={false} stroke={COLORES_GRAFICO.rejilla} strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fill: COLORES_GRAFICO.texto, fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: COLORES_GRAFICO.texto, fontSize: 13 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `S/ ${v}`} width={64} />
                <Tooltip content={<TooltipVentas />} cursor={{ fill: COLORES_GRAFICO.cursor, opacity: 0.4 }} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {ventas.map((_, i) => (
                    <Cell key={i} fill={i === ventas.length - 1 ? COLORES_GRAFICO.acento : COLORES_GRAFICO.serie} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  )
}

export function TopProductos({ productos }) {
  return (
    <Card className="p-5">
      <h2 className="text-ink font-semibold">Top productos hoy</h2>
      <p className="text-muted text-caption mb-4">Por unidades vendidas</p>
      {productos.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sin ventas hoy" className="py-10" />
      ) : (
        <ol className="flex flex-col gap-3">
          {productos.map((p, i) => {
            const pct = Math.round((p.cantidad / productos[0].cantidad) * 100)
            return (
              <li key={i}>
                <div className="flex justify-between items-center mb-1 gap-2">
                  <span className="text-ink text-sm truncate">{i + 1}. {p.nombre}</span>
                  <span className="num text-muted text-caption shrink-0">{p.cantidad} uds</span>
                </div>
                <div className="h-2 bg-raised rounded-full overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
