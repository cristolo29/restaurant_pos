import { Button, Modal } from '../../components/ui'

/** Diálogo de alta/edición. El error general del servidor se muestra dentro del formulario. */
export default function FormModal({ titulo, onCerrar, onGuardar, guardando, errorGeneral, children }) {
  return (
    <Modal title={titulo} onClose={onCerrar} className="sm:max-w-md">
      <form noValidate onSubmit={(e) => { e.preventDefault(); onGuardar() }} className="mt-3">
        <div className="flex flex-col gap-4">{children}</div>
        {errorGeneral && (
          <p role="alert" className="text-danger text-sm bg-danger/10 rounded-control px-3 py-2 mt-4">{errorGeneral}</p>
        )}
        <div className="flex gap-3 mt-6">
          <Button block onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button block type="submit" variant="primary" loading={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
