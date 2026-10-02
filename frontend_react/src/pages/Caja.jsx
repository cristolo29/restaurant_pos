import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import useCaja from '../store/useCaja'
import useAuth from '../store/useAuth'
import { cerrarCaja } from '../api/caja'
import ModalConfirm from '../components/ModalConfirm'
import ArqueoCaja from '../components/ArqueoCaja'
import { Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui'
import { toast } from '../store/useToast'
import { soles } from './admin/util'
import { estadoArqueo, hora } from '../utils/dinero'
import AbrirCaja from './caja/AbrirCaja'
import ResumenCaja from './caja/ResumenCaja'
import CerrarCajaModal from './caja/CerrarCajaModal'
import HistorialCajas from './caja/HistorialCajas'

const REFRESCO_MS = 15000

export default function Caja() {
  const caja = useCaja(s => s.caja)
  const cargada = useCaja(s => s.cargada)
  const error = useCaja(s => s.error)
  const rol = useAuth(s => s.usuario?.rol_nombre)
  const [paso, setPaso] = useState(null) // null | 'contar' | 'confirmar'
  const [contado, setContado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cerrada, setCerrada] = useState(null) // arqueo final tras cerrar
  const [version, setVersion] = useState(0)    // fuerza recargar el historial

  // Resumen en vivo: refresca al entrar y cada 15 s mientras la caja esté abierta y no se esté cerrando.
  useEffect(() => {
    useCaja.getState().cargar()
    if (paso) return
    const id = setInterval(() => useCaja.getState().cargar(), REFRESCO_MS)
    return () => clearInterval(id)
  }, [paso])

  const iniciarCierre = () => { setContado(''); setObservaciones(''); setPaso('contar') }

  async function confirmarCierre() {
    const { contadoC } = estadoArqueo(caja, contado, observaciones)
    try {
      const arqueo = await cerrarCaja(contadoC / 100, observaciones.trim())
      useCaja.getState().fijar(null)
      setCerrada(arqueo)
      setPaso(null)
      setVersion(v => v + 1)
      toast.exito('Caja cerrada')
    } catch (e) {
      // 409: ya estaba cerrada en otro lado; refrescar para reflejar la realidad
      if (e.response?.status === 409) useCaja.getState().cargar()
      throw e
    }
  }

  let contenido
  if (cerrada) {
    contenido = (
      <div className="max-w-3xl flex flex-col gap-4">
        <p role="status" className="bg-success/10 border border-success/30 text-success rounded-control px-4 py-3 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /> Caja cerrada. Imprime el arqueo y guarda el efectivo.
        </p>
        <ArqueoCaja caja={cerrada} />
        <Button variant="secondary" size="lg" onClick={() => setCerrada(null)} className="sm:self-end">Listo, abrir una nueva caja</Button>
      </div>
    )
  } else if (!cargada) {
    contenido = <div className="max-w-3xl flex flex-col gap-4" aria-busy="true" aria-label="Cargando caja"><Skeleton className="h-32" /><Skeleton className="h-48" /></div>
  } else if (error && !caja) {
    contenido = (
      <Card>
        <EmptyState icon={AlertTriangle} tone="danger" title="No se pudo cargar la caja"
          description="Revisa la conexión e inténtalo de nuevo."
          action={<Button variant="primary" onClick={() => useCaja.getState().cargar()}>Reintentar</Button>} />
      </Card>
    )
  } else if (!caja) {
    contenido = <AbrirCaja onAbierta={(c) => { useCaja.getState().fijar(c); toast.exito('Caja abierta') }} />
  } else {
    contenido = <ResumenCaja caja={caja} onCerrar={iniciarCierre} />
  }

  const { dif } = caja ? estadoArqueo(caja, contado, observaciones) : {}

  return (
    <div className="min-h-screen bg-app text-ink">
      <main className="p-4 sm:p-6">
        <PageHeader
          title="Caja"
          subtitle={caja ? `Abierta a las ${hora(caja.abierta_at)} · ${caja.usuario_nombre}` : 'Apertura, resumen del turno y arqueo de cierre'}
        />
        {contenido}
        {rol === 'admin' && <HistorialCajas refrescar={version} />}
      </main>

      {paso === 'contar' && caja && (
        <CerrarCajaModal
          caja={caja}
          contado={contado} setContado={setContado}
          observaciones={observaciones} setObservaciones={setObservaciones}
          onContinuar={() => setPaso('confirmar')}
          onCancelar={() => setPaso(null)}
        />
      )}
      {paso === 'confirmar' && caja && (
        <ModalConfirm
          titulo={`¿Cerrar la caja de ${caja.usuario_nombre}?`}
          mensaje={`Se cierra la caja abierta a las ${hora(caja.abierta_at)}. Esperado ${soles(caja.monto_esperado)}, contado ${soles(Number(contado.replace(',', '.')))}: ${dif?.texto.toLowerCase()}. Una caja cerrada no se puede reabrir ni modificar.`}
          labelConfirm="Sí, cerrar caja"
          colorConfirm="warning"
          onConfirm={confirmarCierre}
          onCancel={() => setPaso(p => (p === 'confirmar' ? 'contar' : p))}
        />
      )}
    </div>
  )
}
