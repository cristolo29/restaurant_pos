export const METODO_LABEL = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', yape: 'Yape', plin: 'Plin' }

/** Moneda con formato local: S/ 12.50 */
export const soles = (n) => `S/ ${Number(n).toFixed(2)}`

/**
 * Convierte el error del API en { general, campos }.
 * Los errores de validación (detail como arreglo) se asocian al campo cuando
 * `loc` coincide con una clave del formulario; el resto va en `general`.
 */
export function interpretarError(e, clavesValidas = []) {
  const detail = e.response?.data?.detail
  if (!detail) return { general: 'Error al guardar', campos: {} }
  if (typeof detail === 'string') return { general: detail, campos: {} }
  if (Array.isArray(detail)) {
    const campos = {}
    const generales = []
    detail.forEach(d => {
      const clave = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
      if (clave && clavesValidas.includes(clave) && !campos[clave]) campos[clave] = d.msg
      else generales.push(d.msg)
    })
    return { general: generales.join(', '), campos }
  }
  return { general: JSON.stringify(detail), campos: {} }
}
