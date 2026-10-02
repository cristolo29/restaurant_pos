/**
 * Modal de confirmación reutilizable.
 * Reemplaza el confirm() nativo del browser.
 *
 * Uso:
 *   const [modal, setModal] = useState(null)
 *
 *   // Abrir:
 *   setModal({ mensaje: '¿Eliminar?', onConfirm: () => handleEliminar() })
 *
 *   // En el JSX:
 *   {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
 *
 * Con `pedirMotivo` muestra un textarea obligatorio (3-200 caracteres) y llama
 * onConfirm(motivo). Si onConfirm lanza, el modal sigue abierto y muestra el error
 * del servidor (403/409/422) en español.
 */
import { useState } from 'react'

const MOTIVO_MIN = 3
const MOTIVO_MAX = 200

function mensajeDeError(e) {
  const status = e?.response?.status
  const detail = e?.response?.data?.detail
  if (status === 422) return `El motivo debe tener entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`
  if (typeof detail === 'string') return detail
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}

export default function ModalConfirm({
  titulo = '¿Confirmar acción?',
  mensaje,
  labelConfirm = 'Confirmar',
  colorConfirm = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
  pedirMotivo = false,
}) {
  const [motivo, setMotivo]       = useState('')
  const [error, setError]         = useState('')
  const [enviando, setEnviando]   = useState(false)
  const motivoLimpio = motivo.trim()
  const motivoValido = !pedirMotivo || motivoLimpio.length >= MOTIVO_MIN

  const confirmar = async () => {
    if (!pedirMotivo) { onConfirm(); onCancel(); return }
    setEnviando(true)
    setError('')
    try {
      await onConfirm(motivoLimpio)
      onCancel()
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const colores = {
    danger:  'bg-[#ef4444] hover:bg-[#dc2626] text-white',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] text-black',
    primary: 'bg-[#3b82f6] hover:bg-[#2563eb] text-white',
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-lg mb-2">{titulo}</h3>
        {mensaje && <p className={`text-[#a1a1aa] text-sm ${pedirMotivo ? 'mb-3' : 'mb-6'}`}>{mensaje}</p>}

        {pedirMotivo && (
          <div className="mb-5">
            <label htmlFor="motivo-modal" className="block text-[#a1a1aa] text-xs mb-1">
              Motivo (obligatorio)
            </label>
            <textarea
              id="motivo-modal"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              maxLength={MOTIVO_MAX}
              rows={3}
              autoFocus
              placeholder="Ej: el cliente se retiró"
              className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl p-3 text-white text-sm placeholder-[#71717a] resize-none focus:outline-none focus:border-[#f59e0b] transition-colors"
            />
            {error && <p role="alert" className="text-[#ef4444] text-xs mt-2">{error}</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-[#3f3f46] text-[#a1a1aa] py-2.5 rounded-xl text-sm font-medium hover:bg-[#52525b] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={!motivoValido || enviando}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${colores[colorConfirm] || colores.danger}`}
          >
            {labelConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
