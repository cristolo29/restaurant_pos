# Integridad de la base de datos — diseño de migración

Fecha: 2026-10-01 · Estado: **borrador para revisión** (sin implementar)

## Objetivo

Que la base de datos garantice por sí misma las reglas que hoy solo cumple el código: relaciones válidas, valores de estado cerrados, numeración fiscal única y una sola cuenta abierta por mesa. Cubre los puntos 1 a 6 de la revisión de `scripts/init_db.sql`. El resto queda en el backlog (memoria del proyecto).

Éxito = un dato inválido (mesa en salón inexistente, estado con typo, correlativo repetido, dos pedidos abiertos en una mesa, cantidad negativa) es rechazado por PostgreSQL, y el sistema responde con un error claro (409/422) en lugar de un 500.

## Hechos del repo que condicionan el diseño

- No hay Alembic ni `create_all` en la app; el esquema nace de `scripts/init_db.sql`, que Docker ejecuta **solo con el volumen vacío**. Las bases existentes necesitan un script de migración aparte.
- Los tests crean las tablas con `Base.metadata.create_all` desde `models.py`. Si las reglas solo están en SQL, los tests no las ejercitan: **`models.py` debe reflejar cada restricción**.
- Valores reales en uso: mesa `disponible|ocupada`; pedido `abierto|cerrado|anulado`; ítem `pendiente|en_preparacion|listo|entregado|cancelado` (ya validado por `Literal` en `schemas.py:93`); comprobante `boleta|factura`; pago `efectivo|tarjeta|yape|plin`.
- `comprobantes.py:64` ya impide emitir dos comprobantes para el mismo pedido; `abrir_pedido` ya anula pedidos huérfanos antes de insertar.

## Diseño por punto

**1. Mesas**
- `mesa.salon_id`: `NOT NULL` + FK a `salon(id)` con `ON DELETE RESTRICT`.
- `mesa.numero` y `mesa.estado`: `NOT NULL`.
- `UNIQUE (salon_id, numero)`.
- Efecto en la API: `crear_mesa`/`actualizar_mesa` deben traducir la violación de unicidad en 409 («ya existe la mesa N en este salón»). Borrar un salón con mesas debe dar 409 (revisar `routers/salones.py`).

**2. Estados y tipos cerrados (CHECK)**
- `mesa.estado IN ('disponible','ocupada','reservada')` — `reservada` se admite ya para no bloquear la mejora pendiente #2.
- `pedido.estado IN ('abierto','cerrado','anulado')`; `pedido.tipo IN ('en_mesa','para_llevar','delivery')`.
- `pedido_item.estado` con los 5 valores.
- `comprobante.tipo` y `serie_comprobante.tipo IN ('boleta','factura')`; `comprobante.metodo_pago IN ('efectivo','tarjeta','yape','plin')`.
- Se prefiere CHECK a enums nativos de PostgreSQL: agregar un valor es un `ALTER` simple de la restricción, no una migración de tipo.
- `estado_sunat` y `tipo_doc_cliente` quedan **fuera** hasta confirmar sus valores (ver preguntas abiertas).

**3. Unicidad real para los datos semilla**
- `UNIQUE (nombre)` en `salon` y `categoria`; `UNIQUE (tipo, serie)` en `serie_comprobante`.
- Con eso los `ON CONFLICT DO NOTHING` de `init_db.sql` funcionan y re-ejecutar el script ya no duplica filas.

**4. Numeración fiscal**
- `comprobante`: `UNIQUE (serie, correlativo)` y `UNIQUE (pedido_id)`.
- `UNIQUE (pedido_id)` es válido mientras no existan notas de crédito/anulaciones de comprobante; al introducirlas se cambia a índice parcial.
- El `with_for_update()` actual se mantiene; la restricción es la red de seguridad, no su reemplazo.

