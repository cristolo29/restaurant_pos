import { ArrowRight, Ban, ClipboardList, Minus, Plus, Send, StickyNote, Trash2 } from 'lucide-react'
import { Button, EmptyState, StatusBadge, cn } from '../../components/ui'
import { ESTADO_ITEM } from './estados'

const money = (n) => `S/ ${Number(n).toFixed(2)}`

function Seccion({ titulo, cuenta, children }) {
  return (
    <section>
      <h3 className="flex items-center justify-between text-faint text-caption font-semibold uppercase tracking-wider mb-2 px-1">
        {titulo}
        <span className="num normal-case tracking-normal">{cuenta}</span>
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

/** Panel derecho: ítems por enviar, ítems enviados, totales y acción principal. */
export default function PanelPedido({
  carrito, enviados, totalCarrito, totalEnviado, totalGeneral,
  enviando, puedeCobrar, puedeIrACobro,
  onMas, onMenos, onEnviar, onQuitarEnviado, onCobrar, onAnular,
}) {
  const vacio = carrito.length === 0 && enviados.length === 0
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0)

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-5">
        {carrito.length > 0 && (
          <Seccion titulo="Por enviar a cocina" cuenta={`${unidades} ${unidades === 1 ? 'unidad' : 'unidades'}`}>
            {carrito.map(item => (
              <li key={item._key} className="bg-surface border border-accent/40 rounded-control p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-base font-medium leading-snug">{item.nombre}</p>
                    {item.nota && (
                      <p className="flex items-start gap-1 text-accent text-caption mt-0.5">
                        <StickyNote className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="break-words min-w-0">{item.nota}</span>
                      </p>
                    )}
                  </div>
                  <span className="num text-ink font-semibold shrink-0">{money(item.subtotal)}</span>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2">
                  <Button
                    variant="secondary" iconOnly size="sm" icon={item.cantidad === 1 ? Trash2 : Minus}
                    onClick={() => onMenos(item._key)}
                    aria-label={item.cantidad === 1 ? `Quitar ${item.nombre}` : `Quitar una unidad de ${item.nombre}`}
                    className={item.cantidad === 1 ? 'hover:text-danger' : undefined}
                  />
                  <span className="num text-ink text-lg font-bold w-10 text-center" aria-label={`${item.cantidad} unidades`}>{item.cantidad}</span>
                  <Button
                    variant="secondary" iconOnly size="sm" icon={Plus}
                    onClick={() => onMas(item)}
                    aria-label={`Agregar una unidad de ${item.nombre}`}
                  />
                </div>
              </li>
            ))}
          </Seccion>
        )}

        {enviados.length > 0 && (
          <Seccion titulo="Ya enviados" cuenta={`${enviados.length} ${enviados.length === 1 ? 'ítem' : 'ítems'}`}>
            {enviados.map(item => {
              const estado = ESTADO_ITEM[item.estado] ?? ESTADO_ITEM.pendiente
              return (
                <li
                  key={item.id}
                  className={cn(
                    'bg-surface border rounded-control p-3 flex items-start gap-2',
                    item.estado === 'listo' ? 'border-success/60' : 'border-line',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-ink text-base font-medium leading-snug">
                      <span className="num text-soft">{item.cantidad}×</span> {item.nombre}
                    </p>
                    {item.nota && (
                      <p className="flex items-start gap-1 text-accent text-caption mt-0.5">
                        <StickyNote className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="break-words min-w-0">{item.nota}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge tone={estado.tono} icon={estado.icono}>{estado.label}</StatusBadge>
                      <span className="num text-muted text-caption">{money(item.subtotal)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost" iconOnly size="sm" icon={Trash2}
                    onClick={() => onQuitarEnviado(item)}
                    aria-label={`Quitar ${item.nombre} del pedido`}
                    className="hover:text-danger hover:bg-danger/10 -mr-1 -mt-1"
                  />
                </li>
              )
            })}
          </Seccion>
        )}

        {vacio && (
          <EmptyState
            className="my-auto"
            icon={ClipboardList}
            title="Aún no hay productos"
            description="Toca un producto de la carta para agregarlo al pedido."
          />
        )}
      </div>

      <div className="border-t border-line bg-sunken p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1 text-caption text-muted">
          {carrito.length > 0 && (
            <div className="flex justify-between"><span>Por enviar</span><span className="num">{money(totalCarrito)}</span></div>
          )}
          {enviados.length > 0 && (
            <div className="flex justify-between"><span>Enviado a cocina</span><span className="num">{money(totalEnviado)}</span></div>
          )}
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-soft font-medium">Total</span>
          <span className="num text-ink text-3xl font-bold">{money(totalGeneral)}</span>
        </div>

        {carrito.length > 0 ? (
          <Button variant="primary" size="lg" icon={Send} block loading={enviando} onClick={onEnviar}>
            Enviar a cocina ({unidades})
          </Button>
        ) : puedeCobrar ? (
          <Button variant="primary" size="lg" icon={ArrowRight} block disabled={!puedeIrACobro} onClick={onCobrar}>
            Ir a cobrar
          </Button>
        ) : (
          <p className="text-center text-muted text-sm py-2">El cajero realizará el cobro</p>
        )}

        {/* Si hay carrito, "Ir a cobrar" sigue disponible como acción secundaria */}
        {carrito.length > 0 && puedeCobrar && (
          <Button variant="secondary" block disabled={!puedeIrACobro} onClick={onCobrar}>
            Ir a cobrar
          </Button>
        )}

        <Button variant="ghost" size="sm" icon={Ban} block onClick={onAnular} className="text-danger hover:text-danger hover:bg-danger/10">
          Anular pedido
        </Button>
      </div>
    </>
  )
}
