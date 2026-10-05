import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import useToast from '../../store/useToast'
import cn from './cn'

const ESTILO = {
  success: { cls: 'border-success/40', icon: CheckCircle2, color: 'text-success' },
  danger:  { cls: 'border-danger/50',  icon: AlertTriangle, color: 'text-danger' },
  info:    { cls: 'border-line-strong', icon: Info, color: 'text-info' },
}

/** Contenedor de toasts: montar una sola vez en el layout. */
export default function Toaster() {
  const toasts = useToast(s => s.toasts)
  const cerrar = useToast(s => s.cerrar)
  return (
    <div
      aria-live="polite"
      className="fixed z-[60] bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:right-6 md:w-96 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => {
        const { cls, icon: Icon, color } = ESTILO[t.tipo] ?? ESTILO.info
        return (
          <div
            key={t.id}
            role={t.tipo === 'danger' ? 'alert' : 'status'}
            className={cn('pointer-events-auto flex items-start gap-3 bg-surface border rounded-control px-4 py-3 shadow-xl animate-pop-in', cls)}
          >
            <Icon className={cn('size-5 shrink-0 mt-0.5', color)} aria-hidden="true" />
            <p className="flex-1 text-sm text-ink">{t.mensaje}</p>
            <button onClick={() => cerrar(t.id)} aria-label="Cerrar aviso" className="text-muted hover:text-ink -mr-1 -mt-1 size-8 grid place-items-center">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
