import cn from './cn'

const TONOS = {
  neutral: 'bg-raised text-soft',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger:  'bg-danger/15 text-danger',
  info:    'bg-info/15 text-blue-300',
}

/** Etiqueta de estado: siempre texto + (opcional) icono, nunca solo color. */
export default function StatusBadge({ tone = 'neutral', icon: Icon, className, children }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-medium', TONOS[tone], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  )
}
