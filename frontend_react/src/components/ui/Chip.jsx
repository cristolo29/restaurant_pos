import cn from './cn'

/** Pastilla seleccionable (categorías, filtros). Alto táctil de 44 px. */
export default function Chip({ activo = false, count, className, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={cn(
        'inline-flex items-center gap-2 min-h-11 px-4 rounded-full text-sm whitespace-nowrap font-medium transition-colors',
        activo ? 'bg-accent text-on-accent' : 'bg-raised text-muted hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
      {count != null && (
        <span className={cn('num text-xs font-bold rounded-full px-1.5 min-w-5 text-center', activo ? 'bg-black/15' : 'bg-black/25')}>
          {count}
        </span>
      )}
    </button>
  )
}
