import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../store/useAuth'
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
  { id: 'mesas',          label: 'Mesas',          icon: '🪑' },
  { id: 'categorias',     label: 'Categorías',     icon: '📂' },
  { id: 'productos',      label: 'Productos',      icon: '🍽️' },
  { id: 'usuarios',       label: 'Usuarios',       icon: '👤' },
  { id: 'comprobantes',   label: 'Comprobantes',   icon: '🧾' },
]

const METODO_LABEL = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin' }

// ── Componente reutilizable de tabla ──────────────────────────────────────────
function TablaAdmin({ columnas, filas, onEditar, onEliminar }) {
  return (
    <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#3f3f46]">
            {columnas.map(c => (
              <th key={c} className={`px-4 py-3 text-left text-[#71717a] font-medium ${c === 'Email' ? 'hidden md:table-cell' : ''}`}>{c}</th>
            ))}
            <th className="px-4 py-3 text-right text-[#71717a] font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3f3f46]">
          {filas.length === 0 ? (
            <tr><td colSpan={columnas.length + 1} className="px-4 py-8 text-center text-[#52525b]">Sin registros</td></tr>
          ) : filas.map(fila => (
            <tr key={fila.id} className="hover:bg-[#3f3f46]/40 transition-colors">
              {fila.celdas.map((c, i) => (
                <td key={i} className={`px-4 py-3 text-white ${columnas[i] === 'Email' ? 'hidden md:table-cell' : ''}`}>{c}</td>
              ))}
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => onEditar(fila.raw)}
                    className="text-xs text-[#f59e0b] hover:text-white border border-[#f59e0b]/30 hover:border-[#f59e0b] px-2.5 py-1 rounded-lg transition-all">
                    Editar
                  </button>
                  <button onClick={() => onEliminar(fila.raw)}
                    className="text-xs text-[#ef4444] hover:text-white border border-[#ef4444]/30 hover:border-[#ef4444] px-2.5 py-1 rounded-lg transition-all">
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Modal genérico ────────────────────────────────────────────────────────────
function Modal({ titulo, onCerrar, onGuardar, guardando, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-white font-semibold text-lg">{titulo}</h3>
          <button onClick={onCerrar} className="text-[#71717a] hover:text-white transition-colors text-xl leading-none">×</button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-2 mt-6">
          <button onClick={onCerrar}
            className="flex-1 bg-[#3f3f46] text-[#a1a1aa] py-2.5 rounded-xl text-sm hover:bg-[#52525b] transition-colors">
            Cancelar
          </button>
          <button onClick={onGuardar} disabled={guardando}
            className="flex-1 bg-[#f59e0b] text-black py-2.5 rounded-xl text-sm font-semibold hover:bg-[#d97706] transition-colors disabled:opacity-50">
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
        className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors"
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
        className="w-full bg-[#3f3f46] border border-[#52525b] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#f59e0b] transition-colors"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Tabla de comprobantes con filas expandibles ───────────────────────────────
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#3f3f46]">
            <th className="px-4 py-3 text-left text-[#71717a] font-medium w-6" />
            <th className="px-4 py-3 text-left text-[#71717a] font-medium">N°</th>
            <th className="px-4 py-3 text-left text-[#71717a] font-medium">Tipo</th>
            <th className="px-4 py-3 text-left text-[#71717a] font-medium hidden md:table-cell">Fecha</th>
            <th className="px-4 py-3 text-left text-[#71717a] font-medium hidden sm:table-cell">Método</th>
            <th className="px-4 py-3 text-left text-[#71717a] font-medium hidden lg:table-cell">Cliente</th>
            <th className="px-4 py-3 text-right text-[#71717a] font-medium">Total</th>
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
                <td className="px-4 py-3 text-[#52525b] text-xs">
                  {expandido === c.id ? '▼' : '▶'}
                </td>
                <td className="px-4 py-3 text-[#f59e0b] font-medium">{c.numero}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                    c.tipo === 'factura'
                      ? 'bg-[#a78bfa]/10 text-[#a78bfa]'
                      : 'bg-[#22c55e]/10 text-[#22c55e]'
                  }`}>
                    {c.tipo === 'factura' ? 'Factura' : 'Boleta'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#a1a1aa] hidden md:table-cell">{c.created_at || '—'}</td>
                <td className="px-4 py-3 text-[#a1a1aa] hidden sm:table-cell capitalize">
                  {METODO_LABEL[c.metodo_pago] || c.metodo_pago || '—'}
                </td>
                <td className="px-4 py-3 text-[#71717a] text-xs hidden lg:table-cell">
                  {c.razon_social
                    ? <span>{c.razon_social} <span className="text-[#52525b]">· {c.nro_doc_cliente}</span></span>
                    : c.nro_doc_cliente
                    ? <span className="text-[#52525b]">{c.nro_doc_cliente}</span>
                    : <span className="text-[#3f3f46]">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-white font-semibold text-right">
                  S/ {Number(c.total).toFixed(2)}
                </td>
              </tr>

              {expandido === c.id && (
                <tr key={`${c.id}-detalle`}>
                  <td colSpan={7} className="bg-[#1f1f22] px-6 py-4 border-t border-[#3f3f46]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {/* Items */}
                      <div>
                        <p className="text-[#71717a] text-xs uppercase tracking-wider mb-2">Productos</p>
                        <div className="flex flex-col gap-1">
                          {c.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-[#a1a1aa]">
                                {Number(item.cantidad).toFixed(0)}× {item.descripcion}
                              </span>
                              <span className="text-white font-medium">S/ {Number(item.subtotal).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Totales y pago */}
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
                            <span className="text-[#a1a1aa]">{c.razon_social}</span>
                          </div>
                        )}
                        {c.direccion_cliente && (
                          <div className="flex justify-between">
                            <span className="text-[#71717a]">Dirección</span>
                            <span className="text-[#a1a1aa]">{c.direccion_cliente}</span>
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
  const [modal, setModal]   = useState(null)   // { tipo, datos }
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

  const abrirCrear = () => setModal({ tipo: 'crear', datos: null }) || setForm({})
  const abrirEditar = (raw) => { setModal({ tipo: 'editar', datos: raw }); setForm(raw) }

  const cerrarModal = () => { setModal(null); setForm({}) }

  const mensajeError = (e) => {
    const detail = e.response?.data?.detail
    if (!detail) return 'Error al guardar'
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map(d => d.msg).join(', ')
    return JSON.stringify(detail)
  }

  const guardar = async () => {
    setGuardando(true)
    try {
      if (tab === 'mesas') {
        const payload = { salon_id: Number(form.salon_id), numero: form.numero, capacidad: Number(form.capacidad) || 4 }
        modal.tipo === 'crear' ? await crearMesa(payload) : await actualizarMesa(modal.datos.id, payload)
      } else if (tab === 'categorias') {
        const payload = { nombre: form.nombre }
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
      alert(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (raw) => {
    if (!confirm(`¿Eliminar "${raw.nombre || raw.numero}"?`)) return
    try {
      if (tab === 'mesas')      await eliminarMesa(raw.id)
      if (tab === 'categorias') await eliminarCategoria(raw.id)
      if (tab === 'productos')  await eliminarProducto(raw.id)
      if (tab === 'usuarios')   await eliminarUsuario(raw.id)
      await cargar()
    } catch (e) {
      alert(mensajeError(e))
    }
  }

  // ── Configuración de tabla por tab ────────────────────────────────────────
  const config = {
    mesas: {
      columnas: ['Número', 'Salón', 'Capacidad', 'Estado'],
      filas: datos.mesas.map(m => ({
        id: m.id, raw: m,
        celdas: [m.numero, salones.find(s => s.id === m.salon_id)?.nombre || '—', `${m.capacidad} personas`,
          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${m.estado === 'disponible' ? 'bg-green-900/40 text-green-400' : 'bg-amber-900/40 text-amber-400'}`}>
            {m.estado}
          </span>
        ]
      }))
    },
    categorias: {
      columnas: ['Nombre'],
      filas: datos.categorias.map(c => ({ id: c.id, raw: c, celdas: [c.nombre] }))
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
          celdas: [
            u.nombre,
            <span className="hidden md:inline">{u.email || '—'}</span>,
            u.rol_nombre || '—'
          ]
        }))
    },
  }

  const tabActual = config[tab]

  // ── Formulario por tab ────────────────────────────────────────────────────
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
      <Input label="Nombre" value={form.nombre || ''} onChange={f('nombre')} placeholder="Ej: Entradas, Bebidas" />
    )
    if (tab === 'productos') return (
      <>
        <Input label="Nombre" value={form.nombre || ''} onChange={f('nombre')} placeholder="Nombre del producto" />
        <Input label="Precio (S/)" type="number" value={form.precio || ''} onChange={f('precio')} placeholder="0.00" step="0.10" min={0} />
        <Select label="Categoría" value={form.categoria_id || ''} onChange={f('categoria_id')}
          options={[{ value: '', label: 'Seleccionar...' }, ...datos.categorias.map(c => ({ value: c.id, label: c.nombre }))]}
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
      <header className="bg-[#27272a] px-6 py-4 flex justify-between items-center border-b border-[#3f3f46] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center text-sm">
            ⚙️
          </div>
          <span className="text-white font-bold text-lg">Administración</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#71717a] text-sm hidden sm:block">{usuario?.nombre}</span>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[#a1a1aa] hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#3f3f46] transition-colors hidden sm:block"
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => { cerrarSesion(); navigate('/login') }}
            className="text-[#71717a] hover:text-[#f59e0b] text-sm transition-colors px-2 py-1 rounded-lg hover:bg-[#f59e0b]/10"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#27272a] border-b border-[#3f3f46] px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setBusqueda(''); setBusquedaComp(''); setFiltroRol('todos') }}
            className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all
              ${tab === t.id
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-transparent text-[#71717a] hover:text-white'
              }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <main className={`flex-1 flex ${tab === 'usuarios' ? 'overflow-hidden' : ''}`}>

        {/* Sidebar filtro roles — solo en usuarios, oculto en móvil */}
        {tab === 'usuarios' && (
          <aside className="hidden md:flex w-48 shrink-0 bg-[#1f1f22] border-r border-[#3f3f46] p-4 flex-col gap-1">
            <p className="text-[#71717a] text-xs uppercase tracking-wider mb-3">Filtrar por rol</p>
            <button
              onClick={() => setFiltroRol('todos')}
              className={`text-left px-3 py-2 rounded-xl text-sm transition-all font-medium
                ${filtroRol === 'todos'
                  ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46]'
                }`}
            >
              👥 Todos
              <span className="ml-1 text-xs text-[#71717a]">({datos.usuarios.length})</span>
            </button>
            {roles.map(r => {
              const count = datos.usuarios.filter(u => u.rol_nombre === r.nombre).length
              return (
                <button
                  key={r.id}
                  onClick={() => setFiltroRol(r.nombre)}
                  className={`text-left px-3 py-2 rounded-xl text-sm transition-all font-medium capitalize
                    ${filtroRol === r.nombre
                      ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46]'
                    }`}
                >
                  {r.nombre}
                  <span className="ml-1 text-xs text-[#71717a]">({count})</span>
                </button>
              )
            })}
          </aside>
        )}


        {/* Área principal */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-white capitalize">
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
                  : tabActual.filas.length} registro(s)
              </p>
            </div>

            <div className="flex gap-2 items-center">
              {tab === 'productos' && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm">🔍</span>
                  <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar producto..."
                    className="bg-[#27272a] border border-[#3f3f46] rounded-xl pl-8 pr-4 py-2 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors w-48"
                  />
                </div>
              )}
              {tab === 'comprobantes' && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a] text-sm">🔍</span>
                  <input
                    value={busquedaComp}
                    onChange={e => setBusquedaComp(e.target.value)}
                    placeholder="N° boleta, DNI o RUC..."
                    className="bg-[#27272a] border border-[#3f3f46] rounded-xl pl-8 pr-4 py-2 text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-[#f59e0b] transition-colors w-56"
                  />
                </div>
              )}
              {tab !== 'comprobantes' && (
                <button
                  onClick={abrirCrear}
                  className="bg-[#f59e0b] text-black px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#d97706] transition-colors whitespace-nowrap"
                >
                  + Nuevo
                </button>
              )}
            </div>
          </div>

          {/* Chips de rol en móvil */}
          {tab === 'usuarios' && (
            <div className="md:hidden flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
              {[{ nombre: 'todos', label: '👥 Todos' }, ...roles.map(r => ({ nombre: r.nombre, label: r.nombre }))].map(r => (
                <button
                  key={r.nombre}
                  onClick={() => setFiltroRol(r.nombre)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap font-medium transition-all shrink-0 capitalize
                    ${filtroRol === r.nombre
                      ? 'bg-[#f59e0b] text-black'
                      : 'bg-[#3f3f46] text-[#a1a1aa] hover:text-white'
                    }`}
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
                return (
                  (c.numero || '').toLowerCase().includes(q) ||
                  (c.nro_doc_cliente || '').toLowerCase().includes(q)
                )
              })}
              expandido={expandido}
              setExpandido={setExpandido}
            />
          ) : (
            <TablaAdmin
              columnas={tabActual.columnas}
              filas={tabActual.filas}
              onEditar={abrirEditar}
              onEliminar={eliminar}
            />
          )}
        </div>
      </main>

      {/* Modal */}
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
    </div>
  )
}
