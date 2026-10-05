import { useState } from 'react'
import { AlertTriangle, Eye, Receipt, SearchX } from 'lucide-react'
import { Button, Card, EmptyState, Input, Modal, Skeleton, StatusBadge } from '../../components/ui'
import ModalConfirm from '../../components/ModalConfirm'
import DetalleComprobante from './DetalleComprobante'
import { METODO_LABEL, soles } from './util'

const TH = 'px-3 py-3 text-caption font-medium text-muted whitespace-nowrap'

export default function ComprobantesSeccion({ comprobantes, cargando, error, onReintentar }) {
  const [busqueda, setBusqueda] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [detalle, setDetalle] = useState(null)
  const [aviso, setAviso] = useState(null)

  const rangoInvalido = (mensaje) => setAviso({
    titulo: 'Rango de fechas inválido', mensaje,
    labelConfirm: 'Entendido', colorConfirm: 'danger', soloAviso: true, onConfirm: () => {},
  })

  const cambiarInicio = (val) => {
    if (fechaFin && val && val > fechaFin) return rangoInvalido('La fecha "Desde" no puede ser posterior a la fecha "Hasta".')
    setFechaInicio(val)
  }
  const cambiarFin = (val) => {
    if (fechaInicio && val && val < fechaInicio) return rangoInvalido('La fecha "Hasta" no puede ser anterior a la fecha "Desde".')
    setFechaFin(val)
  }

  const filtrados = comprobantes.filter(c => {
    const q = busqueda.toLowerCase().trim()
    if (q && !(c.numero || '').toLowerCase().includes(q) && !(c.nro_doc_cliente || '').toLowerCase().includes(q)) return false
    if (fechaInicio || fechaFin) {
      const partes = (c.created_at || '').split(' ')[0].split('/')
      if (partes.length === 3) {
        const fechaComp = `${partes[2]}-${partes[1]}-${partes[0]}`
        if (fechaInicio && fechaComp < fechaInicio) return false
        if (fechaFin && fechaComp > fechaFin) return false
      }
    }
    return true
  })
  const totalRango = filtrados.reduce((s, c) => s + Number(c.total), 0)
  const hayFiltro = fechaInicio || fechaFin || busqueda.trim()

  let cuerpo
  if (cargando) {
    cuerpo = <Card className="p-4 flex flex-col gap-3" aria-busy="true">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</Card>
  } else if (error && comprobantes.length === 0) {
    cuerpo = (
      <Card><EmptyState icon={AlertTriangle} tone="danger" title="No se pudieron cargar los comprobantes"
        description="Revisa la conexión e inténtalo de nuevo."
        action={<Button variant="primary" onClick={onReintentar}>Reintentar</Button>} /></Card>
    )
  } else if (filtrados.length === 0) {
    cuerpo = (
      <Card><EmptyState icon={hayFiltro ? SearchX : Receipt}
        title={hayFiltro ? 'Ningún comprobante coincide con los filtros' : 'Sin comprobantes emitidos aún'} /></Card>
    )
  } else {
    cuerpo = (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Comprobantes emitidos</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${TH} text-left`}>N°</th>
                <th scope="col" className={`${TH} text-left`}>Tipo</th>
                <th scope="col" className={`${TH} text-left hidden md:table-cell`}>Fecha</th>
                <th scope="col" className={`${TH} text-left hidden sm:table-cell`}>Método</th>
                <th scope="col" className={`${TH} text-left hidden lg:table-cell`}>Cliente</th>
                <th scope="col" className={`${TH} text-right`}>Total</th>
                <th scope="col" className={`${TH} text-right`}><span className="sr-only">Detalle</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-raised/40 transition-colors">
                  <td className="px-3 py-2 text-accent font-medium whitespace-nowrap">{c.numero}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={c.tipo === 'factura' ? 'info' : 'success'}>{c.tipo === 'factura' ? 'Factura' : 'Boleta'}</StatusBadge>
                  </td>
                  <td className="px-3 py-2 text-muted hidden md:table-cell whitespace-nowrap">{c.created_at || '—'}</td>
                  <td className="px-3 py-2 text-muted hidden sm:table-cell">{METODO_LABEL[c.metodo_pago] || c.metodo_pago || '—'}</td>
                  <td className="px-3 py-2 text-muted hidden lg:table-cell">
                    {c.razon_social ? `${c.razon_social} · ${c.nro_doc_cliente}` : c.nro_doc_cliente || '—'}
                  </td>
                  <td className="num px-3 py-2 text-right text-ink font-semibold whitespace-nowrap">{soles(c.total)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" iconOnly icon={Eye} onClick={() => setDetalle(c)} aria-label={`Ver detalle del comprobante ${c.numero}`} title="Ver detalle" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    )
  }

  return (
    <section aria-labelledby="titulo-comprobantes">
      <div className="mb-4">
        <h2 id="titulo-comprobantes" className="text-lg font-bold text-ink">Comprobantes</h2>
        <p className="text-muted text-sm" aria-live="polite">{filtrados.length} registro(s)</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <Input label="Buscar" type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="N° o DNI/RUC..." className="flex-1 min-w-48" />
        <Input label="Desde" type="date" value={fechaInicio} onChange={e => cambiarInicio(e.target.value)} className="flex-1 min-w-40" />
        <Input label="Hasta" type="date" value={fechaFin} onChange={e => cambiarFin(e.target.value)} className="flex-1 min-w-40" />
        {(fechaInicio || fechaFin) && (
          <Button onClick={() => { setFechaInicio(''); setFechaFin('') }}>Limpiar fechas</Button>
        )}
      </div>

      {hayFiltro && !cargando && (
        <Card className="border-accent/30 px-4 py-3 flex justify-between items-center mb-4">
          <span className="text-muted text-sm">{filtrados.length} resultado(s)</span>
          <div className="text-right">
            <p className="text-muted text-caption">Total del rango</p>
            <p className="num text-accent font-bold text-lg">{soles(totalRango)}</p>
          </div>
        </Card>
      )}

      {cuerpo}

      {detalle && (
        <Modal title={`Comprobante ${detalle.numero}`} onClose={() => setDetalle(null)} className="sm:max-w-2xl"
          description={`${detalle.tipo === 'factura' ? 'Factura' : 'Boleta'} · ${METODO_LABEL[detalle.metodo_pago] || detalle.metodo_pago || '—'} · ${detalle.created_at || '—'}`}>
          <DetalleComprobante c={detalle} />
        </Modal>
      )}
      {aviso && <ModalConfirm {...aviso} onCancel={() => setAviso(null)} />}
    </section>
  )
}
