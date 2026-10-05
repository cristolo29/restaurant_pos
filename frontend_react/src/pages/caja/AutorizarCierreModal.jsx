import { useState } from 'react'
import { AlertCircle, ShieldCheck } from 'lucide-react'
import { Button, Keypad, Modal } from '../../components/ui'

const PIN_MAX = 6
const PIN_MIN = 4

function mensajeDeError(e) {
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string') return detail
  return e?.response ? 'No se pudo cerrar la caja. Revisa los datos.' : 'Sin conexión con el servidor. Reintenta.'
}

/**
 * Paso extra del cierre cuando el servidor rechazó la diferencia:
 * - `requierePin`: la diferencia supera la tolerancia → pide el PIN de un administrador (teclado grande, enmascarado).
 * - si no, solo pide explicar la diferencia (observaciones).
 * `onEnviar(observaciones, pin)` devuelve una promesa; si falla, el error se muestra aquí y el modal sigue abierto.
 */
export default function AutorizarCierreModal({ requierePin, observaciones: obsInicial, onEnviar, onVolver }) {
  const [observaciones, setObservaciones] = useState(obsInicial)
  const [pin, setPin] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const listo = observaciones.trim().length >= 3 && (!requierePin || pin.length >= PIN_MIN)

  async function enviar() {
    if (!listo || enviando) return
    setEnviando(true)
    setError('')
    try {
      await onEnviar(observaciones.trim(), requierePin ? pin : null)
    } catch (e) {
      setError(mensajeDeError(e))
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      title={requierePin ? 'Autorización de administrador' : 'Explica la diferencia'}
      description={requierePin
        ? 'La diferencia de tu conteo está fuera de la tolerancia permitida. Un administrador debe autorizar el cierre con su PIN.'
        : 'Hay diferencia entre lo contado y lo esperado. Explica el motivo para poder cerrar.'}
      onClose={enviando ? undefined : onVolver}
      closeOnBackdrop={false}
      className="sm:max-w-md"
    >
      <label htmlFor="observaciones-autorizacion" className="block text-soft text-sm font-medium mb-1.5">Observaciones (obligatorio)</label>
      <textarea
        id="observaciones-autorizacion"
        data-autofocus={!requierePin || undefined}
        value={observaciones}
        onChange={e => setObservaciones(e.target.value)}
        maxLength={500}
        rows={2}
        disabled={enviando}
        placeholder="Ej: faltó cambio de un billete de 100"
        className="w-full bg-raised border border-line-strong rounded-control px-4 py-3 text-base text-ink placeholder:text-faint resize-none focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
      />
      {requierePin && (
        <>
          <p className="text-faint text-caption mt-1">Si eres el único administrador y te autorizas a ti mismo, escribe al menos 10 caracteres.</p>
          <label htmlFor="pin-autorizacion" className="block text-soft text-sm font-medium mt-4 mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-accent" aria-hidden="true" /> PIN del administrador
          </label>
          <input
            id="pin-autorizacion"
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
            inputMode="none"
            autoComplete="off"
            maxLength={PIN_MAX}
            disabled={enviando}
            aria-describedby={error ? 'autorizacion-error' : undefined}
            className="w-full min-h-14 bg-sunken border border-line-strong rounded-control px-4 text-ink text-3xl text-center tracking-[0.5em] font-bold focus:outline-none focus:border-accent disabled:opacity-50"
          />
          <Keypad value={pin} onChange={setPin} decimal={false} maxLength={PIN_MAX} disabled={enviando} label="Teclado del PIN" className="mt-3" />
        </>
      )}
      {error && (
        <p id="autorizacion-error" role="alert" className="mt-4 bg-danger/10 border border-danger/30 text-danger rounded-control px-4 py-2.5 flex items-center gap-2 text-sm">
          <AlertCircle className="size-5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}
      <div className="flex gap-3 mt-5">
        <Button variant="secondary" block onClick={onVolver} disabled={enviando}>Volver a contar</Button>
        <Button variant="primary" block loading={enviando} disabled={!listo} onClick={enviar}>
          {requierePin ? 'Autorizar y cerrar' : 'Cerrar caja'}
        </Button>
      </div>
    </Modal>
  )
}
