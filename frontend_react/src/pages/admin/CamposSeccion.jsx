import { Input, Select } from '../../components/ui'

const opcionesBool = (si, no) => [{ value: 'true', label: si }, { value: 'false', label: no }]
const SELECCIONAR = { value: '', label: 'Seleccionar...' }

/** Campos del formulario según la sección. Las claves coinciden con las del payload (para errores por campo). */
export default function CamposSeccion({ seccion, form, setForm, errores, datos }) {
  const f = (campo) => (e) => setForm(p => ({ ...p, [campo]: e.target.value }))
  const bool = (campo) => (e) => setForm(p => ({ ...p, [campo]: e.target.value === 'true' }))
  const valBool = (campo) => (form[campo] !== false ? 'true' : 'false')

  if (seccion === 'salones') return (
    <>
      <Input label="Nombre del área" data-autofocus value={form.nombre || ''} onChange={f('nombre')} error={errores.nombre} placeholder="Ej: Terraza, Salón VIP, Barra" />
      <Input label="Descripción (opcional)" value={form.descripcion || ''} onChange={f('descripcion')} error={errores.descripcion} placeholder="Ej: Área al aire libre" />
      <Select label="Estado" value={valBool('activo')} onChange={bool('activo')} error={errores.activo}
        options={opcionesBool('Activo (visible al asignar mesas)', 'Inactivo')} />
    </>
  )
  if (seccion === 'mesas') return (
    <>
      <Select label="Salón" data-autofocus value={form.salon_id || ''} onChange={f('salon_id')} error={errores.salon_id}
        options={[SELECCIONAR, ...datos.salones.map(s => ({ value: s.id, label: s.nombre }))]} />
      <Input label="Número de mesa" value={form.numero || ''} onChange={f('numero')} error={errores.numero} placeholder="Ej: 01, A1, Terraza" />
      <Input label="Capacidad (personas)" type="number" inputMode="numeric" value={form.capacidad || ''} onChange={f('capacidad')} error={errores.capacidad} placeholder="4" min={1} />
    </>
  )
  if (seccion === 'categorias') return (
    <>
      <Input label="Nombre" data-autofocus value={form.nombre || ''} onChange={f('nombre')} error={errores.nombre} placeholder="Ej: Entradas, Bebidas" />
      <Select label="Estado" value={valBool('activo')} onChange={bool('activo')} error={errores.activo}
        options={opcionesBool('Activa (visible en comanda)', 'Inactiva (oculta en comanda)')} />
    </>
  )
  if (seccion === 'productos') return (
    <>
      <Input label="Nombre" data-autofocus value={form.nombre || ''} onChange={f('nombre')} error={errores.nombre} placeholder="Nombre del producto" />
      <Input label="Precio (S/)" type="number" inputMode="decimal" value={form.precio || ''} onChange={f('precio')} error={errores.precio} placeholder="0.00" step="0.10" min={0} />
      <Select label="Categoría" value={form.categoria_id || ''} onChange={f('categoria_id')} error={errores.categoria_id}
        options={[SELECCIONAR, ...datos.categorias.filter(c => c.activo).map(c => ({ value: c.id, label: c.nombre }))]} />
      <Select label="Disponible" value={valBool('disponible')} onChange={bool('disponible')} error={errores.disponible}
        options={opcionesBool('Sí', 'No')} />
    </>
  )
  if (seccion === 'usuarios') return (
    <>
      <Input label="Nombre" data-autofocus value={form.nombre || ''} onChange={f('nombre')} error={errores.nombre} placeholder="Nombre completo" />
      <Input label="Email" type="email" value={form.email || ''} onChange={f('email')} error={errores.email} placeholder="correo@ejemplo.com" />
      <Input label="PIN" type="password" inputMode="numeric" autoComplete="new-password" value={form.pin || ''} onChange={f('pin')} error={errores.pin}
        hint="4 a 6 dígitos." placeholder="4-6 dígitos" maxLength={6} />
      <Select label="Rol" value={form.rol_id || ''} onChange={f('rol_id')} error={errores.rol_id}
        options={[SELECCIONAR, ...datos.roles.map(r => ({ value: r.id, label: r.nombre }))]} />
    </>
  )
  return null
}
