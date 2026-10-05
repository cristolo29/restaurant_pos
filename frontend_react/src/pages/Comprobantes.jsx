import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/ui'
import { getComprobantes } from '../api/admin'
import ComprobantesSeccion from './admin/ComprobantesSeccion'

/** Acceso directo (barra lateral) a la sección Comprobantes de Admin. */
export default function Comprobantes() {
  const [comprobantes, setComprobantes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setComprobantes(await getComprobantes())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let activo = true
    getComprobantes()
      .then(d => { if (activo) setComprobantes(d) })
      .catch(() => { if (activo) setError(true) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  return (
    <div className="min-h-dvh bg-app text-ink">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        <PageHeader title="Comprobantes" subtitle="Boletas y facturas emitidas" />
        <ComprobantesSeccion comprobantes={comprobantes} cargando={cargando} error={error} onReintentar={cargar} />
      </div>
    </div>
  )
}
