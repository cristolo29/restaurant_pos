import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Chip, Input } from '../../components/ui'
import TablaAdmin from './TablaAdmin'
import { SECCIONES, TABS } from './secciones'

/** Sección de catálogo: cabecera con búsqueda/alta, filtro por rol (usuarios) y tabla. */
export default function SeccionCrud({ id, datos, cargando, error, onReintentar, onNuevo, onEditar, onEliminar }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const def = SECCIONES[id]
  const titulo = TABS.find(t => t.id === id)?.label

  let filas = datos[id]
  if (id === 'productos') filas = filas.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  if (id === 'usuarios') filas = filas.filter(u => filtroRol === 'todos' || u.rol_nombre === filtroRol)

  return (
    <section aria-labelledby={`titulo-${id}`}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h2 id={`titulo-${id}`} className="text-lg font-bold text-ink">
            {titulo}
            {id === 'usuarios' && filtroRol !== 'todos' && (
              <span className="ml-2 text-sm text-accent font-normal capitalize">· {filtroRol}</span>
            )}
          </h2>
          <p className="text-muted text-sm" aria-live="polite">{filas.length} registro(s)</p>
        </div>
        <div className="flex gap-3 items-end">
          {id === 'productos' && (
            <Input aria-label="Buscar producto" type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto..." className="flex-1 sm:w-56" />
          )}
          <Button variant="primary" icon={Plus} onClick={onNuevo} className="shrink-0">
            Nuevo {def.singular}
          </Button>
        </div>
      </div>

      {id === 'usuarios' && (
        <div role="group" aria-label="Filtrar por rol" className="flex gap-2 overflow-x-auto pb-3 mb-1">
          <Chip activo={filtroRol === 'todos'} count={datos.usuarios.length} onClick={() => setFiltroRol('todos')}>Todos</Chip>
          {datos.roles.map(r => (
            <Chip key={r.id} activo={filtroRol === r.nombre} className="capitalize"
              count={datos.usuarios.filter(u => u.rol_nombre === r.nombre).length}
              onClick={() => setFiltroRol(r.nombre)}>
              {r.nombre}
            </Chip>
          ))}
        </div>
      )}

      <TablaAdmin
        columnas={def.columnas({ datos })}
        filas={filas}
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        onEditar={onEditar}
        onEliminar={onEliminar}
        etiqueta={def.etiqueta}
        singular={def.singular}
        vacioTitulo={busqueda ? 'Sin resultados para la búsqueda' : `Aún no hay ${def.singular}s`}
      />
    </section>
  )
}
