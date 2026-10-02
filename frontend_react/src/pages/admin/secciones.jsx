import { DoorOpen, Armchair, FolderTree, UtensilsCrossed, Users, Receipt } from 'lucide-react'
import { StatusBadge } from '../../components/ui'
import {
  crearMesa, actualizarMesa, eliminarMesa,
  crearCategoria, actualizarCategoria, eliminarCategoria,
  crearProducto, actualizarProducto, eliminarProducto,
  crearUsuario, actualizarUsuario, eliminarUsuario,
  crearSalon, actualizarSalon, eliminarSalon,
} from '../../api/admin'
import { soles } from './util'

export const TABS = [
  { id: 'salones',      label: 'Salones',      icon: DoorOpen },
  { id: 'mesas',        label: 'Mesas',        icon: Armchair },
  { id: 'categorias',   label: 'Categorías',   icon: FolderTree },
  { id: 'productos',    label: 'Productos',    icon: UtensilsCrossed },
  { id: 'usuarios',     label: 'Usuarios',     icon: Users },
  { id: 'comprobantes', label: 'Comprobantes', icon: Receipt },
]

const VACIO = <span className="text-faint">—</span>
const estadoActivo = (ok, si = 'Activo', no = 'Inactivo') => (
  <StatusBadge tone={ok ? 'success' : 'neutral'}>{ok ? si : no}</StatusBadge>
)

/**
 * Definición de cada sección CRUD. `payload` replica exactamente lo que se enviaba al API;
 * `etiqueta` nombra el registro en botones y confirmaciones.
 * `columnas` usa `mobile: true` para las columnas que se conservan en pantallas chicas.
 */
export const SECCIONES = {
  salones: {
    singular: 'salón', articulo: 'el salón',
    crear: crearSalon, actualizar: actualizarSalon, eliminar: eliminarSalon,
    etiqueta: (r) => r.nombre,
    payload: (f) => ({ nombre: f.nombre, descripcion: f.descripcion || '', activo: f.activo !== false }),
    columnas: () => [
      { key: 'nombre', label: 'Nombre', mobile: true, render: r => r.nombre },
      { key: 'descripcion', label: 'Descripción', render: r => r.descripcion || VACIO },
      { key: 'estado', label: 'Estado', mobile: true, render: r => estadoActivo(r.activo) },
    ],
  },
  mesas: {
    singular: 'mesa', articulo: 'la mesa',
    crear: crearMesa, actualizar: actualizarMesa, eliminar: eliminarMesa,
    etiqueta: (r) => r.numero,
    payload: (f) => ({ salon_id: Number(f.salon_id), numero: f.numero, capacidad: Number(f.capacidad) || 4 }),
    columnas: ({ datos }) => [
      { key: 'numero', label: 'Número', mobile: true, render: r => r.numero },
      { key: 'salon', label: 'Salón', render: r => datos.salones.find(s => s.id === r.salon_id)?.nombre || '—' },
      { key: 'capacidad', label: 'Capacidad', render: r => `${r.capacidad} personas` },
      { key: 'estado', label: 'Estado', mobile: true,
        render: r => <StatusBadge tone={r.estado === 'disponible' ? 'success' : 'warning'} className="capitalize">{r.estado}</StatusBadge> },
    ],
  },
  categorias: {
    singular: 'categoría', articulo: 'la categoría',
    crear: crearCategoria, actualizar: actualizarCategoria, eliminar: eliminarCategoria,
    etiqueta: (r) => r.nombre,
    payload: (f) => ({ nombre: f.nombre, activo: f.activo !== false }),
    columnas: () => [
      { key: 'nombre', label: 'Nombre', mobile: true, render: r => r.nombre },
      { key: 'estado', label: 'Estado', mobile: true, render: r => estadoActivo(r.activo, 'Activa', 'Inactiva') },
    ],
  },
  productos: {
    singular: 'producto', articulo: 'el producto',
    crear: crearProducto, actualizar: actualizarProducto, eliminar: eliminarProducto,
    etiqueta: (r) => r.nombre,
    payload: (f) => ({ nombre: f.nombre, precio: Number(f.precio), categoria_id: Number(f.categoria_id), disponible: f.disponible !== false }),
    columnas: ({ datos }) => [
      { key: 'nombre', label: 'Nombre', mobile: true, render: r => r.nombre },
      { key: 'precio', label: 'Precio', mobile: true, align: 'right', render: r => <span className="num">{soles(r.precio)}</span> },
      { key: 'categoria', label: 'Categoría', render: r => datos.categorias.find(c => c.id === r.categoria_id)?.nombre || '—' },
      { key: 'disponible', label: 'Disponible', render: r => estadoActivo(r.disponible, 'Sí', 'No') },
    ],
  },
  usuarios: {
    singular: 'usuario', articulo: 'el usuario',
    crear: crearUsuario, actualizar: actualizarUsuario, eliminar: eliminarUsuario,
    etiqueta: (r) => r.nombre,
    payload: (f) => ({ nombre: f.nombre, email: f.email, pin: f.pin || null, rol_id: Number(f.rol_id) }),
    columnas: () => [
      { key: 'nombre', label: 'Nombre', mobile: true, render: r => r.nombre },
      { key: 'email', label: 'Email', render: r => r.email || '—' },
      { key: 'rol', label: 'Rol', mobile: true, render: r => <span className="capitalize">{r.rol_nombre || '—'}</span> },
    ],
  },
}
