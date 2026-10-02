import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import cn from './cn'

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo accesible: role="dialog", aria-modal, cierre con Escape / clic fuera,
 * foco atrapado y devuelto al elemento que lo abrió.
 * En móvil se ancla abajo (hoja inferior) para convivir con el teclado virtual.
 */
export default function Modal({ title, description, onClose, children, className, closeOnBackdrop = true }) {
  const panel = useRef(null)
  const titleId = useId()
  const descId = useId()
  // onClose en ref: un callback inline no debe reiniciar el efecto (y robar el foco)
  const cerrar = useRef(onClose)
  useEffect(() => { cerrar.current = onClose })

  useEffect(() => {
    const previo = document.activeElement
    const nodo = panel.current
    const auto = nodo?.querySelector('[autofocus], [data-autofocus]')
    ;(auto ?? nodo?.querySelector(FOCUSABLE) ?? nodo)?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar.current?.(); return }
      if (e.key !== 'Tab' || !nodo) return
      const items = [...nodo.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) return
      const primero = items[0]
      const ultimo = items[items.length - 1]
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/65 animate-fade-in"
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'w-full bg-surface border border-line rounded-t-panel sm:rounded-panel p-5 sm:p-6 shadow-2xl animate-pop-in max-h-[90dvh] overflow-y-auto',
          // Sin cn/twMerge, dos max-w-* en conflicto los resuelve el orden del CSS (ganaba sm): el ancho por defecto solo aplica si no se pasa uno.
          /max-w-/.test(className ?? '') ? '' : 'sm:max-w-sm',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          {title && <h2 id={titleId} className="text-ink font-semibold text-lg leading-snug">{title}</h2>}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 -mt-1 -mr-2 grid place-items-center size-11 rounded-control text-muted hover:text-ink hover:bg-raised transition-colors"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {description && <p id={descId} className="text-muted text-sm mb-4">{description}</p>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