**5. Un solo pedido abierto por mesa**
- Índice único parcial sobre `pedido(mesa_id)` donde `estado = 'abierto'`.
- `abrir_pedido` ya hace `flush()` tras anular el huérfano, así que el orden es compatible. Si dos mozos compiten, el segundo recibe `IntegrityError`, que se traduce en 409 y la app debe cargar el pedido ya abierto en lugar de fallar.

**6. Rangos numéricos (CHECK)**
- `producto.precio >= 0`; `mesa.capacidad > 0`.
- `pedido_item.cantidad > 0`, `precio_unit >= 0`, `subtotal >= 0`.
- `pedido.subtotal/igv/total >= 0`.
- `comprobante.subtotal/igv/total/descuento/monto_pagado/vuelto >= 0`; `comprobante_item.cantidad > 0`.
- No se agregan CHECK de coherencia (`subtotal + igv = total`, `cantidad × precio = subtotal`): el redondeo y los descuentos los harían frágiles.
- En `schemas.py`, `cantidad` y `precio` reciben validación (`gt=0` / `ge=0`) para devolver 422 antes de llegar a la base.

## Entregables

1. `scripts/migrations/001_integridad.sql` — migración para bases existentes, dentro de una transacción.
2. `scripts/migrations/001_diagnostico.sql` — consultas de solo lectura que listan datos que violarían cada regla (mesas sin salón, números repetidos, estados fuera de lista, correlativos duplicados, mesas con más de un pedido abierto, valores negativos).
3. `scripts/migrations/001_rollback.sql` — elimina las restricciones agregadas.
4. `scripts/init_db.sql` — mismas reglas para instalaciones nuevas.
5. `app/models.py` — `ForeignKey`, `UniqueConstraint`, `CheckConstraint` e `Index(..., postgresql_where=...)` equivalentes.
6. Manejo de `IntegrityError` → 409 en `mesas`, `salones`, `pedidos`, `comprobantes`; validaciones en `schemas.py`.

## Plan de despliegue

1. Respaldo con `pg_dump`.
2. Ejecutar el diagnóstico; **si devuelve filas, se detiene** y se resuelve cada caso con decisión explícita (la migración nunca borra ni corrige datos por su cuenta).
3. Aplicar la migración en una transacción; si cualquier restricción falla, se revierte todo.
4. Verificar con las consultas de diagnóstico y `pytest`.
5. Desplegar el backend con el manejo de 409.

Bases existentes: `docker compose exec -T db psql -U $POSTGRES_USER -d $POSTGRES_DB < scripts/migrations/001_integridad.sql`.

## Pruebas

- Un test por regla que confirme el rechazo (mesa duplicada en un salón, estado inválido, correlativo repetido, segundo pedido abierto, cantidad negativa) y el código HTTP esperado.
- Los fixtures de `conftest.py` deberán crear un salón antes de la `mesa`, porque `salon_id` pasa a ser obligatorio y con FK (hay que confirmar si hoy el fixture lo omite).
- Prueba de la migración sobre una copia con datos de ejemplo, incluida una ejecución con datos «sucios» para verificar que el diagnóstico los detecta.

## Riesgos

- **Datos existentes que violen reglas:** cubierto por el diagnóstico; el costo es una decisión manual por caso.
- **Cierre de sesión de mesas por el índice parcial:** si hoy hay mesas con dos pedidos abiertos, la migración falla hasta resolverlas.
- **Cambio de comportamiento en la API:** algunos errores pasan de 500 a 409/422. El frontend debe mostrarlos con `ModalConfirm`, no con `alert()`.
- **Sin Alembic:** esta migración es manual y única; cada cambio futuro de esquema exigirá otro script hasta adoptar Alembic (backlog).

## Preguntas abiertas

1. ¿Qué valores válidos tiene `estado_sunat`? Propuesta: `pendiente|aceptado|rechazado|anulado`.
2. ¿Se limita `tipo_doc_cliente` a los códigos SUNAT (`0,1,4,6,7,A`)?
3. ¿Hay pedidos o series duplicadas en la base de producción? Solo el diagnóstico lo dirá.
