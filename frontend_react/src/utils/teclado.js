/**
 * Aplica una tecla al texto actual: dígitos, punto decimal, borrar un carácter o limpiar todo.
 * Función pura (sin estado) para poder reutilizarla y probarla: el dinero se sigue guardando como texto
 * y se convierte a céntimos enteros con `aCentimos`.
 */
export function aplicarTecla(valor, tecla, { decimal = true, decimales = 2, maxLength = 10 } = {}) {
  const v = String(valor ?? '')
  if (tecla === 'limpiar') return ''
  if (tecla === 'borrar') return v.slice(0, -1)
  if (v.length >= maxLength) return v
  if (tecla === '.') {
    if (!decimal || v.includes('.')) return v
    return v === '' ? '0.' : `${v}.`
  }
  if (!/^\d$/.test(tecla)) return v
  if (decimal && v.includes('.') && v.split('.')[1].length >= decimales) return v
  if (v === '0' && decimal) return tecla // sin ceros a la izquierda en importes ("05" -> "5")
  return v + tecla
}
