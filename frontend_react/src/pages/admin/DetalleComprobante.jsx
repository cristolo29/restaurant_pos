import { soles } from './util'

const Fila = ({ k, v, fuerte, tone }) => (
  <div className="flex justify-between gap-4">
    <span className={fuerte ? 'text-ink font-semibold' : 'text-muted'}>{k}</span>
    <span className={`num text-right ${tone ?? (fuerte ? 'text-accent font-bold' : 'text-soft')}`}>{v}</span>
  </div>
)

const Titulo = ({ children }) => <h3 className="text-muted text-caption uppercase tracking-wider mb-2">{children}</h3>

/** Contenido de un comprobante: productos, resumen de pago y datos del cliente. */
export default function DetalleComprobante({ c }) {
  const esFactura = c.tipo === 'factura'
  const efectivo = c.metodo_pago === 'efectivo' && Number(c.monto_pagado) > 0
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
      <div>
        <Titulo>Productos</Titulo>
        <ul className="flex flex-col gap-1.5">
          {c.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="text-soft">{Number(item.cantidad).toFixed(0)}× {item.descripcion}</span>
              <span className="num text-ink font-medium shrink-0">{soles(item.subtotal)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <Titulo>Resumen de pago</Titulo>
        <Fila k="Subtotal (sin IGV)" v={soles(c.subtotal)} />
        <Fila k="IGV 18%" v={soles(c.igv)} />
        <div className="border-t border-line pt-1.5 mt-0.5"><Fila k="Total" v={soles(c.total)} fuerte /></div>
        {efectivo && (
          <>
            <Fila k="Efectivo recibido" v={soles(c.monto_pagado)} />
            <Fila k="Vuelto" v={soles(c.vuelto)} tone="text-success" />
          </>
        )}
        {(c.nro_doc_cliente || c.razon_social || c.direccion_cliente) && (
          <div className="border-t border-line pt-1.5 mt-1 flex flex-col gap-1.5">
            {c.nro_doc_cliente && <Fila k={esFactura ? 'RUC' : 'DNI'} v={c.nro_doc_cliente} />}
            {c.razon_social && <Fila k={esFactura ? 'Razón social' : 'Nombre'} v={c.razon_social} />}
            {c.direccion_cliente && <Fila k="Dirección" v={c.direccion_cliente} />}
          </div>
        )}
      </div>
    </div>
  )
}
