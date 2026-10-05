import { PackageSearch, Search, StickyNote, X } from 'lucide-react'
import { Chip, EmptyState, Skeleton, cn } from '../../components/ui'

/** Panel izquierdo: búsqueda, categorías y rejilla de productos táctiles. */
export default function CartaProductos({
  cargando, categorias, categoriaActiva, onCategoria,
  busqueda, onBusqueda, productos, cantidadEnCarrito, onAgregar, onNota,
}) {
  const buscando = busqueda.trim().length > 0

  return (
    <>
      <div className="px-3 sm:px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-5 text-faint pointer-events-none" aria-hidden="true" />
          <label htmlFor="buscar-producto" className="sr-only">Buscar producto</label>
          <input
            id="buscar-producto"
            type="search"
            value={busqueda}
            onChange={e => onBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full min-h-12 bg-raised border border-line-strong rounded-control pl-11 pr-11 text-ink text-base placeholder:text-faint focus:outline-none focus:border-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {buscando && (
            <button
              onClick={() => onBusqueda('')}
              aria-label="Borrar búsqueda"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-10 grid place-items-center text-muted hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {!buscando && (
        <div className="flex gap-2 px-3 sm:px-4 py-2 border-b border-line overflow-x-auto shrink-0" role="group" aria-label="Categorías">
          {cargando
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 w-24 rounded-full shrink-0" />)
            : categorias.map(cat => (
                <Chip key={cat.id} activo={categoriaActiva === cat.id} onClick={() => onCategoria(cat.id)}>
                  {cat.nombre}
                </Chip>
              ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 sm:gap-3 content-start">
        {cargando && Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}

        {!cargando && productos.length === 0 && (
          <EmptyState
            className="col-span-full"
            icon={PackageSearch}
            title={buscando ? `Sin resultados para "${busqueda}"` : 'Sin productos en esta categoría'}
            description={buscando ? 'Revisa la ortografía o prueba otra palabra.' : 'Elige otra categoría.'}
          />
        )}

        {productos.map(prod => {
          const enCarrito = cantidadEnCarrito(prod.id)
          return (
            <div
              key={prod.id}
              className={cn(
                'relative flex bg-surface border rounded-control overflow-hidden transition-colors',
                enCarrito > 0 ? 'border-accent/60' : 'border-line hover:border-line-strong',
              )}
            >
              <button
                onClick={() => onAgregar(prod)}
                aria-label={`Agregar ${prod.nombre}, S/ ${Number(prod.precio).toFixed(2)}${enCarrito ? `, ${enCarrito} en el pedido` : ''}`}
                className="flex-1 min-w-0 min-h-28 p-3 text-left flex flex-col justify-between gap-2 hover:bg-raised/60 active:bg-raised transition-colors"
              >
                <span className="text-ink font-medium text-base leading-snug line-clamp-2 pr-8">{prod.nombre}</span>
                <span className="num text-accent font-bold text-lg">S/ {Number(prod.precio).toFixed(2)}</span>
              </button>

              <button
                onClick={() => onNota(prod)}
                aria-label={`Agregar ${prod.nombre} con nota`}
                className="absolute top-0 right-0 size-11 grid place-items-center text-faint hover:text-accent transition-colors"
              >
                <StickyNote className="size-5" aria-hidden="true" />
              </button>

              {enCarrito > 0 && (
                <span aria-hidden="true" className="num absolute bottom-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-accent text-on-accent text-sm font-bold grid place-items-center">
                  {enCarrito}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
