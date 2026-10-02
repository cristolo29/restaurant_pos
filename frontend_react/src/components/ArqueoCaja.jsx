import { Printer } from 'lucide-react'
import { Button } from './ui'
import { METODO_LABEL, soles } from '../pages/admin/util'
import { DENOMINACIONES, TIPO_MOVIMIENTO, describirDiferencia, deCentimos, fechaHora, hora } from '../utils/dinero'

// El arqueo es un documento en papel: blanco y negro siempre, igual que el comprobante.
const ESTILO_IMPRESION = `
  @media print {
    @page { margin: 8mm; }
    body * { visibility: hidden; }
    #arqueo-caja, #arqueo-caja * { visibility: visible; }
    #arqueo-caja { position: fixed; top: 0; left: 0; width: 100%; border: none !important; border-radius: 0 !important; }
    #arqueo-caja .no-print { display: none !important; }
  }
`

const Fila = ({ k, v, fuerte = false }) => (
  <div className={`flex justify-between gap-6 ${fuerte ? 'font-bold text-lg' : ''}`}>
    <span className={fuerte ? '' : 'text-zinc-500'}>{k}</span>
    <span className="text-right tabular-nums">{v}</span>
  </div>
)

/** Arqueo final de una caja cerrada, en formato documento e imprimible. */
export default function ArqueoCaja({ caja }) {
  const dif = describirDiferencia(Math.round(Number(caja.diferencia) * 100))
  const icono = { cuadra: '✓', falta: '▼', sobra: '▲' }[dif.tipo]
  const mov = caja.totales_movimientos ?? { ingreso: 0, egreso: 0, retiro: 0 }
  const movimientos = caja.movimientos ?? []
  const filasConteo = DENOMINACIONES.filter(d => (caja.conteo?.[d.clave] ?? 0) > 0)

  return (
    <div id="arqueo-caja" className="bg-white text-zinc-900 rounded-control border border-zinc-300 text-base">
      <style>{ESTILO_IMPRESION}</style>

      <div className="no-print flex justify-end px-4 py-3 border-b border-zinc-200">
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>Imprimir arqueo</Button>
      </div>

      <div className="px-5 sm:px-8 py-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
          <div>
            <p className="text-2xl font-bold tracking-tight">Orbezo Resto Bar</p>
            <p className="text-zinc-500 text-sm">Arqueo de caja</p>
          </div>
          <div className="border-2 border-zinc-900 rounded-lg px-5 py-2 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide">Caja N.º</p>
            <p className="text-2xl font-bold tabular-nums">{caja.id}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-y border-zinc-200 py-4">
          <Fila k="Responsable" v={caja.usuario_nombre || '—'} />
          <Fila k="Apertura" v={fechaHora(caja.abierta_at)} />
          <Fila k="Cierre" v={fechaHora(caja.cerrada_at)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Ventas ({caja.comprobantes} comprobante{caja.comprobantes === 1 ? '' : 's'})</p>
          {Object.entries(caja.por_metodo).map(([m, v]) => (
            <Fila key={m} k={METODO_LABEL[m] ?? m} v={soles(v)} />
          ))}
          <div className="border-t border-zinc-300 pt-1.5 mt-1"><Fila k="Total cobrado" v={soles(caja.total_cobrado)} fuerte /></div>
        </div>

        <div className="flex flex-col gap-1.5 border-t-2 border-zinc-900 pt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Efectivo</p>
          <Fila k="Fondo inicial" v={soles(caja.monto_inicial)} />
          <Fila k="+ Cobrado en efectivo" v={soles(caja.por_metodo.efectivo)} />
          <Fila k="+ Ingresos" v={soles(mov.ingreso)} />
          <Fila k="− Egresos" v={soles(mov.egreso)} />
          <Fila k="− Retiros" v={soles(mov.retiro)} />
          <Fila k="Efectivo esperado" v={soles(caja.monto_esperado)} fuerte />
          <Fila k="Efectivo contado" v={soles(caja.monto_contado)} fuerte />
          <div className="border border-zinc-900 rounded-md px-3 py-2 mt-2 flex justify-between items-baseline font-bold">
            <span className="text-xl"><span aria-hidden="true">{icono} </span>{dif.texto}</span>
          </div>
        </div>

        {filasConteo.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Conteo por denominaciones</p>
            {filasConteo.map(d => (
              <Fila key={d.clave} k={`${d.tipo === 'billete' ? 'Billete' : 'Moneda'} S/ ${d.clave} × ${caja.conteo[d.clave]}`} v={soles(deCentimos(d.centimos * caja.conteo[d.clave]))} />
            ))}
          </div>
        )}

        {(caja.autorizado_por_nombre || movimientos.length > 0) && (
          <div className="flex flex-col gap-1">
            {caja.autorizado_por_nombre && <Fila k="Diferencia autorizada por" v={caja.autorizado_por_nombre} />}
            {movimientos.length > 0 && (
              <>
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mt-2">Movimientos de efectivo</p>
                {movimientos.map(m => (
                  <Fila key={m.id} k={`${hora(m.created_at)} ${TIPO_MOVIMIENTO[m.tipo].corto} · ${m.motivo}`} v={`${TIPO_MOVIMIENTO[m.tipo].signo} ${soles(m.monto)}`} />
                ))}
              </>
            )}
          </div>
        )}

        {caja.observaciones && (
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Observaciones</p>
            <p className="mt-1">{caja.observaciones}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-10 pt-10 text-center text-sm text-zinc-500">
          <p className="border-t border-zinc-400 pt-1">Cajero</p>
          <p className="border-t border-zinc-400 pt-1">Administración</p>
        </div>
      </div>
    </div>
  )
}
