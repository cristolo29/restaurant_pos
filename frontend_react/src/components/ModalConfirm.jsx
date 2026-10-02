import { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'

const VARIANTE = { danger: 'danger', warning: 'primary', primary: 'info' }
const MOTIVO_MIN = 3
const MOTIVO_MAX = 200

function mensajeDeError(e, pedirMotivo) {
  const status = e?.response?.status
  const detail = e?.response?.data?.detail
  if (status === 422 && pedirMotivo) return `El motivo debe tener entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`
  if (typeof detail === 'string') return detail
  return 'No se pudo completar la acción. Intenta de nuevo.'
}

/**
 * Modal de confirmación reutilizable (reemplaza confirm() nativo).
 *
 * Uso:
 *   const [modal, setModal] = useState(null)
 *   setModal({ titulo: '¿Eliminar?', mensaje: '...', onConfirm: () => eliminar() })
 *   {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
 *
 * Si `onConfirm` devuelve una promesa, el botón muestra progreso y el modal solo
 * se cierra al terminar bien; si falla, el error se muestra dentro del modal.
 * Con `soloAviso` se oculta "Cancelar" (mensajes informativos).
 * Con `pedirMotivo` muestra un textarea obligatorio (3-200 caracteres) y llama
 * onConfirm(motivo); el error del servidor (403/409/422) se muestra en español
 * sin cerrar el modal.
 */
export default function ModalConfirm({
  titulo = '¿Confirmar acción?',
  mensaje,
  labelConfirm = 'Confirmar',
  colorConfirm = 'danger', // 'danger' | 'warning' | 'primary'
  soloAviso = false,
  onConfirm,
  onCancel,
  pedirMotivo = false,
}) {
  const [motivo, setMotivo] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const motivoLimpio = motivo.trim()
  const motivoValido = !pedirMotivo || motivoLimpio.length >= MOTIVO_MIN

  async function confirmar() {
    setError('')
    setTrabajando(true)
    try {
      await (pedirMotivo ? onConfirm?.(motivoLimpio) : onConfirm?.())
      onCancel()
    } catch (e) {
      setError(mensajeDeError(e, pedirMotivo))
      setTrabajando(false)
    }
  }

  return (
    <Modal title={titulo} description={mensaje} onClose={trabajando ? undefined : onCancel}>
      {pedirMotivo && (
        <div className="mb-4">
          <label htmlFor="motivo-modal" className="block text-soft text-sm font-medium mb-1.5">
            Motivo (obligatorio)
          </label>
          <textarea
            id="motivo-modal"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            maxLength={MOTIVO_MAX}
            rows={3}
            data-autofocus
            disabled={trabajando}
            placeholder="Ej: el cliente se retiró"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'motivo-modal-error' : undefined}
            className="w-full bg-raised border border-line-strong rounded-control px-4 py-3 text-base text-ink placeholder:text-faint resize-none focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
          />
          <p className="text-faint text-caption mt-1">{motivoLimpio.length}/{MOTIVO_MAX} (mínimo {MOTIVO_MIN})</p>
        </div>
      )}
      {error && (
        <p id="motivo-modal-error" role="alert" className="text-danger text-sm bg-danger/10 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}
      <div className="flex gap-3 mt-2">
        {!soloAviso && (
          <Button variant="secondary" block onClick={onCancel} disabled={trabajando}>
            Cancelar
          </Button>
        )}
        <Button
          variant={VARIANTE[colorConfirm] ?? 'danger'}
          block
          loading={trabajando}
          disabled={!motivoValido}
          onClick={confirmar}
          data-autofocus={soloAviso || undefined}
        >
          {labelConfirm}
        </Button>
      </div>
    </Modal>
  )
}
