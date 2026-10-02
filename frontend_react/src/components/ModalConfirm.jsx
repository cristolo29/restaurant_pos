import { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'

const VARIANTE = { danger: 'danger', warning: 'primary', primary: 'info' }

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
 */
export default function ModalConfirm({
  titulo = '¿Confirmar acción?',
  mensaje,
  labelConfirm = 'Confirmar',
  colorConfirm = 'danger', // 'danger' | 'warning' | 'primary'
  soloAviso = false,
  onConfirm,
  onCancel,
}) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    setError('')
    setTrabajando(true)
    try {
      await onConfirm?.()
      onCancel()
    } catch (e) {
      const detalle = e?.response?.data?.detail
      setError(typeof detalle === 'string' ? detalle : 'No se pudo completar la acción. Intenta de nuevo.')
      setTrabajando(false)
    }
  }

  return (
    <Modal title={titulo} description={mensaje} onClose={trabajando ? undefined : onCancel}>
      {error && (
        <p role="alert" className="text-danger text-sm bg-danger/10 rounded-control px-3 py-2 mb-4">
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
          onClick={confirmar}
          data-autofocus={soloAviso || undefined}
        >
          {labelConfirm}
        </Button>
      </div>
    </Modal>
  )
}
