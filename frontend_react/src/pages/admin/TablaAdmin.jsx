import { Pencil, Trash2, AlertTriangle, Inbox } from 'lucide-react'
import { Button, Card, EmptyState, Skeleton, cn } from '../../components/ui'

/**
 * Tabla genérica del panel. `columnas`: { key, label, render(fila), mobile?, align? }.
 * Cubre carga (skeleton), error con reintento y vacío.
 */
export default function TablaAdmin({
  columnas, filas, cargando, error, onReintentar, onEditar, onEliminar,
  etiqueta, singular, vacioTitulo,
}) {
  const oculta = (c) => (c.mobile ? '' : 'hidden sm:table-cell')

  if (cargando) {
    return (
      <Card className="p-4 flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
      </Card>
    )
  }
  if (error && filas.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle} tone="danger"
          title="No se pudieron cargar los datos"
          description="Revisa la conexión e inténtalo de nuevo."
          action={<Button variant="primary" onClick={onReintentar}>Reintentar</Button>}
        />
      </Card>
    )
  }
  if (filas.length === 0) {
    return (
      <Card>
        <EmptyState icon={Inbox} title={vacioTitulo ?? 'Sin registros'} description="Usa el botón Nuevo para agregar el primero." />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Listado de {singular}s</caption>
          <thead>
            <tr className="border-b border-line">
              {columnas.map(c => (
                <th key={c.key} scope="col"
                  className={cn('px-4 py-3 text-caption font-medium text-muted whitespace-nowrap', c.align === 'right' ? 'text-right' : 'text-left', oculta(c))}>
                  {c.label}
                </th>
              ))}
              <th scope="col" className="px-3 py-3 text-right text-caption font-medium text-muted">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filas.map(fila => (
              <tr key={fila.id} className="hover:bg-raised/40 transition-colors">
                {columnas.map(c => (
                  <td key={c.key} className={cn('px-4 py-2 text-ink', c.align === 'right' && 'text-right', oculta(c))}>
                    {c.render(fila)}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" iconOnly icon={Pencil} onClick={() => onEditar(fila)}
                      aria-label={`Editar ${singular} ${etiqueta(fila)}`} title="Editar" />
                    <Button variant="outlineDanger" iconOnly icon={Trash2} onClick={() => onEliminar(fila)}
                      aria-label={`Eliminar ${singular} ${etiqueta(fila)}`} title="Eliminar" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
