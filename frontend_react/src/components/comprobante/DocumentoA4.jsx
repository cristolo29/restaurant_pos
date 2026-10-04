import { formatearSoles as S } from '../../utils/comprobante'

const Fila = ({ k, v, className = '' }) => (
  <div className={`cp-fila ${className}`}><dt>{k}</dt><dd>{v}</dd></div>
)

/** Documento A4: emisor + recuadro del tipo, datos, tabla con encabezado repetido, totales e importe en letras. */
export default function DocumentoA4({ d, emisor }) {
  const { cliente } = d
  return (
    <div className="cp-doc cp-a4">
      <header className="cp-cab">
        <div className="cp-emisor">
          {emisor.logo && <img className="cp-logo" src={emisor.logo} alt="" />}
          <div>
            <h1>{emisor.nombre}</h1>
            {emisor.direccion && <p>{emisor.direccion}</p>}
            {emisor.telefono && <p>Tel.: {emisor.telefono}</p>}
          </div>
        </div>
        <div className="cp-caja">
          {emisor.ruc && <p className="cp-ruc">R.U.C. {emisor.ruc}</p>}
          <p className="cp-tipo">{d.tipoTexto}</p>
          <p className="cp-nro cp-num">{d.numero}</p>
        </div>
      </header>

      <dl className="cp-datos">
        <Fila k="Fecha de emisión" v={d.fecha || '—'} />
        <Fila k="Hora" v={d.hora || '—'} />
        {d.mesa && <Fila k="Mesa" v={d.mesa} />}
        {d.atendidoPor && <Fila k="Atendido por" v={d.atendidoPor} />}
        {d.metodo && <Fila k="Método de pago" v={d.metodo} className="cp-ancho" />}
        <div className="cp-sep" aria-hidden="true" />
        {cliente.sinDocumento ? (
          <Fila k="Cliente" v="Cliente sin documento" className="cp-ancho" />
        ) : (
          <>
            {cliente.doc && <Fila k={cliente.etiquetaDoc} v={cliente.doc} />}
            {cliente.nombre && <Fila k={cliente.etiquetaNombre} v={cliente.nombre} className={cliente.doc ? '' : 'cp-ancho'} />}
            {cliente.direccion && <Fila k="Dirección" v={cliente.direccion} className="cp-ancho" />}
          </>
        )}
      </dl>

      <table>
        <thead>
          <tr>
            <th scope="col" className="cp-c">Cant.</th>
            <th scope="col" className="cp-d">Descripción</th>
            <th scope="col" className="cp-r">P. unit.</th>
            <th scope="col" className="cp-r">Importe</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i, n) => (
            <tr key={n}>
              <td className="cp-c cp-num">{i.cantidad}</td>
              <td className="cp-d">{i.descripcion}</td>
              <td className="cp-r cp-num">{S(i.precioUnit)}</td>
              <td className="cp-r cp-num cp-b">{S(i.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cp-cierre">
        <div className="cp-totales cp-num">
          <div className="cp-tot"><span>Op. gravada</span><span>{S(d.subtotal)}</span></div>
          <div className="cp-tot"><span>IGV 18 %</span><span>{S(d.igv)}</span></div>
          <div className="cp-tot"><span>Descuento</span><span>{d.descuento > 0 ? `- ${S(d.descuento)}` : S(0)}</span></div>
          <div className="cp-tot cp-tot-total"><span>TOTAL</span><span>{S(d.total)}</span></div>
          {d.pagoEfectivo && (
            <>
              <div className="cp-tot"><span>Monto pagado</span><span>{S(d.montoPagado)}</span></div>
              <div className="cp-tot"><span>Vuelto</span><span>{S(d.vuelto)}</span></div>
            </>
          )}
        </div>
        {d.letras && <p className="cp-letras">{d.letras}</p>}
        <footer className="cp-pie">
          {emisor.leyenda && <p className="cp-leyenda">{emisor.leyenda}</p>}
          <p>Gracias por su preferencia</p>
        </footer>
      </div>
    </div>
  )
}
