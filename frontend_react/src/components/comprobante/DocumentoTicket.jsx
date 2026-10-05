import { formatearSoles as S } from '../../utils/comprobante'

const Par = ({ k, v, className = '' }) => (
  <div className={`cp-par ${className}`}><span>{k}</span><span>{v}</span></div>
)

/** Ticket de rollo de 80 mm: columna única de ≈ 72 mm; la descripción envuelve en vez de cortarse. */
export default function DocumentoTicket({ d, emisor }) {
  const { cliente } = d
  return (
    <div className="cp-doc cp-ticket">
      <header className="cp-cen">
        {emisor.logo && <img className="cp-logo" src={emisor.logo} alt="" />}
        <h1>{emisor.nombre}</h1>
        {emisor.ruc && <p>RUC: {emisor.ruc}</p>}
        {emisor.direccion && <p>{emisor.direccion}</p>}
        {emisor.telefono && <p>Tel.: {emisor.telefono}</p>}
      </header>
      <hr className="cp-linea cp-linea-s" />
      <div className="cp-cen">
        <p className="cp-tipo">{d.tipoTexto}</p>
        <p className="cp-nro cp-num">{d.numero}</p>
      </div>
      <hr className="cp-linea" />
      <Par k="Emisión" v={`${d.fecha} ${d.hora}`.trim() || '—'} className="cp-num" />
      {d.mesa && <Par k="Mesa" v={d.mesa} />}
      {d.atendidoPor && <Par k="Atendido por" v={d.atendidoPor} />}
      {d.metodo && <Par k="Pago" v={d.metodo} />}
      <hr className="cp-linea" />
      {cliente.sinDocumento ? <p>Cliente sin documento</p> : (
        <>
          {cliente.doc && <Par k={cliente.etiquetaDoc} v={cliente.doc} className="cp-num" />}
          {cliente.nombre && <Par k={cliente.etiquetaNombre} v={cliente.nombre} />}
          {cliente.direccion && <Par k="Dirección" v={cliente.direccion} />}
        </>
      )}
      <hr className="cp-linea" />
      <Par k="CANT. x P. UNIT. / DESCRIPCIÓN" v="IMPORTE" className="cp-cols cp-peq" />
      <hr className="cp-linea" />
      {d.items.map((i, n) => (
        <div key={n} className="cp-item">
          <p className="cp-item-desc">{i.descripcion}</p>
          <Par k={`${i.cantidad} x ${S(i.precioUnit)}`} v={S(i.importe)} className="cp-num" />
        </div>
      ))}
      <hr className="cp-linea" />
      <div className="cp-num">
        <Par k="Op. gravada" v={S(d.subtotal)} />
        <Par k="IGV 18 %" v={S(d.igv)} />
        {d.descuento > 0 && <Par k="Descuento" v={`- ${S(d.descuento)}`} />}
      </div>
      <hr className="cp-linea cp-linea-s" />
      <Par k="TOTAL" v={S(d.total)} className="cp-total cp-num" />
      <hr className="cp-linea cp-linea-s" />
      {d.pagoEfectivo && (
        <div className="cp-num">
          <Par k="Monto pagado" v={S(d.montoPagado)} />
          <Par k="Vuelto" v={S(d.vuelto)} />
        </div>
      )}
      {d.letras && <p className="cp-letras" style={{ marginTop: 6 }}>{d.letras}</p>}
      <hr className="cp-linea" />
      <footer className="cp-cen">
        {emisor.leyenda && <p className="cp-peq">{emisor.leyenda}</p>}
        <p>Gracias por su preferencia</p>
      </footer>
    </div>
  )
}
