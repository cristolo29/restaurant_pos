const porInicio = (a, b) => new Date(a.pedido_inicio) - new Date(b.pedido_inicio)

export function esCobrable(mesa) {
  return mesa.pedido_id != null && mesa.items_total > 0 && mesa.items_pendientes === 0
}

export function mesasPorCobrar(mesas) {
  const listas = mesas.filter(esCobrable).sort(porInicio)
  const enCocina = mesas
    .filter(m => m.pedido_id != null && m.items_pendientes > 0)
    .sort(porInicio)
  return { listas, enCocina }
}

export function mesasDelMozo(mesas, usuarioId) {
  return mesas
    .filter(m => m.pedido_id != null && m.mozo_id === usuarioId)
    .sort((a, b) => (b.items_listos ?? 0) - (a.items_listos ?? 0) || porInicio(a, b))
}

export function totalPlatosListos(mesas, usuarioId) {
  return mesasDelMozo(mesas, usuarioId).reduce((suma, m) => suma + (m.items_listos ?? 0), 0)
}

export function tiempoTranscurrido(iso) {
  if (!iso) return null
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60) return `${diff}m`
  return `${Math.floor(diff / 60)}h ${diff % 60}m`
}
