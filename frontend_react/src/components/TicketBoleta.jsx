/**
 * TicketBoleta — comprobante en formato ticketera 80mm.
 * En pantalla es invisible. Al hacer window.print() solo se imprime este ticket.
 */
export default function TicketBoleta({ comprobante, mesa, metodo, vuelto, montoPagado }) {
  const ahora = new Date()
  const fecha = ahora.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })

  const METODO_LABEL = { efectivo: 'EFECTIVO', tarjeta: 'TARJETA', yape: 'YAPE', plin: 'PLIN' }
  const esFactura    = comprobante.tipo === 'factura'
  const tieneCliente = !!comprobante.nro_doc_cliente

  return (
    <>
      <style>{`
        /* ── Pantalla: oculto ── */
        #ticket-print { display: none; }

        /* ── Impresión: solo el ticket ── */
        @media print {
          @page { size: 80mm auto; margin: 3mm 2mm; }
          body * { visibility: hidden; }
          #ticket-print,
          #ticket-print * { visibility: visible; }
          #ticket-print {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 76mm;
          }
        }

        /* ── Estilos internos del ticket ── */
        #ticket-print {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          color: #000;
          line-height: 1.5;
          width: 76mm;
        }
        #ticket-print p  { margin: 0; padding: 0; }
        #ticket-print .tc { text-align: center; }
        #ticket-print .tr { text-align: right; }
        #ticket-print .b  { font-weight: bold; }
        #ticket-print .f13 { font-size: 13px; }
        #ticket-print .f14 { font-size: 14px; }
        #ticket-print .f9  { font-size: 9px; margin-top: 3px; }
        #ticket-print hr.solid  { border: none; border-top: 1px solid #000; margin: 3px 0; }
        #ticket-print hr.dashed { border: none; border-top: 1px dashed #000; margin: 3px 0; }
        #ticket-print table { width: 100%; border-collapse: collapse; }
        #ticket-print td   { vertical-align: top; padding: 1px 0; }
        #ticket-print .cant   { width: 22px; }
        #ticket-print .precio { width: 54px; text-align: right; }
        #ticket-print .gap    { height: 6px; }
      `}</style>

      <div id="ticket-print">

        {/* ── ENCABEZADO ── */}
        <p className="tc b f14">ORBEZO RESTO BAR</p>
        <p className="tc">Av. Principal 123, Lima</p>
        <p className="tc">Tel: (01) 234-5678</p>
        <hr className="solid" />

        {/* ── TIPO Y NÚMERO ── */}
        <p className="tc b f13">{esFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA'}</p>
        <p className="tc b f13">N° {comprobante.numero}</p>
        <hr className="dashed" />

        {/* ── FECHA Y MESA ── */}
        <table><tbody>
          <tr>
            <td>Fecha:</td>
            <td className="tr">{fecha} {hora}</td>
          </tr>
          <tr>
            <td>Mesa:</td>
            <td className="tr">{mesa?.numero || '—'}</td>
          </tr>
        </tbody></table>

        {/* ── DATOS DEL CLIENTE (condicional) ── */}
        {tieneCliente && (
          <>
            <hr className="dashed" />
            {esFactura ? (
              /* FACTURA: RUC + Razón Social + Dirección */
              <table><tbody>
                <tr>
                  <td>RUC:</td>
                  <td className="tr">{comprobante.nro_doc_cliente}</td>
                </tr>
                {comprobante.razon_social && (
                  <tr>
                    <td>Razón social:</td>
                    <td className="tr">{comprobante.razon_social}</td>
                  </tr>
                )}
                {comprobante.direccion_cliente && (
                  <tr>
                    <td>Dirección:</td>
                    <td className="tr">{comprobante.direccion_cliente}</td>
                  </tr>
                )}
              </tbody></table>
            ) : (
              /* BOLETA con DNI: DNI + Nombre (opcional) */
              <table><tbody>
                <tr>
                  <td>DNI:</td>
                  <td className="tr">{comprobante.nro_doc_cliente}</td>
                </tr>
                {comprobante.razon_social && (
                  <tr>
                    <td>Nombre:</td>
                    <td className="tr">{comprobante.razon_social}</td>
                  </tr>
                )}
              </tbody></table>
            )}
          </>
        )}
        <hr className="dashed" />

        {/* ── ITEMS ── */}
        {(() => {
          const agrupados = Object.values(
            (comprobante.items || []).reduce((acc, item) => {
              if (acc[item.descripcion]) {
                acc[item.descripcion].cantidad += Number(item.cantidad)
                acc[item.descripcion].subtotal += Number(item.subtotal)
              } else {
                acc[item.descripcion] = { ...item, cantidad: Number(item.cantidad), subtotal: Number(item.subtotal) }
              }
              return acc
            }, {})
          )
          return (
            <table>
              <thead>
                <tr>
                  <td className="cant b">Cant</td>
                  <td className="b">Descripción</td>
                  <td className="precio b">Precio</td>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={3}><hr className="dashed" /></td></tr>
                {agrupados.map((item, i) => (
                  <tr key={i}>
                    <td className="cant">{Number(item.cantidad).toFixed(0)}</td>
                    <td>{item.descripcion}</td>
                    <td className="precio">S/{Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
        <hr className="dashed" />

        {/* ── TOTALES ── */}
        <table><tbody>
          <tr>
            <td>Op. Gravada:</td>
            <td className="tr">S/ {Number(comprobante.subtotal).toFixed(2)}</td>
          </tr>
          <tr>
            <td>IGV (18%):</td>
            <td className="tr">S/ {Number(comprobante.igv).toFixed(2)}</td>
          </tr>
        </tbody></table>
        <hr className="solid" />
        <table><tbody>
          <tr>
            <td className="b f13">TOTAL A PAGAR:</td>
            <td className="tr b f13">S/ {Number(comprobante.total).toFixed(2)}</td>
          </tr>
        </tbody></table>
        <hr className="solid" />

        {/* ── MÉTODO DE PAGO ── */}
        <table><tbody>
          <tr>
            <td className="b">{METODO_LABEL[metodo] || metodo}:</td>
            <td className="tr b">
              S/ {metodo === 'efectivo' && montoPagado
                ? Number(montoPagado).toFixed(2)
                : Number(comprobante.total).toFixed(2)}
            </td>
          </tr>
          {vuelto > 0 && (
            <tr>
              <td className="b">VUELTO:</td>
              <td className="tr b">S/ {Number(vuelto).toFixed(2)}</td>
            </tr>
          )}
        </tbody></table>
        <hr className="solid" />

        {/* ── PIE ── */}
        <p className="tc">¡Gracias por su visita!</p>
        <p className="tc">Vuelva pronto</p>
        <p className="tc f9">Representación impresa del comprobante</p>
        <p className="gap" />

      </div>
    </>
  )
}
