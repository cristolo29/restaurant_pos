import { Delete } from 'lucide-react'
import cn from './cn'
import { aplicarTecla } from '../../utils/teclado'

const TECLA = 'min-h-14 min-w-14 rounded-control bg-raised text-ink text-2xl font-semibold num transition-colors hover:bg-raised-hover active:scale-[0.97] active:bg-raised-hover disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'

/**
 * Teclado numérico táctil reutilizable (objetivos de 56 px). Controlado: `value` es el texto y
 * `onChange(nuevoTexto)` lo actualiza. `decimal={false}` lo convierte en teclado de PIN/cantidades enteras.
 * Las teclas no le quitan el foco al campo que se está editando (onMouseDown/onPointerDown).
 */
export default function Keypad({ value, onChange, decimal = true, decimales = 2, maxLength = 10, disabled = false, className, label = 'Teclado numérico' }) {
  const opciones = { decimal, decimales, maxLength }
  const pulsar = (t) => onChange(aplicarTecla(value, t, opciones))
  const sinFoco = (e) => e.preventDefault()

  const tecla = (t, texto, extra = {}) => (
    <button
      key={t}
      type="button"
      className={cn(TECLA, extra.className)}
      disabled={disabled || extra.disabled}
      aria-label={extra.label}
      onMouseDown={sinFoco}
      onClick={() => pulsar(t)}
    >
      {texto}
    </button>
  )

  return (
    <div role="group" aria-label={label} className={cn('grid grid-cols-3 gap-2', className)}>
      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(n => tecla(n, n))}
      {decimal
        ? tecla('.', '.', { label: 'Punto decimal' })
        : tecla('limpiar', 'C', { label: 'Limpiar', className: 'text-lg text-muted' })}
      {tecla('0', '0')}
      <button
        type="button"
        className={cn(TECLA, 'grid place-items-center text-muted')}
        disabled={disabled}
        aria-label="Borrar el último dígito"
        onMouseDown={sinFoco}
        onClick={() => pulsar('borrar')}
        onDoubleClick={() => pulsar('limpiar')}
      >
        <Delete className="size-6" aria-hidden="true" />
      </button>
    </div>
  )
}
