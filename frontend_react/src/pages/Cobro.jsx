import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../store/useAuth'
import { cerrarPedido } from '../api/pedidos'
import { emitirComprobante } from '../api/comprobantes'
import TicketBoleta from '../components/TicketBoleta'
import ModalConfirm from '../components/ModalConfirm'

const METODOS = [
  { id: 'efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'tarjeta',  label: 'Tarjeta',  icon: '💳' },
  { id: 'yape',     label: 'Yape',     icon: '📱' },
  { id: 'plin',     label: 'Plin',     icon: '📲' },
]

export default function Cobro() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const usuario = useAuth(s => s.usuario)

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

  if (!pedido) { navigate('/mesas'); return null }

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
  const bruto    = items.reduce((s, i) => s + Number(i.subtotal), 0)
  const igv      = bruto * 0.18 / 1.18
  const subtotal = bruto - igv
  const pagado   = parseFloat(montoPagado) || 0
  const vuelto   = pagado > bruto ? pagado - bruto : 0

  const cobrar = async () => {
    if (tipoComp === 'factura' && !ruc.trim()) {
      setModal({
        titulo: 'RUC requerido',
        mensaje: 'La factura requiere el RUC del cliente.',
        labelConfirm: 'Entendido',
        colorConfirm: 'warning',
        onConfirm: () => {},
      })
      return
    }
    setProcesando(true)
    try {
      // 1. Cerrar pedido
      await cerrarPedido(pedido.id)

      // 2. Emitir comprobante
      const comp = await emitirComprobante({
        pedido_id:         pedido.id,
        tipo:              tipoComp,
        metodo_pago:       metodo,
        monto_pagado:      metodo === 'efectivo' && montoPagado ? parseFloat(montoPagado) : bruto,
        vuelto:            vuelto,
        nro_doc_cliente:   ruc || null,
        razon_social:      razon || null,
        direccion_cliente: direccion || null,
      })
      setComprobante(comp)
    } catch (e) {
      setModal({
        titulo: 'Error al procesar cobro',
        mensaje: e.response?.data?.detail || 'Ocurrió un error inesperado.',
        labelConfirm: 'Entendido',
        colorConfirm: 'danger',
        onConfirm: () => {},
      })
      setProcesando(false)
    }
  }

  // Pantalla de éxito
  if (comprobante) {
    return (
      <div className="min-h-screen bg-[#18181b] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/30 flex items-center justify-center text-4xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">¡Cobro exitoso!</h2>
          <p className="text-[#71717a] text-sm mb-8">Mesa {mesa?.numero} liberada</p>

          <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-6 text-left mb-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[#71717a] text-sm">Comprobante</span>
              <span className="text-[#f59e0b] font-bold">{comprobante.numero}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#71717a] text-sm">Subtotal</span>
              <span className="text-white">S/ {Number(comprobante.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#71717a] text-sm">IGV (18%)</span>
              <span className="text-white">S/ {Number(comprobante.igv).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-[#3f3f46]">
              <span className="text-white font-semibold">Total</span>
              <span className="text-[#f59e0b] text-xl font-bold">S/ {Number(comprobante.total).toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full bg-[#27272a] border border-[#3f3f46] text-white py-3 rounded-xl font-semibold hover:border-[#f59e0b]/50 hover:text-[#f59e0b] transition-colors mb-3 flex items-center justify-center gap-2"
          >
            🖨️ Imprimir comprobante
          </button>

          <button
            onClick={() => navigate('/mesas')}
            className="w-full bg-[#f59e0b] text-black py-3 rounded-xl font-bold hover:bg-[#d97706] transition-colors"
          >
            Volver a mesas
          </button>
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      {/* Header */}
      <header className="bg-[#27272a] px-6 py-4 flex justify-between items-center border-b border-[#3f3f46]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-[#71717a] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#3f3f46]"
          >
            ← Comanda
          </button>
          <div className="w-px h-5 bg-[#3f3f46]" />
          <span className="text-white font-bold">Cobro · Mesa {mesa?.numero}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full flex flex-col gap-6">

        {/* Resumen del pedido */}
        <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#3f3f46]">
            <p className="text-white font-semibold">Resumen del pedido</p>
          </div>
          <div className="divide-y divide-[#3f3f46]">
            {itemsAgrupados.map(item => (
              <div key={item.producto_id} className="px-5 py-3 flex justify-between items-center">
                <div>
                  <p className="text-white text-sm">{item.nombre}</p>
                  {item.nota && <p className="text-[#71717a] text-xs">📝 {item.nota}</p>}
                </div>
                <div className="text-right">
                  <p className="text-[#71717a] text-xs">{item.cantidad}x</p>
                  <p className="text-white text-sm font-medium">S/ {Number(item.subtotal).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-[#3f3f46] space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[#71717a]">Subtotal (sin IGV)</span>
              <span className="text-white">S/ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#71717a]">IGV (18%)</span>
              <span className="text-white">S/ {igv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t border-[#3f3f46] mt-2">
              <span className="text-white">Total</span>
              <span className="text-[#f59e0b] text-xl">S/ {bruto.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Método de pago */}
        <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-5">
          <p className="text-white font-semibold mb-4">Método de pago</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METODOS.map(m => (
              <button
                key={m.id}
                onClick={() => setMetodo(m.id)}
                className={`py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1
                  ${metodo === m.id
                    ? 'bg-[#f59e0b]/10 border-[#f59e0b]/60 text-[#f59e0b]'
                    : 'bg-[#3f3f46] border-transparent text-[#a1a1aa] hover:text-white'
                  }`}
              >
                <span className="text-xl">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vuelto — solo efectivo */}
        {metodo === 'efectivo' && (
          <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-5">
            <p className="text-white font-semibold mb-4">Efectivo recibido</p>

            {/* Billetes rápidos */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {[10, 20, 50, 100, 200].map(b => (
                <button
                  key={b}
                  onClick={() => setMontoPagado(String(b))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                    ${montoPagado === String(b)
                      ? 'bg-[#f59e0b]/10 border-[#f59e0b]/60 text-[#f59e0b]'
                      : 'bg-[#3f3f46] border-transparent text-[#a1a1aa] hover:text-white'
                    }`}
                >
                  S/ {b}
                </button>
              ))}
            </div>

            <input
              type="number"
              value={montoPagado}
              onChange={e => setMontoPagado(e.target.value)}
              placeholder={`Mínimo S/ ${bruto.toFixed(2)}`}
              min={bruto}
              className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
            />

            {pagado > 0 && pagado < bruto && (
              <p className="text-red-400 text-xs mt-2 px-1">El monto es menor al total</p>
            )}

            {vuelto > 0 && (
              <div className="mt-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-[#22c55e] font-semibold">Vuelto</span>
                <span className="text-[#22c55e] text-2xl font-bold">S/ {vuelto.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Tipo de comprobante */}
        <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-5">
          <p className="text-white font-semibold mb-4">Tipo de comprobante</p>
          <div className="grid grid-cols-2 gap-2">
            {['boleta', 'factura'].map(t => (
              <button
                key={t}
                onClick={() => { setTipoComp(t); setRuc(''); setRazon(''); setDireccion('') }}
                className={`py-3 rounded-xl border text-sm font-medium transition-all capitalize
                  ${tipoComp === t
                    ? 'bg-[#f59e0b]/10 border-[#f59e0b]/60 text-[#f59e0b]'
                    : 'bg-[#3f3f46] border-transparent text-[#a1a1aa] hover:text-white'
                  }`}
              >
                {t === 'boleta' ? '🧾 Boleta' : '📄 Factura'}
              </button>
            ))}
          </div>

          {/* Campos boleta con DNI (opcional) */}
          {tipoComp === 'boleta' && (
            <div className="mt-4 space-y-3">
              <input
                value={ruc}
                onChange={e => setRuc(e.target.value)}
                placeholder="DNI del cliente (opcional)"
                maxLength={8}
                className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
              {ruc.length > 0 && (
                <input
                  value={razon}
                  onChange={e => setRazon(e.target.value)}
                  placeholder="Nombre del cliente (opcional)"
                  className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
                />
              )}
              <p className="text-[#52525b] text-xs px-1">Déjalo vacío para boleta sin nombre</p>
            </div>
          )}

          {/* Campos factura */}
          {tipoComp === 'factura' && (
            <div className="mt-4 space-y-3">
              <input
                value={ruc}
                onChange={e => setRuc(e.target.value)}
                placeholder="RUC del cliente *"
                maxLength={11}
                className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
              <input
                value={razon}
                onChange={e => setRazon(e.target.value)}
                placeholder="Razón social"
                className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
              <input
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
                placeholder="Dirección"
                className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
              />
            </div>
          )}
        </div>

        {/* Botón cobrar */}
        <button
          onClick={cobrar}
          disabled={procesando || items.length === 0 || (metodo === 'efectivo' && montoPagado && pagado < bruto)}
          className="w-full bg-[#f59e0b] text-black py-4 rounded-2xl text-lg font-bold hover:bg-[#d97706] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#f59e0b]/20"
        >
          {procesando ? 'Procesando...' : `Cobrar S/ ${bruto.toFixed(2)}`}
        </button>
      </div>

      {modal && <ModalConfirm {...modal} onCancel={() => setModal(null)} />}
    </div>
  )
}
