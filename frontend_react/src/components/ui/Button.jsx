import { Loader2 } from 'lucide-react'
import cn from './cn'

const VARIANTES = {
  primary:   'bg-accent text-on-accent hover:bg-accent-hover font-semibold',
  secondary: 'bg-raised text-soft hover:bg-raised-hover hover:text-ink font-medium',
  danger:    'bg-danger text-white hover:bg-danger-hover font-semibold',
  info:      'bg-info text-white hover:bg-info-hover font-semibold',
  success:   'bg-success text-on-accent hover:brightness-110 font-semibold',
  outlineDanger: 'border border-danger/50 text-danger hover:bg-danger/10 font-medium',
  ghost:     'text-muted hover:text-ink hover:bg-raised font-medium',
}

const TAMANOS = {
  sm: 'min-h-10 px-3 text-sm gap-1.5',
  md: 'min-h-12 px-4 text-sm gap-2',
  lg: 'min-h-14 px-5 text-base gap-2',
}

const TAMANOS_ICONO = { sm: 'size-10', md: 'size-12', lg: 'size-14' }

/**
 * Botón táctil estándar del POS.
 * - `loading` deshabilita y muestra spinner (evita dobles envíos).
 * - `iconOnly` exige `aria-label`.
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconOnly = false,
  loading = false,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-control transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTES[variant],
        iconOnly ? TAMANOS_ICONO[size] : TAMANOS[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : Icon && <Icon className="size-[1.15em] shrink-0" aria-hidden="true" />}
      {!iconOnly && children}
    </button>
  )
}
