import { Printer } from 'lucide-react'
import { Button } from '../../components/ui'
import { METODO_LABEL, soles } from './util'

// El comprobante es un documento en papel: se muestra y se imprime siempre en
// blanco y negro, independiente del tema oscuro (por eso no usa tokens aquí).
const ESTILO_IMPRESION = `
  @media print {
    @page { margin: 8mm; }
    body * { visibility: hidden; }
    #detalle-comprobante, #detalle-comprobante * { visibility: visible; }
    #detalle-comprobante {
      position: fixed; top: 0; left: 0; width: 100%;
      border: none !important; border-radius: 0 !important;
    }
    #detalle-comprobante .no-print { display: none !important; }
  }
`

const Fila = ({ k, v, className = '' }) => (
  <div className={`flex justify-between gap-6 ${className}`}>
    <span className="text-zinc-500">{k}</span>
    <span className="text-zinc-900 text-right">{v}</span>
  </div>
)

/** Comprobante en formato documento (boleta/factura), grande y legible, imprimible. */
export default function DetalleComprobante({ c }) {
  const esFactura = c.tipo === 'factura'
  const tieneCliente = c.nro_doc_cliente || c.razon_social || c.direccion_cliente
  const descuento = Number(c.descuento) || 0

  return (
    <div id="detalle-comprobante" className="bg-white text-zinc-900 rounded-control border border-zinc-300 text-base">
      <style>{ESTILO_IMPRESION}</style>

      <div className="no-print flex justify-end px-4 py-3 border-b border-zinc-200">
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>Imprimir</Button>
      </div>

      <div className="px-5 sm:px-8 py-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 sm:items-start">
          <div>
            <p className="text-2xl font-bold tracking-tight">Orbezo Resto Bar</p>
            <p className="text-zinc-500 text-sm">Restaurante</p>
          </div>
          <div className="border-2 border-zinc-900 rounded-lg px-5 py-3 text-center sm:min-w-60">
            <p className="text-sm font-semibold uppercase tracking-wide">
              {esFactura ? 'Factura electrónica' : 'Boleta de venta electrónica'}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">{c.numero}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 border-y border-zinc-200 py-4">
          <Fila k="Fecha de emisión" v={c.created_at || '—'} />
          <Fila k="Método de pago" v={METODO_LABEL[c.metodo_pago] || c.metodo_pago || '—'} />
          {tieneCliente ? (
            <>
              {c.nro_doc_cliente && <Fila k={esFactura ? 'RUC' : 'DNI'} v={c.nro_doc_cliente} />}
              {c.razon_social && <Fila k={esFactura ? 'Razón social' : 'Cliente'} v={c.razon_social} />}
              {c.direccion_cliente && <Fila k="Dirección" v={c.direccion_cliente} className="sm:col-span-2" />}
            </>
          ) : (
            <Fila k="Cliente" v="Cliente sin documento" />
          )}
        </div>

        <table className="w-full tabular-nums">
          <thead>
            <tr className="text-zinc-500 text-sm border-b-2 border-zinc-900">
              <th scope="col" className="py-2 pr-2 text-left font-semibold w-14">Cant.</th>
              <th scope="col" className="py-2 px-2 text-left font-semibold">Descripción</th>
              <th scope="col" className="py-2 px-2 text-right font-semibold">P. unit.</th>
              <th scope="col" className="py-2 pl-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(c.items || []).map((item, i) => (
              <tr key={i} className="border-b border-zinc-200">
                <td className="py-3 pr-2">{Number(item.cantidad).toFixed(0)}</td>
                <td className="py-3 px-2">{item.descripcion}</td>
                <td className="py-3 px-2 text-right whitespace-nowrap text-zinc-600">{soles(item.precio_unit)}</td>
                <td className="py-3 pl-2 text-right whitespace-nowrap font-medium">{soles(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-col gap-2 w-full sm:w-80 sm:ml-auto tabular-nums">
          <Fila k="Subtotal (sin IGV)" v={soles(c.subtotal)} />
          <Fila k="IGV 18%" v={soles(c.igv)} />
          <Fila k="Descuento" v={descuento > 0 ? `- ${soles(descuento)}` : soles(0)} />
          <div className="flex justify-between items-baseline gap-6 border-t-2 border-zinc-900 pt-3 mt-1">
            <span className="text-lg font-bold uppercase">Total</span>
            <span className="text-3xl font-bold">{soles(c.total)}</span>
          </div>
          <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 mt-1 text-zinc-600">
            <Fila k="Monto pagado" v={soles(c.monto_pagado)} />
            <Fila k="Vuelto" v={soles(c.vuelto)} />
          </div>
        </div>

        <p className="text-center text-zinc-500 text-sm border-t border-zinc-200 pt-4">Gracias por su preferencia</p>
      </div>
    </div>
  )
}
