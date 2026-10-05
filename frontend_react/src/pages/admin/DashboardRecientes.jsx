import { Receipt } from 'lucide-react'
import { Card, EmptyState, StatusBadge } from '../../components/ui'
import { soles } from './util'

const TH = 'px-5 py-3 text-caption font-medium text-muted uppercase tracking-wider'

export default function DashboardRecientes({ comprobantes }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex justify-between items-center">
        <h2 className="text-ink font-semibold">Últimos comprobantes</h2>
        <span className="text-muted text-caption">{comprobantes.length} registros</span>
      </div>
      {comprobantes.length === 0 ? (
        <EmptyState icon={Receipt} title="Sin comprobantes aún" className="py-10" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Últimos comprobantes emitidos</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${TH} text-left`}>N°</th>
                <th scope="col" className={`${TH} text-left`}>Tipo</th>
                <th scope="col" className={`${TH} text-left`}>Mesa</th>
                <th scope="col" className={`${TH} text-left hidden sm:table-cell`}>Hora</th>
                <th scope="col" className={`${TH} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {comprobantes.map((c, i) => (
                <tr key={i} className="hover:bg-raised/30 transition-colors">
                  <td className="px-5 py-3 text-accent font-medium whitespace-nowrap">{c.numero}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={c.tipo === 'factura' ? 'info' : 'success'}>{c.tipo === 'factura' ? 'Factura' : 'Boleta'}</StatusBadge>
                  </td>
                  <td className="px-5 py-3 text-soft">Mesa {c.mesa}</td>
                  <td className="num px-5 py-3 text-muted hidden sm:table-cell">{c.hora}</td>
                  <td className="num px-5 py-3 text-ink font-semibold text-right whitespace-nowrap">{soles(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
