import { useId } from 'react'
import cn from './cn'

const BASE = 'w-full min-h-12 bg-raised border rounded-control px-4 text-base text-ink placeholder:text-faint focus:outline-none focus:border-accent transition-colors disabled:opacity-50'

/** Envuelve un control con label real, ayuda y mensaje de error asociado (aria-describedby). */
function Campo({ id, label, error, hint, className, children }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="block text-soft text-sm font-medium mb-1.5">{label}</label>}
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-faint text-caption mt-1">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-danger text-caption mt-1">{error}</p>}
    </div>
  )
}

function ariaCampo(id, error, hint) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  }
}

export function Input({ label, error, hint, className, inputClassName, id, ...props }) {
  const auto = useId()
  const idCampo = id ?? auto
  return (
    <Campo id={idCampo} label={label} error={error} hint={hint} className={className}>
      <input
        id={idCampo}
        {...ariaCampo(idCampo, error, hint)}
        className={cn(BASE, error ? 'border-danger' : 'border-line-strong', inputClassName)}
        {...props}
      />
    </Campo>
  )
}

export function Select({ label, error, hint, options, className, id, ...props }) {
  const auto = useId()
  const idCampo = id ?? auto
  return (
    <Campo id={idCampo} label={label} error={error} hint={hint} className={className}>
      <select
        id={idCampo}
        {...ariaCampo(idCampo, error, hint)}
        className={cn(BASE, error ? 'border-danger' : 'border-line-strong')}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Campo>
  )
}
