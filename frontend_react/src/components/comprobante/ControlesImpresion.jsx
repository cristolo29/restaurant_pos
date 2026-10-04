import { Printer } from 'lucide-react'
import { Button, cn } from '../ui'
import { FORMATOS } from '../../utils/comprobante'

/** Selector de formato (A4 / Ticket 80 mm) y botón «Imprimir». Objetivos de 48 px o más. */
export default function ControlesImpresion({ formato, onFormato, onImprimir, className }) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-end gap-3', className)}>
      <div role="group" aria-label="Formato de impresión" className="flex-1">
        <p className="text-sm text-muted mb-1.5">Formato de impresión</p>
        <div className="grid grid-cols-2 gap-2">
          {FORMATOS.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={formato === f.id}
              onClick={() => onFormato(f.id)}
              className={cn(
                'min-h-12 rounded-control border-2 px-3 text-base font-semibold transition-colors active:scale-[0.98]',
                formato === f.id ? 'bg-accent/10 border-accent text-accent' : 'bg-raised border-transparent text-soft hover:text-ink',
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>
      <Button variant="primary" size="lg" icon={Printer} onClick={onImprimir} className="sm:min-w-40">Imprimir</Button>
    </div>
  )
}
