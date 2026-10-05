import { useState } from 'react'
import { LockOpen, AlertCircle } from 'lucide-react'
import { Button, Card, cn } from '../../components/ui'
import { abrirCaja } from '../../api/caja'
import { aCentimos, deCentimos } from '../../utils/dinero'

const RAPIDOS = [0, 50, 100, 200, 300]

/** Sin caja abierta: pide el fondo inicial con una entrada grande y montos rápidos. */
export default function AbrirCaja({ onAbierta }) {
  const [monto, setMonto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const centimos = aCentimos(monto)
  const invalido = monto !== '' && centimos === null

  async function enviar(e) {
    e.preventDefault()
    if (centimos === null || enviando) return
    setEnviando(true)
    setError('')
    try {
      onAbierta(await abrirCaja(Number(deCentimos(centimos))))
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : err.response ? 'No se pudo abrir la caja. Revisa el monto.' : 'Sin conexión con el servidor. Reintenta.')
      setEnviando(false)
    }
  }

  return (
    <Card className="p-5 sm:p-6 max-w-xl">
      <form onSubmit={enviar} noValidate>
        <h2 className="text-ink font-semibold text-lg flex items-center gap-2">
          <LockOpen className="size-5 text-accent" aria-hidden="true" /> Abrir caja
        </h2>
        <p className="text-muted text-sm mt-1 mb-5">
          Cuenta el efectivo con el que empiezas el turno. Hasta abrir la caja no se puede cobrar.
        </p>

        <label htmlFor="monto-inicial" className="block text-soft text-sm font-medium mb-1.5">Monto inicial (efectivo en caja)</label>
        <div className="relative">
          <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-2xl font-semibold">S/</span>
          <input
            id="monto-inicial"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-invalid={invalido || undefined}
            aria-describedby={invalido ? 'monto-inicial-error' : undefined}
            className={cn(
              'w-full min-h-16 bg-sunken border rounded-control pl-14 pr-4 text-ink text-3xl font-bold num placeholder:text-faint focus:outline-none focus:border-accent transition-colors',
              invalido ? 'border-danger' : 'border-line-strong',
            )}
          />
        </div>
        {invalido && (
          <p id="monto-inicial-error" role="alert" className="text-danger text-caption mt-1">
            Escribe un monto válido, con máximo 2 decimales (ej. 150.00).
          </p>
        )}

        <div className="flex gap-2 flex-wrap mt-3">
          {RAPIDOS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMonto(String(m))}
              aria-pressed={monto === String(m)}
              className={cn(
                'min-h-12 min-w-20 px-4 rounded-control border-2 font-semibold num transition-colors active:scale-[0.98]',
                monto === String(m) ? 'bg-accent/10 border-accent text-accent' : 'bg-raised border-transparent text-soft hover:text-ink',
              )}
            >
              S/ {m}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-4 bg-danger/10 border border-danger/30 text-danger rounded-control px-4 py-2.5 flex items-center gap-2 text-sm">
            <AlertCircle className="size-5 shrink-0" aria-hidden="true" /> {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" block loading={enviando} disabled={centimos === null} className="mt-5 text-lg">
          {enviando ? 'Abriendo...' : 'Abrir caja'}
        </Button>
      </form>
    </Card>
  )
}
