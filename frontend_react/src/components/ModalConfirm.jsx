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
 */
export default function ModalConfirm({
  titulo = '¿Confirmar acción?',
  mensaje,
  labelConfirm = 'Confirmar',
  colorConfirm = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
}) {
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
        {mensaje && <p className="text-[#a1a1aa] text-sm mb-6">{mensaje}</p>}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-[#3f3f46] text-[#a1a1aa] py-2.5 rounded-xl text-sm font-medium hover:bg-[#52525b] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onCancel() }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${colores[colorConfirm] || colores.danger}`}
          >
            {labelConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
