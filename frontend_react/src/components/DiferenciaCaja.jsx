import { CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from './ui'
import { describirDiferencia } from '../utils/dinero'

const TONO = {
  cuadra: { cls: 'bg-success/10 border-success/40 text-success', Icono: CheckCircle2 },
  falta:  { cls: 'bg-danger/10 border-danger/40 text-danger', Icono: TrendingDown },
  sobra:  { cls: 'bg-warning/10 border-warning/40 text-warning', Icono: TrendingUp },
}

/** Diferencia contado − esperado en céntimos: color + icono + texto («Faltan S/ X.XX» / «Sobran S/ X.XX»). */
export default function DiferenciaCaja({ centimos, derecha, className }) {
  const dif = describirDiferencia(centimos)
  const { cls, Icono } = TONO[dif.tipo]
  return (
    <div role="status" className={cn('border rounded-control px-4 py-3 flex items-center justify-between gap-3 font-semibold', cls, className)}>
      <span className="flex items-center gap-2 text-lg"><Icono className="size-6 shrink-0" aria-hidden="true" /> {dif.texto}</span>
      {derecha && <span className="num text-sm font-medium">{derecha}</span>}
    </div>
  )
}
