import { useState } from 'react'
import { AlertCircle, EyeOff } from 'lucide-react'
import { Button, Keypad, Modal, Tabs, cn } from '../../components/ui'
import DiferenciaCaja from '../../components/DiferenciaCaja'
import { soles } from '../admin/util'
import { OBS_MIN, aCentimos, conteoParaEnviar, deCentimos, estadoArqueo, totalConteo } from '../../utils/dinero'
import ConteoDenominaciones from './ConteoDenominaciones'

const TABS = [
  { id: 'denominaciones', label: 'Por denominaciones' },
  { id: 'directo', label: 'Monto directo' },
]

/**
 * Paso 1 del cierre: contar el efectivo. Cierre a ciegas: el cajero NO ve el esperado ni la diferencia
 * (el servidor no se los envía); el admin, que sí recibe el esperado, ve la diferencia en vivo.
 * Entrega `{ contadoC, conteo, observaciones }` a `onContinuar`.
 */
export default function CerrarCajaModal({ caja, inicial, onContinuar, onCancelar }) {
  const [modo, setModo] = useState(inicial?.conteo ? 'denominaciones' : 'directo')
  const [conteo, setConteo] = useState(inicial?.conteoCrudo ?? {})
  const [contado, setContado] = useState(inicial?.contado ?? '')
  const [observaciones, setObservaciones] = useState(inicial?.observaciones ?? '')

  const contadoC = modo === 'denominaciones' ? totalConteo(conteo) : aCentimos(contado)
  const { ciego, dif, obs, falta, listo } = estadoArqueo(caja, contadoC, observaciones)
  const invalido = modo === 'directo' && contado !== '' && contadoC === null

  const continuar = () => onContinuar({
    contadoC,
    conteo: modo === 'denominaciones' ? conteoParaEnviar(conteo) : null,
    conteoCrudo: conteo,
    contado,
    observaciones: observaciones.trim(),
  })

  return (
    <Modal title="Cerrar caja · arqueo" description="Cuenta todo el efectivo de la gaveta, sin sacar el fondo." onClose={onCancelar} className="sm:max-w-lg">
      {ciego ? (
        <p className="flex items-center gap-2 bg-sunken rounded-control px-4 py-3 mb-4 text-soft text-sm">
          <EyeOff className="size-5 shrink-0 text-muted" aria-hidden="true" />
          Cierre a ciegas: el sistema te mostrará el resultado después de que confirmes tu conteo.
        </p>
      ) : (
        <div className="flex justify-between items-baseline bg-sunken rounded-control px-4 py-3 mb-4">
          <span className="text-muted text-sm">Efectivo esperado</span>
          <span className="text-ink text-2xl font-bold num">{soles(caja.monto_esperado)}</span>
        </div>
      )}

      <Tabs tabs={TABS} value={modo} onChange={setModo} idBase="conteo" label="Forma de contar" className="mb-4" />
      <div role="tabpanel" id="conteo-panel" aria-labelledby={`conteo-tab-${modo}`}>
        {modo === 'denominaciones' ? (
          <ConteoDenominaciones conteo={conteo} onChange={setConteo} />
        ) : (
          <div>
            <label htmlFor="monto-contado" className="block text-soft text-sm font-medium mb-1.5">Efectivo contado</label>
            <div className="relative">
              <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-2xl font-semibold">S/</span>
              <input
                id="monto-contado"
                value={contado}
                onChange={e => setContado(e.target.value)}
                inputMode="none"
                autoComplete="off"
                placeholder="0.00"
                aria-invalid={invalido || undefined}
                aria-describedby={invalido ? 'monto-contado-error' : undefined}
                className={cn(
                  'w-full min-h-16 bg-sunken border rounded-control pl-14 pr-4 text-ink text-3xl font-bold num placeholder:text-faint focus:outline-none focus:border-accent transition-colors',
                  invalido ? 'border-danger' : 'border-line-strong',
                )}
              />
            </div>
            {invalido && <p id="monto-contado-error" role="alert" className="text-danger text-caption mt-1">Escribe un monto válido, con máximo 2 decimales.</p>}
            <Keypad value={contado} onChange={setContado} className="mt-3" />
          </div>
        )}
      </div>

      {dif && (
        <DiferenciaCaja centimos={dif.centimos} derecha={`${soles(deCentimos(contadoC))} contados`} className="mt-3" />
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
      {falta && obs.length < OBS_MIN && (
        <p className="text-warning text-caption mt-1 flex items-center gap-1">
          <AlertCircle className="size-3.5" aria-hidden="true" /> Explica la diferencia (mínimo {OBS_MIN} caracteres) para poder cerrar.
        </p>
      )}

      <div className="flex gap-3 mt-5">
        <Button variant="secondary" block onClick={onCancelar}>Cancelar</Button>
        <Button variant="primary" block disabled={!listo} onClick={continuar}>Continuar</Button>
      </div>
    </Modal>
  )
}
