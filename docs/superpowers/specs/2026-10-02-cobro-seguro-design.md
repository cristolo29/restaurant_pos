# Cobro seguro y trazable — diseño

Fecha: 2026-10-02 · Estado: **borrador para revisión** (sin implementar)

Origen: análisis de reglas de negocio faltantes (plan `que-regla-de-negocio-fancy-hare`, bloque P0). Este documento cubre solo el primer bloque; caja, descuentos, pago dividido y reportes van en specs aparte.

## Objetivo

Que el servidor, y no el navegador, garantice que un cobro es correcto, completo y deja rastro: monto pagado válido, pedido cerrado y comprobante emitido o nada, y toda anulación con motivo y responsable.

Éxito = (1) un cobro con monto insuficiente o vuelto incorrecto es rechazado con 422; (2) si falla la emisión del comprobante el pedido sigue abierto y la mesa ocupada; (3) anular un pedido o cancelar un ítem exige motivo y queda registrado quién y cuándo; (4) el mozo y el cajero salen del token, no del cuerpo de la petición.

## Hechos del repo que condicionan el diseño

- Hoy el cobro son dos llamadas del frontend: `PUT /api/pedidos/{id}/cerrar` y luego `POST /api/comprobantes` (`Cobro.jsx`). Si la segunda falla, el pedido queda cerrado, la mesa libre y sin comprobante.
- `emitir_comprobante` toma `monto_pagado` y `vuelto` del cliente sin validarlos; recalcula subtotal, IGV y total desde los ítems.
- `cancelar_pedido` lo permiten mozo, cajero y admin, sin motivo ni registro. `PUT items/{id}/estado` acepta cualquier transición.
- `Comprobante.usuario_id` guarda al mozo del pedido, no a quien cobró. `PedidoCreate.usuario_id` lo envía el cliente.
- Regla del proyecto: cada restricción lleva el mismo nombre en `models.py`, `init_db.sql` y la migración (`scripts/migrations/`). Los tests crean tablas con `create_all`.
- 7 tests ya fallan en HEAD limpio (`test_comprobantes`: emitir_boleta, emitir_boleta_con_dni, factura_sin_ruc, factura_con_ruc, correlativo_avanza; `test_pedidos`: abrir_pedido_mesa_ocupada, flujo_completo). Este bloque toca esos flujos: **primero hay que entender por qué fallan** y arreglar los tests o el código antes de apoyarse en ellos.

## Diseño

**1. Cobro atómico**
- Nuevo `POST /api/pedidos/{id}/cobrar` (cajero o admin) con el cuerpo de `ComprobanteCreate` sin `pedido_id`. En una sola transacción: valida ítems en cocina, valida el pago, cierra el pedido, libera la mesa, marca ítems entregados y emite el comprobante. Cualquier error hace rollback completo.
- `cerrar` y `POST /api/comprobantes` se mantienen por compatibilidad hasta migrar el frontend; luego se retiran en un cambio aparte.
- La lógica de emisión se extrae de `emitir_comprobante` a una función reutilizable, no se duplica.

**2. Validación de pago en el servidor**
- `efectivo`: `monto_pagado >= total` y `vuelto == monto_pagado - total` (a 2 decimales).
- `tarjeta`, `yape`, `plin`: `monto_pagado == total` y `vuelto == 0`.
- Error 422 con mensaje en español. El `total` es el recalculado por el servidor.

**3. Anulación con motivo y rastro**
- `pedido`: columnas `anulado_por` (FK usuario), `anulado_at`, `motivo_anulacion` (texto, obligatorio al anular). `pedido_item`: `cancelado_por`, `cancelado_at`, `motivo_cancelacion`.
- `cancelar_pedido` y cancelar ítem reciben `motivo` (mínimo 3 caracteres). Cancelar un ítem solo desde `pendiente`, o desde `en_preparacion`/`listo` si el rol es cajero o admin. Un ítem `entregado` o ya `cancelado` no se cancela.
- Restricción: `ck_pedido_anulacion` — si `estado = 'anulado'` entonces `motivo_anulacion` no es nulo. (Pedidos anulados antiguos, incluidos los huérfanos que anula `abrir_pedido`, necesitan valor: la migración les pone «Anulado antes del registro de motivos» y `abrir_pedido` escribe «Pedido huérfano anulado al abrir uno nuevo».)

**4. Auditoría mínima**
- Tabla `auditoria` (`id`, `usuario_id`, `accion`, `entidad`, `entidad_id`, `detalle` JSONB, `created_at`). Se escribe en la misma transacción para: cobro, anulación de pedido, cancelación de ítem. Sin endpoint de lectura en este bloque.

**5. Identidad desde el token**
- `abrir_pedido` ignora `usuario_id` del cuerpo y usa el usuario autenticado (el campo se acepta pero opcional y se descarta, para no romper al frontend).
- `comprobante.usuario_id` pasa a ser quien cobra. El mozo se conserva en `pedido.usuario_id`.

**6. Estados coherentes**
- Transiciones de ítem permitidas: `pendiente→en_preparacion→listo` (cocinero/admin); `→cancelado` según el punto 3; `→entregado` solo por cobro. Cualquier otra, 409.
- `agregar_item` exige pedido existente y `abierto` (404/409).
- `liberar_mesa` rechaza con 409 si la mesa tiene un pedido abierto.

## Fuera de alcance

Caja y arqueo, descuentos, propinas, pago o cuenta dividida, notas de crédito, envío a SUNAT, reportes, hash de PIN. Ver el plan general para su orden.

## Pruebas

TDD por regla, con tests de API sobre `orbezo_test`: pago insuficiente, vuelto incorrecto, tarjeta con monto distinto, fallo en emisión sin cambios de estado (rollback), anulación sin motivo (422), mozo cancelando ítem en preparación (403), transición inválida (409), `agregar_item` en pedido cerrado (409), `liberar_mesa` con pedido abierto (409), `usuario_id` del cuerpo ignorado, fila de auditoría escrita en cada acción. Migración `002_*.sql` con diagnóstico, migración y rollback, probada sobre una copia de la base.

## Decisiones abiertas para el usuario

1. ¿Quién puede cancelar un ítem ya en cocina? Propuesta: solo cajero y admin, con motivo; el mozo solo ítems `pendiente`.
2. ¿El motivo de anulación es texto libre o una lista cerrada (error de pedido, cliente se retiró, cortesía, otro)? Propuesta: lista cerrada + detalle opcional.
3. ¿Se retiran de inmediato `cerrar` y `POST /api/comprobantes` al migrar el frontend? Propuesta: sí, en el mismo bloque, tras migrar `Cobro.jsx`.
4. ¿El negocio ya emite electrónico por otro sistema? Si es así, el comprobante interno es solo ticket y baja la urgencia del bloque fiscal.
