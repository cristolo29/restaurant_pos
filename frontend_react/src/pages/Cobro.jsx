import { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Banknote, CreditCard, Smartphone, QrCode, Receipt, FileText,
  StickyNote, Printer, CheckCircle2, AlertCircle, Store,
} from 'lucide-react'
import { cobrarPedido } from '../api/pedidos'
import TicketBoleta from '../components/TicketBoleta'
import ModalConfirm from '../components/ModalConfirm'
import { Button, Card, PageHeader, EmptyState, cn } from '../components/ui'

const METODOS = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'tarjeta',  label: 'Tarjeta',  icon: CreditCard },
  { id: 'yape',     label: 'Yape',     icon: Smartphone },
  { id: 'plin',     label: 'Plin',     icon: QrCode },
]

const TIPOS = [
  { id: 'boleta',  label: 'Boleta',  icon: Receipt },
  { id: 'factura', label: 'Factura', icon: FileText },
]

// Redondeo a 2 decimales para no enviar restos de coma flotante (0.30000000000000004).
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100

const INPUT = 'w-full min-h-12 bg-sunken border border-line-strong rounded-control px-4 text-ink text-base placeholder:text-faint focus:outline-none focus:border-accent aria-[invalid=true]:border-danger transition-colors'

function Opcion({ activa, icon, children, ...props }) {
  const Icon = icon
  return (
    <button
      type="button"
      aria-pressed={activa}
      className={cn(
        'min-h-16 rounded-control border-2 text-base font-semibold transition-colors flex flex-col items-center justify-center gap-1 px-2 active:scale-[0.98]',
        activa
          ? 'bg-accent/10 border-accent text-accent'
          : 'bg-raised border-transparent text-soft hover:text-ink',
      )}
      {...props}
    >
      <Icon className="size-6" aria-hidden="true" />
      {children}
    </button>
  )
}

