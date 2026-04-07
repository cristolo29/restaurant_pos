import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../store/useAuth'
import ModalConfirm from '../components/ModalConfirm'
import {
  getMesas, crearMesa, actualizarMesa, eliminarMesa,
  getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria,
  getProductos, crearProducto, actualizarProducto, eliminarProducto,
  getUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario,
  getRoles,
  getSalones,
  getComprobantes,
} from '../api/admin'

const TABS = [
  { id: 'mesas',        label: 'Mesas',        icon: '🪑' },
  { id: 'categorias',   label: 'Categorías',   icon: '📂' },
  { id: 'productos',    label: 'Productos',    icon: '🍽️' },
  { id: 'usuarios',     label: 'Usuarios',     icon: '👤' },
  { id: 'comprobantes', label: 'Comprobantes', icon: '🧾' },
]

const METODO_LABEL = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin' }

// ── Tabla reutilizable con soporte de columnas ocultas en móvil ───────────────
function TablaAdmin({ columnas, filas, onEditar, onEliminar, colsMobile = [] }) {
  const ocultar = (col) => colsMobile.length > 0 && !colsMobile.includes(col)
  return (
    <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#3f3f46]">
              {columnas.map(c => (
                <th key={c} className={`px-4 py-3 text-left text-[#71717a] font-medium whitespace-nowrap ${ocultar(c) ? 'hidden sm:table-cell' : ''}`}>{c}</th>
              ))}
              <th className="px-3 py-3 text-right text-[#71717a] font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3f3f46]">
            {filas.length === 0 ? (
              <tr><td colSpan={columnas.length + 1} className="px-4 py-8 text-center text-[#52525b]">Sin registros</td></tr>
            ) : filas.map(fila => (
              <tr key={fila.id} className="hover:bg-[#3f3f46]/40 transition-colors">
                {fila.celdas.map((c, i) => (
                  <td key={i} className={`px-4 py-3 text-white ${ocultar(columnas[i]) ? 'hidden sm:table-cell' : ''}`}>{c}</td>
                ))}
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => onEditar(fila.raw)}
                      className="text-[#f59e0b] hover:text-white border border-[#f59e0b]/30 hover:border-[#f59e0b] px-2 py-1 rounded-lg transition-all text-xs font-medium">
                      <span className="hidden sm:inline">Editar</span>
                      <span className="sm:hidden">✏️</span>
                    </button>
                    <button onClick={() => onEliminar(fila.raw)}
                      className="text-[#ef4444] hover:text-white border border-[#ef4444]/30 hover:border-[#ef4444] px-2 py-1 rounded-lg transition-all text-xs font-medium">
                      <span className="hidden sm:inline">Eliminar</span>
                      <span className="sm:hidden">🗑️</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Modal genérico ────────────────────────────────────────────────────────────
function Modal({ titulo, onCerrar, onGuardar, guardando, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 px-0 sm:px-4">
      <div className="bg-[#27272a] border border-[#3f3f46] rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white font-semibold text-lg leading-tight pr-4">{titulo}</h3>
          <button onClick={onCerrar} className="text-[#71717a] hover:text-white transition-colors text-2xl leading-none shrink-0">×</button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-2 mt-6">
          <button onClick={onCerrar}
            className="flex-1 bg-[#3f3f46] text-[#a1a1aa] py-3 rounded-xl text-sm hover:bg-[#52525b] transition-colors">
            Cancelar
          </button>
          <button onClick={onGuardar} disabled={guardando}
            className="flex-1 bg-[#f59e0b] text-black py-3 rounded-xl text-sm font-semibold hover:bg-[#d97706] transition-colors disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="text-[#a1a1aa] text-xs mb-1 block">{label}</label>}
      <input
        {...props}
        className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-3 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
      />
    </div>
  )
}

function Select({ label, options, ...props }) {
  return (
    <div>
      {label && <label className="text-[#a1a1aa] text-xs mb-1 block">{label}</label>}
      <select
        {...props}
        className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#f59e0b] transition-colors"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Tabla comprobantes ────────────────────────────────────────────────────────
function TablaComprobantes({ comprobantes, expandido, setExpandido }) {
  if (comprobantes.length === 0) {
    return (
      <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl px-4 py-10 text-center text-[#52525b] text-sm">
        Sin comprobantes emitidos aún
      </div>
    )
  }
  return (
    <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#3f3f46]">
              <th className="px-3 py-3 text-left text-[#71717a] font-medium w-6" />
              <th className="px-3 py-3 text-left text-[#71717a] font-medium">N°</th>
              <th className="px-3 py-3 text-left text-[#71717a] font-medium">Tipo</th>
              <th className="px-3 py-3 text-left text-[#71717a] font-medium hidden md:table-cell">Fecha</th>
              <th className="px-3 py-3 text-left text-[#71717a] font-medium hidden sm:table-cell">Método</th>
              <th className="px-3 py-3 text-left text-[#71717a] font-medium hidden lg:table-cell">Cliente</th>
              <th className="px-3 py-3 text-right text-[#71717a] font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3f3f46]">
            {comprobantes.map(c => (
              <>
                <tr
                  key={c.id}
                  onClick={() => setExpandido(expandido === c.id ? null : c.id)}
                  className="hover:bg-[#3f3f46]/40 transition-colors cursor-pointer"
                >
                  <td className="px-3 py-3 text-[#52525b] text-xs">{expandido === c.id ? '▼' : '▶'}</td>
                  <td className="px-3 py-3 text-[#f59e0b] font-medium whitespace-nowrap">{c.numero}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                      c.tipo === 'factura' ? 'bg-[#a78bfa]/10 text-[#a78bfa]' : 'bg-[#22c55e]/10 text-[#22c55e]'
                    }`}>
                      {c.tipo === 'factura' ? 'Factura' : 'Boleta'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#a1a1aa] hidden md:table-cell whitespace-nowrap">{c.created_at || '—'}</td>
                  <td className="px-3 py-3 text-[#a1a1aa] hidden sm:table-cell capitalize">
                    {METODO_LABEL[c.metodo_pago] || c.metodo_pago || '—'}
                  </td>
                  <td className="px-3 py-3 text-[#71717a] text-xs hidden lg:table-cell">
                    {c.razon_social
                      ? <span>{c.razon_social} <span className="text-[#52525b]">· {c.nro_doc_cliente}</span></span>
                      : c.nro_doc_cliente
                      ? <span className="text-[#52525b]">{c.nro_doc_cliente}</span>
                      : <span className="text-[#3f3f46]">—</span>
                    }
                  </td>
                  <td className="px-3 py-3 text-white font-semibold text-right whitespace-nowrap">
                    S/ {Number(c.total).toFixed(2)}
                  </td>
                </tr>

                {expandido === c.id && (
                  <tr key={`${c.id}-detalle`}>
                    <td colSpan={7} className="bg-[#1f1f22] px-4 py-4 border-t border-[#3f3f46]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[#71717a] text-xs uppercase tracking-wider mb-2">Productos</p>
                          <div className="flex flex-col gap-1">
                            {c.items.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-[#a1a1aa]">{Number(item.cantidad).toFixed(0)}× {item.descripcion}</span>
                                <span className="text-white font-medium ml-4">S/ {Number(item.subtotal).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 text-xs">
                          <p className="text-[#71717a] uppercase tracking-wider mb-1">Resumen de pago</p>
                          <div className="flex justify-between">
                            <span className="text-[#71717a]">Subtotal (sin IGV)</span>
                            <span className="text-[#a1a1aa]">S/ {Number(c.subtotal).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#71717a]">IGV 18%</span>
                            <span className="text-[#a1a1aa]">S/ {Number(c.igv).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-[#3f3f46] pt-1.5 mt-0.5">
                            <span className="text-white font-semibold">Total</span>
                            <span className="text-[#f59e0b] font-bold">S/ {Number(c.total).toFixed(2)}</span>
                          </div>
                          {c.metodo_pago === 'efectivo' && Number(c.monto_pagado) > 0 && (
                            <>
                              <div className="flex justify-between mt-1">
                                <span className="text-[#71717a]">Efectivo recibido</span>
                                <span className="text-[#a1a1aa]">S/ {Number(c.monto_pagado).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#71717a]">Vuelto</span>
                                <span className="text-[#22c55e] font-medium">S/ {Number(c.vuelto).toFixed(2)}</span>
                              </div>
                            </>
                          )}
                          {c.nro_doc_cliente && (
                            <div className="flex justify-between mt-1 border-t border-[#3f3f46] pt-1.5">
                              <span className="text-[#71717a]">{c.tipo === 'factura' ? 'RUC' : 'DNI'}</span>
                              <span className="text-[#a1a1aa]">{c.nro_doc_cliente}</span>
                            </div>
                          )}
                          {c.razon_social && (
                            <div className="flex justify-between">
                              <span className="text-[#71717a]">{c.tipo === 'factura' ? 'Razón social' : 'Nombre'}</span>
                              <span className="text-[#a1a1aa] text-right ml-4 truncate">{c.razon_social}</span>
                            </div>
                          )}
                          {c.direccion_cliente && (
                            <div className="flex justify-between">
                              <span className="text-[#71717a] shrink-0">Dirección</span>
                              <span className="text-[#a1a1aa] text-right ml-4 truncate">{c.direccion_cliente}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Admin() {
  const [tab, setTab]       = useState('mesas')
  const [datos, setDatos]   = useState({ mesas: [], categorias: [], productos: [], usuarios: [] })
  const [comprobantes, setComprobantes] = useState([])
  const [expandido, setExpandido] = useState(null)
  const [roles, setRoles]     = useState([])
  const [salones, setSalones] = useState([])
  const [modal, setModal]   = useState(null)
  const [modalConfirm, setModalConfirm] = useState(null)
  const [form, setForm]     = useState({})
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaComp, setBusquedaComp] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')

  const usuario    = useAuth(s => s.usuario)
  const cerrarSesion = useAuth(s => s.cerrarSesion)
  const navigate   = useNavigate()

  const cargar = async () => {
    const [mesas, categorias, productos, usuarios, roles, salones, comps] = await Promise.all([
      getMesas().catch(() => []),
      getCategorias().catch(() => []),
      getProductos().catch(() => []),
      getUsuarios().catch(() => []),
      getRoles().catch(() => []),
      getSalones().catch(() => []),
      getComprobantes().catch(() => []),
    ])
    setDatos({ mesas, categorias, productos, usuarios })
    setRoles(roles)
    setSalones(salones)
    setComprobantes(comps)
  }

  useEffect(() => { cargar() }, [])

  const f = (campo) => (e) => setForm(p => ({ ...p, [campo]: e.target.value }))

  const abrirCrear  = () => { setModal({ tipo: 'crear', datos: null }); setForm({}) }
  const abrirEditar = (raw) => { setModal({ tipo: 'editar', datos: raw }); setForm(raw) }
  const cerrarModal = () => { setModal(null); setForm({}) }

  const mensajeError = (e) => {
    const detail = e.response?.data?.detail
    if (!detail) return 'Error al guardar'
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map(d => d.msg).join(', ')
    return JSON.stringify(detail)
  }

  const mostrarError = (e) => setModalConfirm({
    titulo: 'Error',
    mensaje: mensajeError(e),
    labelConfirm: 'Entendido',
    colorConfirm: 'danger',
    onConfirm: () => {},
  })

  const guardar = async () => {
    setGuardando(true)
    try {
      if (tab === 'mesas') {
        const payload = { salon_id: Number(form.salon_id), numero: form.numero, capacidad: Number(form.capacidad) || 4 }
        modal.tipo === 'crear' ? await crearMesa(payload) : await actualizarMesa(modal.datos.id, payload)
      } else if (tab === 'categorias') {
        const payload = { nombre: form.nombre, activo: form.activo !== false }
        modal.tipo === 'crear' ? await crearCategoria(payload) : await actualizarCategoria(modal.datos.id, payload)
      } else if (tab === 'productos') {
        const payload = { nombre: form.nombre, precio: Number(form.precio), categoria_id: Number(form.categoria_id), disponible: form.disponible !== false }
        modal.tipo === 'crear' ? await crearProducto(payload) : await actualizarProducto(modal.datos.id, payload)
      } else if (tab === 'usuarios') {
        const payload = { nombre: form.nombre, email: form.email, pin: form.pin || null, rol_id: Number(form.rol_id) }
        modal.tipo === 'crear' ? await crearUsuario(payload) : await actualizarUsuario(modal.datos.id, payload)
      }
      await cargar()
      cerrarModal()
    } catch (e) {
      mostrarError(e)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = (raw) => {
    setModalConfirm({
      titulo: '¿Eliminar registro?',
      mensaje: `"${raw.nombre || raw.numero}" será eliminado permanentemente.`,
      labelConfirm: 'Eliminar',
      colorConfirm: 'danger',
      onConfirm: async () => {
        try {
          if (tab === 'mesas')      await eliminarMesa(raw.id)
          if (tab === 'categorias') await eliminarCategoria(raw.id)
          if (tab === 'productos')  await eliminarProducto(raw.id)
          if (tab === 'usuarios')   await eliminarUsuario(raw.id)
          await cargar()
        } catch (e) {
          mostrarError(e)
        }
      },
    })
  }

  // Columnas visibles en móvil por tab
  const colsMobile = {
    mesas:      ['Número', 'Estado'],
    categorias: ['Nombre', 'Estado'],
    productos:  ['Nombre', 'Precio'],
    usuarios:   ['Nombre', 'Rol'],
  }

  const config = {
    mesas: {
      columnas: ['Número', 'Salón', 'Capacidad', 'Estado'],
      filas: datos.mesas.map(m => ({
        id: m.id, raw: m,
        celdas: [
          m.numero,
          salones.find(s => s.id === m.salon_id)?.nombre || '—',
          `${m.capacidad} p.`,
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${m.estado === 'disponible' ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
            {m.estado}
          </span>
        ]
      }))
    },
    categorias: {
      columnas: ['Nombre', 'Estado'],
      filas: datos.categorias.map(c => ({
        id: c.id, raw: c,
        celdas: [
          c.nombre,
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${c.activo ? 'bg-green-900/40 text-green-400' : 'bg-[#3f3f46] text-[#71717a]'}`}>
            {c.activo ? 'Activa' : 'Inactiva'}
          </span>
        ]
      }))
    },
    productos: {
      columnas: ['Nombre', 'Precio', 'Categoría', 'Disponible'],
      filas: datos.productos
        .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        .map(p => ({
          id: p.id, raw: p,
          celdas: [
            p.nombre,
            `S/ ${Number(p.precio).toFixed(2)}`,
            datos.categorias.find(c => c.id === p.categoria_id)?.nombre || '—',
            <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${p.disponible ? 'bg-green-900/40 text-green-400' : 'bg-[#3f3f46] text-[#71717a]'}`}>
              {p.disponible ? 'Sí' : 'No'}
            </span>
          ]
        }))
    },
    usuarios: {
      columnas: ['Nombre', 'Email', 'Rol'],
      filas: datos.usuarios
        .filter(u => filtroRol === 'todos' || u.rol_nombre === filtroRol)
        .map(u => ({
          id: u.id, raw: u,
          celdas: [u.nombre, u.email || '—', u.rol_nombre || '—']
        }))
    },
  }

  const tabActual = config[tab]

  const renderForm = () => {
    if (tab === 'mesas') return (
      <>
        <Select label="Salón" value={form.salon_id || ''} onChange={f('salon_id')}
          options={[{ value: '', label: 'Seleccionar...' }, ...salones.map(s => ({ value: s.id, label: s.nombre }))]}
        />
        <Input label="Número de mesa" value={form.numero || ''} onChange={f('numero')} placeholder="Ej: 01, A1, Terraza" />
        <Input label="Capacidad" type="number" value={form.capacidad || ''} onChange={f('capacidad')} placeholder="4" min={1} />
      </>
    )
    if (tab === 'categorias') return (
      <>
        <Input label="Nombre" value={form.nombre || ''} onChange={f('nombre')} placeholder="Ej: Entradas, Bebidas" />
        <Select label="Estado" value={form.activo !== false ? 'true' : 'false'}
          onChange={e => setForm(p => ({ ...p, activo: e.target.value === 'true' }))}
          options={[{ value: 'true', label: 'Activa (visible en comanda)' }, { value: 'false', label: 'Inactiva (oculta en comanda)' }]}
        />
      </>
    )
    if (tab === 'productos') return (
      <>
        <Input label="Nombre" value={form.nombre || ''} onChange={f('nombre')} placeholder="Nombre del producto" />
        <Input label="Precio (S/)" type="number" value={form.precio || ''} onChange={f('precio')} placeholder="0.00" step="0.10" min={0} />
        <Select label="Categoría" value={form.categoria_id || ''} onChange={f('categoria_id')}
          options={[{ value: '', label: 'Seleccionar...' }, ...datos.categorias.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre }))]}
        />
        <Select label="Disponible" value={form.disponible !== false ? 'true' : 'false'}
          onChange={e => setForm(p => ({ ...p, disponible: e.target.value === 'true' }))}
          options={[{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }]}
        />
      </>
    )
    if (tab === 'usuarios') return (
      <>
        <Input label="Nombre" value={form.nombre || ''} onChange={f('nombre')} placeholder="Nombre completo" />
        <Input label="Email" type="email" value={form.email || ''} onChange={f('email')} placeholder="correo@ejemplo.com" />
        <Input label="PIN" type="password" value={form.pin || ''} onChange={f('pin')} placeholder="4-6 dígitos" maxLength={6} />
        <Select label="Rol" value={form.rol_id || ''} onChange={f('rol_id')}
          options={[{ value: '', label: 'Seleccionar...' }, ...roles.map(r => ({ value: r.id, label: r.nombre }))]}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      {/* Header */}
      <header className="bg-[#27272a] px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[#3f3f46] sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center text-sm shrink-0">
            ⚙️
          </div>
          <span className="text-white font-bold text-base sm:text-lg truncate">Administración</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[#71717a] text-sm hidden lg:block truncate max-w-32">{usuario?.nombre}</span>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[#a1a1aa] hover:text-white text-sm px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[#3f3f46] transition-colors hidden sm:block"
          >
            📊 <span className="hidden md:inline">Dashboard</span>
          </button>
          <button
            onClick={() => { cerrarSesion(); navigate('/login') }}
            className="text-[#71717a] hover:text-[#f59e0b] text-sm transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f59e0b]/10"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#27272a] border-b border-[#3f3f46] px-2 sm:px-6 flex gap-0 sm:gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setBusqueda(''); setBusquedaComp(''); setFiltroRol('todos') }}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-3.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-all
              ${tab === t.id
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#71717a] hover:text-white'
              }`}
          >
            <span>{t.icon}</span>
            <span className="hidden xs:inline sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido */}
      <main className={`flex-1 flex ${tab === 'usuarios' ? 'overflow-hidden' : ''}`}>

        {/* Sidebar filtro roles — solo desktop */}
        {tab === 'usuarios' && (
          <aside className="hidden md:flex w-48 shrink-0 bg-[#1f1f22] border-r border-[#3f3f46] p-4 flex-col gap-1">
            <p className="text-[#71717a] text-xs uppercase tracking-wider mb-3">Filtrar por rol</p>
            <button
              onClick={() => setFiltroRol('todos')}
              className={`text-left px-3 py-2 rounded-xl text-sm transition-all font-medium
                ${filtroRol === 'todos' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30' : 'text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46]'}`}
            >
              👥 Todos
              <span className="ml-1 text-xs text-[#71717a]">({datos.usuarios.length})</span>
            </button>
            {roles.map(r => {
              const count = datos.usuarios.filter(u => u.rol_nombre === r.nombre).length
              return (
                <button key={r.id} onClick={() => setFiltroRol(r.nombre)}
                  className={`text-left px-3 py-2 rounded-xl text-sm transition-all font-medium capitalize
                    ${filtroRol === r.nombre ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30' : 'text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46]'}`}
                >
                  {r.nombre}
                  <span className="ml-1 text-xs text-[#71717a]">({count})</span>
                </button>
              )
            })}
          </aside>
        )}

        {/* Área principal */}
        <div className="flex-1 p-4 sm:p-6 overflow-auto">

          {/* Encabezado del área */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white capitalize">
                {TABS.find(t => t.id === tab)?.label}
                {tab === 'usuarios' && filtroRol !== 'todos' && (
                  <span className="ml-2 text-sm text-[#f59e0b] font-normal capitalize">· {filtroRol}</span>
                )}
              </h2>
              <p className="text-[#71717a] text-sm mt-0.5">
                {tab === 'comprobantes'
                  ? comprobantes.filter(c => {
                      const q = busquedaComp.toLowerCase().trim()
                      if (!q) return true
                      return (c.numero || '').toLowerCase().includes(q) || (c.nro_doc_cliente || '').toLowerCase().includes(q)
                    }).length
                  : tabActual?.filas.length} registro(s)
              </p>
            </div>

            <div className="flex gap-2 items-center w-full sm:w-auto">
              {tab === 'productos' && (
                <div className="relative flex-1 sm:flex-none">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm">🔍</span>
                  <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full sm:w-48 bg-[#27272a] border border-[#3f3f46] rounded-xl pl-8 pr-4 py-2 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
              )}
              {tab === 'comprobantes' && (
                <div className="relative flex-1 sm:flex-none">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm">🔍</span>
                  <input
                    value={busquedaComp}
                    onChange={e => setBusquedaComp(e.target.value)}
                    placeholder="N° o DNI/RUC..."
                    className="w-full sm:w-52 bg-[#27272a] border border-[#3f3f46] rounded-xl pl-8 pr-4 py-2 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
                  />
                </div>
              )}
              {tab !== 'comprobantes' && (
                <button
                  onClick={abrirCrear}
                  className="bg-[#f59e0b] text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#d97706] transition-colors whitespace-nowrap shrink-0"
                >
                  + Nuevo
                </button>
              )}
            </div>
          </div>

          {/* Chips de rol en móvil */}
          {tab === 'usuarios' && (
            <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-3">
              {[{ nombre: 'todos', label: '👥 Todos' }, ...roles.map(r => ({ nombre: r.nombre, label: r.nombre }))].map(r => (
                <button
                  key={r.nombre}
                  onClick={() => setFiltroRol(r.nombre)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap font-medium transition-all shrink-0 capitalize
                    ${filtroRol === r.nombre ? 'bg-[#f59e0b] text-black' : 'bg-[#3f3f46] text-[#a1a1aa] hover:text-white'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {tab === 'comprobantes' ? (
            <TablaComprobantes
              comprobantes={comprobantes.filter(c => {
                const q = busquedaComp.toLowerCase().trim()
                if (!q) return true
                return (c.numero || '').toLowerCase().includes(q) || (c.nro_doc_cliente || '').toLowerCase().includes(q)
              })}
              expandido={expandido}
              setExpandido={setExpandido}
            />
          ) : tabActual && (
            <TablaAdmin
              columnas={tabActual.columnas}
              filas={tabActual.filas}
              onEditar={abrirEditar}
              onEliminar={eliminar}
              colsMobile={colsMobile[tab] || []}
            />
          )}
        </div>
      </main>

      {/* Modal edición — desliza desde abajo en móvil */}
      {modal && (
        <Modal
          titulo={`${modal.tipo === 'crear' ? 'Nuevo' : 'Editar'} — ${TABS.find(t => t.id === tab)?.label}`}
          onCerrar={cerrarModal}
          onGuardar={guardar}
          guardando={guardando}
        >
          {renderForm()}
        </Modal>
      )}

      {/* Modal confirmación */}
      {modalConfirm && (
        <ModalConfirm
          {...modalConfirm}
          onCancel={() => setModalConfirm(null)}
        />
      )}
    </div>
  )
}
