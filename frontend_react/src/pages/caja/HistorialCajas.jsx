import { useEffect, useState } from 'react'
import { AlertTriangle, History } from 'lucide-react'
import { getCajas } from '../../api/caja'
import { Button, Card, EmptyState, Modal, Skeleton, StatusBadge } from '../../components/ui'
import ArqueoCaja from '../../components/ArqueoCaja'
import { soles } from '../admin/util'
import { fechaHora } from '../../utils/dinero'

function EstadoDif({ c }) {
  if (c.estado === 'abierta') return <StatusBadge tone="info">Abierta</StatusBadge>
  const d = Math.round(Number(c.diferencia) * 100)
  if (d === 0) return <StatusBadge tone="success">Cuadra</StatusBadge>
  return <StatusBadge tone={d < 0 ? 'danger' : 'warning'}>{d < 0 ? 'Faltan' : 'Sobran'} {soles(Math.abs(c.diferencia))}</StatusBadge>
}

/** Historial de cajas (solo admin): lista y arqueo imprimible de cada cierre. */
export default function HistorialCajas({ refrescar }) {
  const [cajas, setCajas] = useState(null)
  const [error, setError] = useState(false)
  const [ver, setVer] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    getCajas()
      .then(d => { if (vivo) { setCajas(d); setError(false) } })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [refrescar, intento])

  return (
    <section aria-labelledby="historial-titulo" className="mt-8">
      <h2 id="historial-titulo" className="text-ink font-semibold text-lg flex items-center gap-2 mb-3">
        <History className="size-5 text-muted" aria-hidden="true" /> Historial de cajas
      </h2>
      {error && !cajas ? (
        <Card>
          <EmptyState icon={AlertTriangle} tone="danger" title="No se pudo cargar el historial"
            action={<Button variant="primary" onClick={() => setIntento(n => n + 1)}>Reintentar</Button>} />
        </Card>
      ) : !cajas ? (
        <Card className="p-4 flex flex-col gap-3" aria-busy="true">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</Card>
      ) : cajas.length === 0 ? (
        <Card><EmptyState icon={History} title="Aún no hay cajas" description="Aparecerán aquí cuando alguien abra una." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Historial de cajas</caption>
              <thead>
                <tr className="border-b border-line text-caption text-muted">
                  <th scope="col" className="px-4 py-3 text-left font-medium">Apertura</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Cajero</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium hidden sm:table-cell">Esperado</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium hidden sm:table-cell">Contado</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Resultado</th>
                  <th scope="col" className="px-3 py-3"><span className="sr-only">Ver</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cajas.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 num whitespace-nowrap">{fechaHora(c.abierta_at)}</td>
                    <td className="px-4 py-3">{c.usuario_nombre}</td>
                    <td className="px-4 py-3 text-right num hidden sm:table-cell">{soles(c.monto_esperado)}</td>
                    <td className="px-4 py-3 text-right num hidden sm:table-cell">{c.monto_contado == null ? '—' : soles(c.monto_contado)}</td>
                    <td className="px-4 py-3"><EstadoDif c={c} /></td>
                    <td className="px-3 py-1.5 text-right">
                      {c.estado === 'cerrada' && (
                        <Button variant="ghost" size="sm" onClick={() => setVer(c)} aria-label={`Ver arqueo de la caja ${c.id}`}>Ver arqueo</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {ver && (
        <Modal title={`Arqueo de la caja ${ver.id}`} onClose={() => setVer(null)} className="sm:max-w-2xl">
          <ArqueoCaja caja={ver} />
        </Modal>
      )}
    </section>
  )
}
