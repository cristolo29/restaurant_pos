import api from './client'

export const abrirPedido = (mesa_id, usuario_id) =>
  api.post('/api/pedidos', { mesa_id, usuario_id, tipo: 'en_mesa' }).then(r => r.data)

export const getPedidoAbierto = (mesa_id) =>
  api.get(`/api/pedidos/mesa/${mesa_id}/abierto`).then(r => r.data)

export const getPedido = (pedido_id) =>
  api.get(`/api/pedidos/${pedido_id}`).then(r => r.data)

export const agregarItem = (pedido_id, producto_id, cantidad, nota = '') =>
  api.post(`/api/pedidos/${pedido_id}/items`, { producto_id, cantidad, nota }).then(r => r.data)

export const cancelarPedido = (pedido_id) =>
  api.put(`/api/pedidos/${pedido_id}/cancelar`).then(r => r.data)

export const cancelarItem = (item_id) =>
  api.put(`/api/pedidos/items/${item_id}/estado`, { estado: 'cancelado' }).then(r => r.data)

export const cerrarPedido = (pedido_id) =>
  api.put(`/api/pedidos/${pedido_id}/cerrar`).then(r => r.data)
