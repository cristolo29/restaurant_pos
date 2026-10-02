import { CheckCircle2, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import { Button, Modal, cn } from '../../components/ui'
import { soles } from '../admin/util'
import { OBS_MIN, deCentimos, estadoArqueo } from '../../utils/dinero'

const TONO = {
  cuadra: { cls: 'bg-success/10 border-success/40 text-success', Icono: CheckCircle2 },
  falta:  { cls: 'bg-danger/10 border-danger/40 text-danger', Icono: TrendingDown },
  sobra:  { cls: 'bg-warning/10 border-warning/40 text-warning', Icono: TrendingUp },
}

/** Paso 1 del cierre: contar el efectivo y ver la diferencia en vivo. */
export default function CerrarCajaModal({ caja, contado, setContado, observaciones, setObservaciones, onContinuar, onCancelar }) {
  const { dif, obs, listo, contadoC } = estadoArqueo(caja, contado, observaciones)
  const invalido = contado !== '' && contadoC === null
  const t = dif && TONO[dif.tipo]

  return (
    <Modal title="Cerrar caja · arqueo" description="Cuenta el efectivo que hay en la gaveta y escríbelo abajo." onClose={onCancelar} className="sm:max-w-md">
      <div className="flex justify-between items-baseline bg-sunken rounded-control px-4 py-3 mb-4">
        <span className="text-muted text-sm">Efectivo esperado</span>
        <span className="text-ink text-2xl font-bold num">{soles(caja.monto_esperado)}</span>
      </div>

      <label htmlFor="monto-contado" className="block text-soft text-sm font-medium mb-1.5">Efectivo contado</label>
      <div className="relative">
        <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-2xl font-semibold">S/</span>
        <input
          id="monto-contado"
          data-autofocus
          value={contado}
          onChange={e => setContado(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          aria-invalid={invalido || undefined}
          className={cn(
            'w-full min-h-16 bg-sunken border rounded-control pl-14 pr-4 text-ink text-3xl font-bold num placeholder:text-faint focus:outline-none focus:border-accent transition-colors',
            invalido ? 'border-danger' : 'border-line-strong',
          )}
        />
      </div>
      {invalido && <p role="alert" className="text-danger text-caption mt-1">Escribe un monto válido, con máximo 2 decimales.</p>}

      {t && (
        <div role="status" className={cn('mt-3 border rounded-control px-4 py-3 flex items-center justify-between gap-3 font-semibold', t.cls)}>
          <span className="flex items-center gap-2"><t.Icono className="size-5" aria-hidden="true" /> {dif.texto}</span>
          <span className="num text-sm">{soles(deCentimos(contadoC))} contados</span>
        </div>
      )}

      <label htmlFor="observaciones-caja" className="block text-soft text-sm font-medium mt-4 mb-1.5">
        Observaciones {dif && dif.tipo !== 'cuadra' ? '(obligatorio: hay diferencia)' : '(opcional)'}
      </label>
      <textarea
        id="observaciones-caja"
        value={observaciones}
        onChange={e => setObservaciones(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="Ej: faltó cambio de un billete de 100"
        className="w-full bg-raised border border-line-strong rounded-control px-4 py-3 text-base text-ink placeholder:text-faint resize-none focus:outline-none focus:border-accent transition-colors"
      />
      {dif && dif.tipo !== 'cuadra' && obs.length < OBS_MIN && (
        <p className="text-warning text-caption mt-1 flex items-center gap-1">
          <AlertCircle className="size-3.5" aria-hidden="true" /> Explica la diferencia (mínimo {OBS_MIN} caracteres) para poder cerrar.
        </p>
      )}

      <div className="flex gap-3 mt-5">
        <Button variant="secondary" block onClick={onCancelar}>Cancelar</Button>
        <Button variant="primary" block disabled={!listo} onClick={onContinuar}>Continuar</Button>
      </div>
    </Modal>
  )
}
