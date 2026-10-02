import cn from './cn'

/** Estado vacío / error con icono, mensaje y acción opcional. */
export default function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className }) {
  return (
    <div role="status" className={cn('flex flex-col items-center justify-center text-center gap-2 py-16 px-4', className)}>
      {Icon && (
        <div className={cn('grid place-items-center size-14 rounded-full mb-1', tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-raised text-muted')}>
          <Icon className="size-7" aria-hidden="true" />
        </div>
      )}
      <p className="text-ink font-semibold">{title}</p>
      {description && <p className="text-muted text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
