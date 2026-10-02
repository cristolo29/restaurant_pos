import { useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button, Keypad, Modal, cn } from '../../components/ui'
import ComprobanteMovimiento from '../../components/ComprobanteMovimiento'
import { registrarMovimiento } from '../../api/caja'
import { TIPO_MOVIMIENTO, aCentimos, deCentimos } from '../../utils/dinero'

const MOTIVOS = {
  ingreso: ['Sencillo', 'Cambio del banco', 'Aporte del dueño'],
  egreso: ['Compra de insumos', 'Pago a proveedor', 'Propina al personal'],
  retiro: ['Retiro a caja fuerte', 'Depósito al banco', 'Entrega al administrador'],
}
const MOTIVO_MIN = 3
const MOTIVO_MAX = 200

function mensajeDeError(e) {
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (e?.response?.status === 422) return 'Revisa el monto (más de 0, máximo 2 decimales) y el motivo (3 a 200 caracteres).'
  return e?.response ? 'No se pudo registrar el movimiento.' : 'Sin conexión con el servidor. Reintenta.'
}

/**
 * Registra un ingreso, egreso o retiro de efectivo de la caja abierta.
 * Formulario con teclado numérico grande y motivo obligatorio; al terminar muestra el comprobante interno
 * imprimible. `onRegistrado(caja)` recibe la caja actualizada (el movimiento no se puede editar ni borrar).
 */
export default function MovimientoModal({ tipo, cajaId, onRegistrado, onCerrar }) {
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hecho, setHecho] = useState(null)
  const t = TIPO_MOVIMIENTO[tipo]
  const centimos = aCentimos(monto)
  const montoValido = centimos !== null && centimos > 0
  const invalido = monto !== '' && !montoValido
  const motivoLimpio = motivo.trim()
  const listo = montoValido && motivoLimpio.length >= MOTIVO_MIN

  async function enviar(e) {
    e.preventDefault()
    if (!listo || enviando) return
    setEnviando(true)
    setError('')
    try {
      const caja = await registrarMovimiento({ tipo, monto: Number(deCentimos(centimos)), motivo: motivoLimpio })
      onRegistrado(caja)
      setHecho(caja.movimientos[caja.movimientos.length - 1])
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  if (hecho) {
    return (
      <Modal title={`${t.corto} registrado`} onClose={onCerrar} className="sm:max-w-lg">
        <p role="status" className="bg-success/10 border border-success/30 text-success rounded-control px-4 py-3 flex items-center gap-2 font-semibold mb-4">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" /> Movimiento guardado. No se puede editar ni borrar.
        </p>
        <ComprobanteMovimiento movimiento={hecho} cajaId={cajaId} />
        <Button variant="secondary" block onClick={onCerrar} className="mt-4" data-autofocus>Listo</Button>
      </Modal>
    )
  }

  return (
    <Modal title={t.etiqueta} description="Queda registrado con tu nombre y no se puede editar ni borrar." onClose={enviando ? undefined : onCerrar} className="sm:max-w-md">
      <form onSubmit={enviar} noValidate>
        <label htmlFor="mov-monto" className="block text-soft text-sm font-medium mb-1.5">Monto</label>
        <div className="relative">
          <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-2xl font-semibold">S/</span>
          <input
            id="mov-monto"
            data-autofocus
            value={monto}
            onChange={e => setMonto(e.target.value)}
            inputMode="none"
            autoComplete="off"
            placeholder="0.00"
            disabled={enviando}
            aria-invalid={invalido || undefined}
            aria-describedby={invalido ? 'mov-monto-error' : undefined}
            className={cn(
              'w-full min-h-16 bg-sunken border rounded-control pl-14 pr-4 text-ink text-3xl font-bold num placeholder:text-faint focus:outline-none focus:border-accent transition-colors disabled:opacity-50',
              invalido ? 'border-danger' : 'border-line-strong',
            )}
          />
        </div>
        {invalido && <p id="mov-monto-error" role="alert" className="text-danger text-caption mt-1">Escribe un monto mayor a 0, con máximo 2 decimales.</p>}
        <Keypad value={monto} onChange={setMonto} disabled={enviando} className="mt-3" />

        <label htmlFor="mov-motivo" className="block text-soft text-sm font-medium mt-4 mb-1.5">Motivo (obligatorio)</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {MOTIVOS[tipo].map(m => (
            <button key={m} type="button" disabled={enviando} onClick={() => setMotivo(m)}
              className="min-h-12 px-3 rounded-control bg-raised text-soft text-sm hover:text-ink active:scale-[0.98] transition-colors disabled:opacity-50">
              {m}
            </button>
          ))}
        </div>
        <textarea
          id="mov-motivo"
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          maxLength={MOTIVO_MAX}
          rows={2}
          disabled={enviando}
          placeholder="Ej: compra de hielo"
          className="w-full bg-raised border border-line-strong rounded-control px-4 py-3 text-base text-ink placeholder:text-faint resize-none focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
        />
        <p className="text-faint text-caption mt-1">{motivoLimpio.length}/{MOTIVO_MAX} (mínimo {MOTIVO_MIN})</p>

        {error && (
          <p role="alert" className="mt-3 bg-danger/10 border border-danger/30 text-danger rounded-control px-4 py-2.5 flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" aria-hidden="true" /> {error}
          </p>
        )}
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" block onClick={onCerrar} disabled={enviando}>Cancelar</Button>
          <Button type="submit" variant="primary" block loading={enviando} disabled={!listo}>
            {enviando ? 'Guardando...' : `Registrar ${t.corto.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
