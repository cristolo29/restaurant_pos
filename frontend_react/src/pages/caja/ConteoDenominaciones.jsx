import { Minus, Plus } from 'lucide-react'
import { cn } from '../../components/ui'
import { soles } from '../admin/util'
import { DENOMINACIONES, deCentimos, totalConteo } from '../../utils/dinero'

const MAX_CANTIDAD = 9999

/**
 * Conteo de billetes y monedas con +/− por denominación (objetivos de 48 px) y total acumulado siempre visible.
 * Controlado: `conteo` es { "200": 2, "0.50": 3 } y `onChange` recibe el objeto nuevo.
 */
export default function ConteoDenominaciones({ conteo, onChange, disabled = false }) {
  const total = totalConteo(conteo)
  const poner = (clave, n) => onChange({ ...conteo, [clave]: Math.max(0, Math.min(MAX_CANTIDAD, n)) })

  return (
    <div>
      <ul className="divide-y divide-line border border-line rounded-control overflow-hidden">
        {DENOMINACIONES.map(d => {
          const n = conteo[d.clave] || 0
          return (
            <li key={d.clave} className={cn('flex items-center gap-2 px-3 py-1.5', n > 0 && 'bg-accent/5')}>
              <div className="w-24 shrink-0">
                <p className="text-ink font-semibold num">S/ {d.clave}</p>
                <p className="text-faint text-caption">{d.tipo === 'billete' ? 'Billete' : 'Moneda'}</p>
              </div>
              <button type="button" disabled={disabled || n === 0} onClick={() => poner(d.clave, n - 1)}
                aria-label={`Quitar uno de ${d.tipo === 'billete' ? 'billete' : 'moneda'} de S/ ${d.clave}`}
                className="grid place-items-center size-12 shrink-0 rounded-control bg-raised text-soft hover:bg-raised-hover active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-colors">
                <Minus className="size-5" aria-hidden="true" />
              </button>
              <input
                value={n === 0 ? '' : String(n)}
                onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 4); poner(d.clave, t === '' ? 0 : Number(t)) }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                disabled={disabled}
                aria-label={`Cantidad de S/ ${d.clave}`}
                className="w-16 min-h-12 shrink-0 bg-sunken border border-line-strong rounded-control text-center text-ink text-xl font-bold num placeholder:text-faint focus:outline-none focus:border-accent"
              />
              <button type="button" disabled={disabled || n >= MAX_CANTIDAD} onClick={() => poner(d.clave, n + 1)}
                aria-label={`Agregar uno de ${d.tipo === 'billete' ? 'billete' : 'moneda'} de S/ ${d.clave}`}
                className="grid place-items-center size-12 shrink-0 rounded-control bg-accent text-on-accent hover:bg-accent-hover active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-colors">
                <Plus className="size-5" aria-hidden="true" />
              </button>
              <p className={cn('ml-auto text-right num text-sm min-w-16', n > 0 ? 'text-ink font-semibold' : 'text-faint')}>
                {n > 0 ? soles(deCentimos(n * d.centimos)) : '—'}
              </p>
            </li>
          )
        })}
      </ul>
      <div role="status" aria-live="polite" className="mt-3 flex items-baseline justify-between bg-sunken rounded-control px-4 py-3">
        <span className="text-soft font-medium">Total contado</span>
        <span className="text-ink text-3xl font-bold num">{soles(deCentimos(total))}</span>
      </div>
    </div>
  )
}
