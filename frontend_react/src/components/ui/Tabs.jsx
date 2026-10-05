import cn from './cn'

/**
 * Pestañas accesibles (role="tablist"). El contenedor del panel debe usar
 * role="tabpanel", id={`${idBase}-panel`} y aria-labelledby={`${idBase}-tab-${value}`}.
 * Flechas izquierda/derecha, Inicio y Fin mueven la selección.
 */
export default function Tabs({ tabs, value, onChange, idBase = 'tabs', label, className }) {
  const onKeyDown = (e) => {
    const i = tabs.findIndex(t => t.id === value)
    let n = -1
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = tabs.length - 1
    if (n < 0) return
    e.preventDefault()
    onChange(tabs[n].id)
    document.getElementById(`${idBase}-tab-${tabs[n].id}`)?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown}
      className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {tabs.map(({ id, label: texto, icon: Icon }) => {
        const activo = id === value
        return (
          <button
            key={id}
            id={`${idBase}-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activo}
            aria-controls={`${idBase}-panel`}
            tabIndex={activo ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              'inline-flex items-center gap-2 min-h-12 px-4 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              activo ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
            {texto}
          </button>
        )
      })}
    </div>
  )
}