function Campo({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-muted mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function Cobro() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const pedido = state?.pedido
  const mesa   = state?.mesa

  const [metodo, setMetodo]       = useState('efectivo')
  const [tipoComp, setTipoComp]   = useState('boleta')
  const [ruc, setRuc]             = useState('')
  const [razon, setRazon]         = useState('')
  const [direccion, setDireccion] = useState('')
  const [montoPagado, setMontoPagado] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [comprobante, setComprobante] = useState(null)
  const [modal, setModal] = useState(null)
  const [errorForm, setErrorForm] = useState('')
  const enVuelo = useRef(false) // evita doble cobro aunque el botón se toque dos veces antes de repintar

  if (!pedido) {
    navigate('/mesas')
    return (
      <main className="min-h-screen bg-app">
        <EmptyState
          icon={Store}
          title="No hay un pedido para cobrar"
          description="Vuelve a mesas y elige la cuenta que quieres cobrar."
          action={<Button variant="primary" onClick={() => navigate('/mesas')}>Ir a mesas</Button>}
        />
      </main>
    )
  }

  const items = pedido.items?.filter(i => i.estado !== 'cancelado') || []
  const itemsAgrupados = Object.values(
    items.reduce((acc, item) => {
      if (acc[item.producto_id]) {
        acc[item.producto_id].cantidad += item.cantidad
        acc[item.producto_id].subtotal += Number(item.subtotal)
      } else {
        acc[item.producto_id] = { ...item, subtotal: Number(item.subtotal) }
      }
      return acc
    }, {})
  )
  const bruto    = r2(items.reduce((s, i) => s + Number(i.subtotal), 0))
  const igv      = r2(bruto * 0.18 / 1.18)
  const subtotal = r2(bruto - igv)
  const pagado   = r2(parseFloat(montoPagado) || 0)
  const vuelto   = pagado > bruto ? r2(pagado - bruto) : 0

  // Una sola llamada: el servidor valida, cierra, libera la mesa y emite el comprobante, o no hace nada.
  // Lanza el error para que quien llama decida cómo mostrarlo.
  const ejecutarCobro = async () => {
    if (enVuelo.current) return
    enVuelo.current = true
    setProcesando(true)
    try {
      const res = await cobrarPedido(pedido.id, {
        tipo:              tipoComp,
        metodo_pago:       metodo,
        monto_pagado:      metodo === 'efectivo' && montoPagado ? pagado : bruto,
        vuelto:            metodo === 'efectivo' && montoPagado ? vuelto : 0,
        nro_doc_cliente:   ruc || null,
        razon_social:      razon || null,
        direccion_cliente: direccion || null,
      })
      setComprobante(res.comprobante)
    } catch (e) {
      enVuelo.current = false
      setProcesando(false)
      throw e
    }
  }

  const cobrar = async () => {
    setErrorForm('')
    if (tipoComp === 'factura' && !/^\d{11}$/.test(ruc.trim())) {
      setErrorForm('La factura requiere el RUC del cliente (11 dígitos).')
      return
    }
    // Confirmación para métodos digitales (no hay monto ingresado manualmente)
    if (metodo !== 'efectivo') {
      const LABEL = { tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin' }
      setModal({
        titulo: `Confirmar cobro con ${LABEL[metodo]}`,
        mensaje: `¿Confirmas el cobro de S/ ${bruto.toFixed(2)} con ${LABEL[metodo]}?`,
        labelConfirm: 'Sí, cobrar',
        colorConfirm: 'primary',
        onConfirm: ejecutarCobro,
      })
      return
    }
    try {
      await ejecutarCobro()
    } catch (e) {
      const detail = e.response?.data?.detail
      setErrorForm(
        typeof detail === 'string' ? detail
          : e.response ? 'Revisa los datos del cobro e intenta de nuevo.'
          : 'Sin conexión con el servidor. El pedido sigue abierto; reintenta.',
      )
    }
  }

  // Pantalla de éxito
  if (comprobante) {
    return (
      <main className="min-h-screen bg-app text-ink flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="size-20 rounded-full bg-success/15 border border-success/30 text-success grid place-items-center mx-auto mb-5">
              <CheckCircle2 className="size-10" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-ink mb-1">Cobro exitoso</h1>
            <p role="status" className="text-muted">Mesa {mesa?.numero} liberada</p>
          </div>

          <Card className="p-6 mb-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-muted">Comprobante</span>
              <span className="text-accent font-bold num">{comprobante.numero}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted">Subtotal</span>
              <span className="text-ink num">S/ {Number(comprobante.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-muted">IGV (18%)</span>
              <span className="text-ink num">S/ {Number(comprobante.igv).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-line">
              <span className="text-ink font-semibold">Total</span>
              <span className="text-accent text-3xl font-bold num">S/ {Number(comprobante.total).toFixed(2)}</span>
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            <Button variant="primary" size="lg" block onClick={() => navigate('/mesas')}>
              Volver a mesas
            </Button>
            <Button variant="secondary" size="lg" block icon={Printer} onClick={() => window.print()}>
              Imprimir comprobante
            </Button>
          </div>
        </div>

        {/* Ticket oculto en pantalla, visible solo al imprimir */}
        <TicketBoleta
          comprobante={comprobante}
          mesa={mesa}
          metodo={metodo}
          vuelto={vuelto}
          montoPagado={montoPagado}
        />
        {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
      </main>
    )
  }

  const efectivoInsuficiente = metodo === 'efectivo' && montoPagado && pagado < bruto
  const sinItems = items.length === 0

  return (
    <div className="min-h-screen bg-app text-ink flex flex-col">
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        <div className="mb-3">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate('/comanda', { state: { pedido, mesa } })}
          >
            Volver a la comanda
          </Button>
        </div>
        <PageHeader title={`Cobro · Mesa ${mesa?.numero ?? ''}`} subtitle="Revisa la cuenta y elige cómo paga el cliente" />

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          {/* Resumen del pedido */}
          <Card className="overflow-hidden">
            <h2 className="px-5 py-4 border-b border-line text-ink font-semibold">Resumen del pedido</h2>
            {sinItems ? (
              <EmptyState icon={Receipt} title="Este pedido no tiene ítems para cobrar" className="py-10" />
            ) : (
              <ul className="divide-y divide-line">
                {itemsAgrupados.map(item => (
                  <li key={item.producto_id} className="px-5 py-3 flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-ink">{item.nombre}</p>
                      {item.nota && (
                        <p className="text-muted text-caption flex items-center gap-1">
                          <StickyNote className="size-3.5 shrink-0" aria-hidden="true" /> {item.nota}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-muted text-caption num">{item.cantidad}x</p>
                      <p className="text-ink font-medium num">S/ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-4 border-t border-line space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal (sin IGV)</span>
                <span className="text-ink num">S/ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">IGV (18%)</span>
                <span className="text-ink num">S/ {igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-line">
                <span className="text-ink font-semibold text-lg">Total</span>
                <span className="text-accent text-3xl font-bold num">S/ {bruto.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            {/* Método de pago */}
            <Card className="p-5">
              <h2 id="metodo-titulo" className="text-ink font-semibold mb-4">Método de pago</h2>
              <div role="group" aria-labelledby="metodo-titulo" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {METODOS.map(m => (
                  <Opcion key={m.id} icon={m.icon} activa={metodo === m.id} onClick={() => setMetodo(m.id)}>
                    {m.label}
                  </Opcion>
                ))}
              </div>
            </Card>

            {/* Efectivo recibido */}
            {metodo === 'efectivo' && (
              <Card className="p-5">
                <h2 className="text-ink font-semibold mb-4">Efectivo recibido</h2>

                <div className="flex gap-2 mb-4 flex-wrap">
                  {[10, 20, 50, 100, 200].map(b => (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={montoPagado === String(b)}
                      onClick={() => setMontoPagado(String(b))}
                      className={cn(
                        'min-h-12 min-w-20 px-4 rounded-control border-2 font-semibold num transition-colors active:scale-[0.98]',
                        montoPagado === String(b)
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-raised border-transparent text-soft hover:text-ink',
                      )}
                    >
                      S/ {b}
                    </button>
                  ))}
                </div>

                <Campo id="monto-pagado" label="Monto recibido">
                  <input
                    id="monto-pagado"
                    type="number"
                    inputMode="decimal"
                    value={montoPagado}
                    onChange={e => setMontoPagado(e.target.value)}
                    placeholder={`Mínimo S/ ${bruto.toFixed(2)}`}
                    min={bruto}
                    aria-invalid={pagado > 0 && pagado < bruto}
                    className={cn(INPUT, 'num')}
                  />
                </Campo>

                {pagado > 0 && pagado < bruto && (
                  <div role="alert" className="mt-3 bg-danger/10 border border-danger/30 rounded-control px-4 py-3 flex justify-between items-center">
                    <span className="text-danger font-semibold flex items-center gap-2">
                      <AlertCircle className="size-5" aria-hidden="true" /> Faltan
                    </span>
                    <span className="text-danger text-2xl font-bold num">S/ {(bruto - pagado).toFixed(2)}</span>
                  </div>
                )}

                {vuelto > 0 && (
                  <div role="status" className="mt-3 bg-success/10 border border-success/30 rounded-control px-4 py-3 flex justify-between items-center">
                    <span className="text-success font-semibold">Vuelto</span>
                    <span className="text-success text-3xl font-bold num">S/ {vuelto.toFixed(2)}</span>
                  </div>
                )}
              </Card>
            )}

            {/* Tipo de comprobante */}
            <Card className="p-5">
              <h2 id="tipo-titulo" className="text-ink font-semibold mb-4">Tipo de comprobante</h2>
              <div role="group" aria-labelledby="tipo-titulo" className="grid grid-cols-2 gap-3">
                {TIPOS.map(t => (
                  <Opcion
                    key={t.id}
                    icon={t.icon}
                    activa={tipoComp === t.id}
                    onClick={() => { setTipoComp(t.id); setRuc(''); setRazon(''); setDireccion(''); setErrorForm('') }}
                  >
                    {t.label}
                  </Opcion>
                ))}
              </div>

              {/* Boleta con DNI (opcional) */}
              {tipoComp === 'boleta' && (
                <div className="mt-4 space-y-3">
                  <Campo id="dni" label="DNI del cliente (opcional)">
                    <input
                      id="dni"
                      value={ruc}
                      onChange={e => setRuc(e.target.value)}
                      inputMode="numeric"
                      maxLength={8}
                      className={INPUT}
                    />
                  </Campo>
                  {ruc.length > 0 && (
                    <Campo id="nombre" label="Nombre del cliente (opcional)">
                      <input id="nombre" value={razon} onChange={e => setRazon(e.target.value)} className={INPUT} />
                    </Campo>
                  )}
                  <p className="text-muted text-caption">Déjalo vacío para boleta sin nombre.</p>
                </div>
              )}

              {/* Factura */}
              {tipoComp === 'factura' && (
                <div className="mt-4 space-y-3">
                  <Campo id="ruc" label="RUC del cliente (obligatorio)">
                    <input
                      id="ruc"
                      value={ruc}
                      onChange={e => { setRuc(e.target.value); setErrorForm('') }}
                      inputMode="numeric"
                      maxLength={11}
                      aria-required="true"
                      aria-invalid={!!errorForm && !ruc.trim()}
                      className={INPUT}
                    />
                  </Campo>
                  <Campo id="razon" label="Razón social">
                    <input id="razon" value={razon} onChange={e => setRazon(e.target.value)} className={INPUT} />
                  </Campo>
                  <Campo id="direccion" label="Dirección">
                    <input id="direccion" value={direccion} onChange={e => setDireccion(e.target.value)} className={INPUT} />
                  </Campo>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Barra de acción: total y único botón primario siempre visibles */}
      <footer className="sticky bottom-0 bg-surface border-t border-line px-4 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto">
          {errorForm && (
            <p role="alert" className="mb-3 bg-danger/10 border border-danger/30 text-danger rounded-control px-4 py-2.5 flex items-center gap-2">
              <AlertCircle className="size-5 shrink-0" aria-hidden="true" /> {errorForm}
            </p>
          )}
          <div className="flex items-center gap-4">
            <div className="shrink-0">
              <p className="text-muted text-caption">Total a cobrar</p>
              <p className="text-accent text-2xl sm:text-3xl font-bold num leading-tight">S/ {bruto.toFixed(2)}</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              block
              loading={procesando}
              disabled={sinItems || !!efectivoInsuficiente}
              onClick={cobrar}
              className="text-lg"
            >
              {procesando ? 'Procesando...' : `Cobrar S/ ${bruto.toFixed(2)}`}
            </Button>
          </div>
        </div>
      </footer>

      {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
    </div>
  )
}
