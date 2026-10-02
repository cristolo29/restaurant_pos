import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui'
import { getDashboard } from '../api/dashboard'
import DashboardKpis, { KpisSkeleton } from './admin/DashboardKpis'
import { VentasSemana, TopProductos } from './admin/DashboardCharts'
import DashboardRecientes from './admin/DashboardRecientes'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setData(await getDashboard())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [cargar])

  const hoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  const primeraCarga = cargando && !data

  return (
    <div className="min-h-dvh bg-app text-ink">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        <PageHeader title="Resumen del día" subtitle={<span className="capitalize">{hoy}</span>}>
          <Button variant="secondary" icon={RefreshCw} loading={cargando && !!data} onClick={cargar}>Actualizar</Button>
        </PageHeader>

        {error && data && (
          <p role="alert" className="text-warning text-sm bg-warning/10 rounded-control px-3 py-2 mb-4">
            No se pudo actualizar. Se muestran los últimos datos cargados.
          </p>
        )}

        {primeraCarga ? (
          <div className="flex flex-col gap-4 sm:gap-6" aria-busy="true">
            <KpisSkeleton />
            <Skeleton className="h-72 rounded-panel" />
            <Skeleton className="h-56 rounded-panel" />
          </div>
        ) : !data ? (
          <Card>
            <EmptyState icon={AlertTriangle} tone="danger" title="No se pudo cargar el resumen"
              description="Revisa la conexión e inténtalo de nuevo."
              action={<Button variant="primary" icon={RefreshCw} onClick={cargar}>Reintentar</Button>} />
          </Card>
        ) : (
          <div className="flex flex-col gap-4 sm:gap-6">
            <DashboardKpis data={data} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <VentasSemana ventas={data.ventas_semana} />
              <TopProductos productos={data.top_productos} />
            </div>
            <DashboardRecientes comprobantes={data.comprobantes_recientes} />
          </div>
        )}
      </main>
    </div>
  )
}
