import { useState } from 'react'
import { Button, Chip, Modal } from '../../components/ui'
import { NOTAS_RAPIDAS } from './estados'

/** Nota para cocina de un producto: atajos de un toque + texto libre. */
export default function ModalNota({ producto, onAgregar, onCancelar }) {
  const [nota, setNota] = useState('')

  const alternarRapida = (texto) => {
    const partes = nota.split(',').map(p => p.trim()).filter(Boolean)
    setNota(partes.includes(texto) ? partes.filter(p => p !== texto).join(', ') : [...partes, texto].join(', '))
  }
  const activas = nota.split(',').map(p => p.trim())

  return (
    <Modal title={producto.nombre} description="Nota para cocina (opcional)" onClose={onCancelar}>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Notas rápidas">
        {NOTAS_RAPIDAS.map(n => (
          <Chip key={n} activo={activas.includes(n)} onClick={() => alternarRapida(n)}>{n}</Chip>
        ))}
      </div>
      <label htmlFor="nota-cocina" className="sr-only">Nota para cocina</label>
      <textarea
        id="nota-cocina"
        value={nota}
        onChange={e => setNota(e.target.value)}
        placeholder="Otra indicación para cocina…"
        rows={2}
        maxLength={200}
        data-autofocus
        className="w-full bg-raised border border-line-strong rounded-control p-3 text-ink text-base placeholder:text-faint resize-none focus:outline-none focus:border-accent"
      />
      <div className="flex gap-3 mt-4">
        <Button variant="secondary" block onClick={onCancelar}>Cancelar</Button>
        <Button variant="primary" block onClick={() => onAgregar(producto, nota.trim())}>Agregar</Button>
      </div>
    </Modal>
  )
}
