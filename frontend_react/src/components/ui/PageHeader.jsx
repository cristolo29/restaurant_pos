import cn from './cn'

/** Cabecera de página: un único h1, subtítulo y acciones a la derecha. */
export default function PageHeader({ title, subtitle, children, className }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 flex-wrap mb-5', className)}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
