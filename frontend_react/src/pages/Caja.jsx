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
import DiferenciaCaja from '../components/DiferenciaCaja'
import { deCentimos, estadoArqueo, hora } from '../utils/dinero'
import AbrirCaja from './caja/AbrirCaja'
import ResumenCaja from './caja/ResumenCaja'
import CerrarCajaModal from './caja/CerrarCajaModal'
import HistorialCajas from './caja/HistorialCajas'
import MovimientoModal from './caja/MovimientoModal'
import AutorizarCierreModal from './caja/AutorizarCierreModal'

const REFRESCO_MS = 15000

/** Cierre a ciegas: el cajero confirma solo lo que contó; el admin (que recibe el esperado) ve también el resultado. */
function mensajeConfirmacion(caja, d) {
  const base = `Caja abierta a las ${hora(caja.abierta_at)}: contaste ${soles(deCentimos(d.contadoC))}.`
  const { dif } = estadoArqueo(caja, d.contadoC, d.observaciones)
  const resultado = dif ? ` Esperado ${soles(caja.monto_esperado)}. Resultado: ${dif.texto}.` : ' El sistema te mostrará el resultado al cerrar.'
  return `${base}${resultado} Una caja cerrada no se puede reabrir ni modificar.`
}

export default function Caja() {
  const caja = useCaja(s => s.caja)
  const cargada = useCaja(s => s.cargada)
  const error = useCaja(s => s.error)
  const rol = useAuth(s => s.usuario?.rol_nombre)
  const [paso, setPaso] = useState(null) // null | 'contar' | 'confirmar' | 'diferencia'
  const [datos, setDatos] = useState(null) // { contadoC, conteo, conteoCrudo, contado, observaciones }
  const [requierePin, setRequierePin] = useState(false)
  const [movimiento, setMovimiento] = useState(null) // tipo del movimiento que se está registrando
  const [cerrada, setCerrada] = useState(null) // arqueo final tras cerrar
  const [version, setVersion] = useState(0)    // fuerza recargar el historial

  // Resumen en vivo: refresca al entrar y cada 15 s mientras la caja esté abierta y no se esté cerrando.
  useEffect(() => {
    useCaja.getState().cargar()
    if (paso) return
    const id = setInterval(() => useCaja.getState().cargar(), REFRESCO_MS)
    return () => clearInterval(id)
  }, [paso])

  const iniciarCierre = () => { setDatos(null); setRequierePin(false); setPaso('contar') }

  function finalizarCierre(arqueo) {
    useCaja.getState().fijar(null)
    setCerrada(arqueo)
    setPaso(null)
    setDatos(null)
    setVersion(v => v + 1)
    toast.exito('Caja cerrada')
  }

  /**
   * Envía el cierre. Cierre a ciegas: el servidor decide. Si pide explicar la diferencia (422) o la autorización
   * de un administrador (403), se pasa al paso 'diferencia' en vez de mostrar un error genérico.
   * Con `desdeAutorizacion` los errores se relanzan para que los muestre ese modal.
   */
  async function enviarCierre(d, pin, desdeAutorizacion = false) {
    try {
      finalizarCierre(await cerrarCaja({
        monto_contado: d.contadoC / 100, observaciones: d.observaciones, conteo: d.conteo, pin_autorizacion: pin,
      }))
    } catch (e) {
      const status = e.response?.status
      const detail = e.response?.data?.detail
      if (status === 409) useCaja.getState().cargar() // ya estaba cerrada en otro lado; reflejar la realidad
      if (typeof detail === 'string') {
        // Primer rechazo por tolerancia (aún sin pedir PIN): pasar a pedirlo. Con el PIN ya pedido, el 403 es
        // «PIN incorrecto» y se muestra en el modal.
        if (status === 403 && detail.startsWith('Diferencia fuera de tolerancia') && !(desdeAutorizacion && requierePin)) {
          setDatos(d); setRequierePin(true); setPaso('diferencia'); return
        }
        if (status === 422 && detail.startsWith('Hay diferencia') && !desdeAutorizacion) {
          setRequierePin(false); setPaso('diferencia'); return
        }
      }
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
        <DiferenciaCaja
          centimos={Math.round(Number(cerrada.diferencia) * 100)}
          derecha={`Esperado ${soles(cerrada.monto_esperado)} · contado ${soles(cerrada.monto_contado)}`}
        />
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
    contenido = <ResumenCaja caja={caja} onCerrar={iniciarCierre} onMovimiento={setMovimiento} />
  }

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
          inicial={datos}
          onContinuar={(d) => { setDatos(d); setPaso('confirmar') }}
          onCancelar={() => setPaso(null)}
        />
      )}
      {paso === 'confirmar' && caja && datos && (
        <ModalConfirm
          titulo={`¿Cerrar la caja de ${caja.usuario_nombre}?`}
          mensaje={mensajeConfirmacion(caja, datos)}
          labelConfirm="Sí, cerrar caja"
          colorConfirm="warning"
          onConfirm={() => enviarCierre(datos, null)}
          onCancel={() => setPaso(p => (p === 'confirmar' ? 'contar' : p))}
        />
      )}
      {paso === 'diferencia' && caja && datos && (
        <AutorizarCierreModal
          requierePin={requierePin}
          observaciones={datos.observaciones}
          onEnviar={(obs, pin) => enviarCierre({ ...datos, observaciones: obs }, pin, true)}
          onVolver={() => setPaso('contar')}
        />
      )}
      {movimiento && caja && (
        <MovimientoModal
          tipo={movimiento}
          cajaId={caja.id}
          onRegistrado={(c) => useCaja.getState().fijar(c)}
          onCerrar={() => setMovimiento(null)}
        />
      )}
    </div>
  )
}
