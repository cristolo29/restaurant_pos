# Integridad de la base de datos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que PostgreSQL rechace por sí mismo mesas sin salón, estados inválidos, correlativos repetidos, dos pedidos abiertos por mesa y cantidades/precios negativos, y que la API responda 409/422 en vez de 500.

**Architecture:** Las reglas se declaran con nombre en `app/models.py` (los tests crean tablas con `create_all`), se replican con los mismos nombres en SQL (`init_db.sql` y una migración para bases existentes) y un único manejador de `IntegrityError` traduce el nombre de la restricción a un 409 legible.

**Tech Stack:** FastAPI 0.135, SQLAlchemy 2.0, psycopg2, Pydantic 2, PostgreSQL 16, pytest, React (solo un manejo de error).

**Spec:** `docs/superpowers/specs/2026-10-01-integridad-bd-design.md`

## Global Constraints

- Esquema `orbezo`; sin Alembic: la migración es SQL manual, una sola transacción.
- Enumeraciones con `CHECK`, no con enums nativos de PostgreSQL.
- `mesa.estado IN ('disponible','ocupada','reservada')`; `pedido.estado IN ('abierto','cerrado','anulado')`; `pedido.tipo IN ('en_mesa','para_llevar','delivery')`; `pedido_item.estado IN ('pendiente','en_preparacion','listo','entregado','cancelado')`; `comprobante.tipo` y `serie_comprobante.tipo IN ('boleta','factura')`; `comprobante.metodo_pago IN ('efectivo','tarjeta','yape','plin')`.
- `estado_sunat` y `tipo_doc_cliente` quedan fuera (valores sin confirmar).
- Sin `CHECK` de coherencia (`subtotal + igv = total`, `cantidad × precio = subtotal`).
- La migración nunca borra ni corrige datos: si el diagnóstico devuelve filas, se detiene.
- Cada regla tiene nombre explícito y **idéntico** en `models.py`, `init_db.sql` y la migración (tabla de nombres abajo).
- Nunca `alert()`/`confirm()` nativos en el frontend; usar `ModalConfirm`.
- Mensajes de error y código en español, como el resto del proyecto.
- Commits con el pie `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Nombres de restricciones (contrato entre tareas)

| Nombre | Tabla | Regla |
|---|---|---|
| `fk_mesa_salon` | mesa | FK `salon_id` → `salon.id`, `ON DELETE RESTRICT` |
| `uq_mesa_salon_numero` | mesa | UNIQUE (`salon_id`, `numero`) |
| `uq_salon_nombre` | salon | UNIQUE (`nombre`) |
| `uq_categoria_nombre` | categoria | UNIQUE (`nombre`) |
| `uq_serie_tipo_serie` | serie_comprobante | UNIQUE (`tipo`, `serie`) |
| `ck_mesa_estado` · `ck_mesa_capacidad` | mesa | estados · `capacidad > 0` |
| `ck_pedido_estado` · `ck_pedido_tipo` · `ck_pedido_montos` | pedido | estados · tipos · `subtotal, igv, total >= 0` |
| `ck_pedido_item_estado` · `ck_pedido_item_cantidad` · `ck_pedido_item_montos` | pedido_item | estados · `cantidad > 0` · `precio_unit, subtotal >= 0` |
| `ck_serie_tipo` | serie_comprobante | tipos |
| `ck_comprobante_tipo` · `ck_comprobante_metodo_pago` · `ck_comprobante_montos` | comprobante | tipos · métodos · `subtotal, igv, descuento, total, monto_pagado, vuelto >= 0` |
| `ck_comprobante_item_cantidad` | comprobante_item | `cantidad > 0` |
| `ck_producto_precio` | producto | `precio >= 0` |
| `uq_comprobante_serie_correlativo` | comprobante | UNIQUE (`serie`, `correlativo`) |
| `uq_comprobante_pedido` | comprobante | UNIQUE (`pedido_id`) |
| `uq_pedido_abierto_por_mesa` | pedido | índice único parcial sobre `mesa_id` WHERE `estado = 'abierto'` |

Además `mesa.salon_id`, `mesa.numero` y `mesa.estado` pasan a `NOT NULL`.

## Review Focus

- El mismo número de mesa en **dos salones distintos** debe seguir permitido.
- Cerrar o anular un pedido y abrir otro en la misma mesa debe seguir funcionando (el índice solo cubre `abierto`).
- `precio = 0` (cortesía) es válido; `cantidad = 0` o negativa devuelve 422, nunca 500.
- Editar una mesa (`PUT`) a un número ya usado en su salón devuelve 409 con mensaje claro.
- Ejecutar `init_db.sql` dos veces no duplica salones, categorías ni series.
- Emitir un segundo comprobante para el mismo pedido sigue devolviendo 400 (la validación de la app va antes que la restricción).

Cada línea tiene su test en la tarea que posee el código (marcado «Review Focus»).

---

### Task 1: Mesas, salones y semillas únicas (puntos 1 y 3)

**Files:**
- Modify: `app/models.py` (`Salon`, `Categoria`, `SerieComprobante`, `Mesa`)
- Create: `tests/test_integridad_bd.py`

**Interfaces:**
- Produces: helper de test `nombre_violacion(db, objeto) -> str | None` en `tests/test_integridad_bd.py`: hace `db.add(objeto)`, `db.commit()` dentro de `pytest.raises(IntegrityError)`, ejecuta `db.rollback()` y devuelve `exc.value.orig.diag.constraint_name`. Las tareas 2-4 lo reutilizan.

- [ ] **Step 1: Escribir los tests que fallan** en `tests/test_integridad_bd.py`:
  - `test_mesa_con_salon_inexistente` → `nombre_violacion(db, Mesa(salon_id=9999, numero="01", estado="disponible")) == "fk_mesa_salon"`.
  - `test_mesa_sin_numero_o_sin_salon_falla` → `Mesa(salon_id=salon.id, numero=None)` y `Mesa(salon_id=None, numero="1")` lanzan `IntegrityError`.
  - `test_numero_repetido_en_mismo_salon` → con la fixture `mesa` (número `"01"`), otra `Mesa(salon_id=salon.id, numero="01")` → `"uq_mesa_salon_numero"`.
  - **Review Focus** `test_mismo_numero_en_otro_salon_es_valido`: crear segundo `Salon(nombre="Terraza")` y `Mesa(salon_id=otro.id, numero="01")` hace commit sin error.
  - `test_nombre_repetido_salon_categoria_serie` → `Salon(nombre="Salón Principal")` → `"uq_salon_nombre"`; `Categoria(nombre="Platos")` (fixture `categoria`) → `"uq_categoria_nombre"`; segunda `SerieComprobante(tipo="boleta", serie="B001")` → `"uq_serie_tipo_serie"`.
  - `test_eliminar_salon_con_mesas_devuelve_409` (API, `auth_admin`, fixture `mesa`): `DELETE /api/salones/{salon.id}` → 409 (ya cubierto por el `except` existente; fija el comportamiento con la FK real).
- [ ] **Step 2: Ejecutar** `pytest tests/test_integridad_bd.py -v`. Esperado: FAIL (no se levanta `IntegrityError`).
- [ ] **Step 3: Declarar las reglas en `app/models.py`** con los nombres de la tabla: `ForeignKey("orbezo.salon.id", ondelete="RESTRICT", name="fk_mesa_salon")` en `Mesa.salon_id`, `nullable=False` en `salon_id`, `numero`, `estado`; `UniqueConstraint(..., name=...)` dentro de `__table_args__` (tupla con el dict `{"schema": "orbezo"}` al final) en `Mesa`, `Salon`, `Categoria`, `SerieComprobante`.
- [ ] **Step 4: Ejecutar** `pytest -v`. Esperado: PASS en todo el conjunto; si algún test previo viola una regla, corregir su fixture (no la regla).
- [ ] **Step 5: Commit** — `git add app/models.py tests/test_integridad_bd.py && git commit -m "feat: mesas con salón obligatorio y unicidad de nombres y semillas"`.

### Task 2: Estados y tipos cerrados (punto 2)

**Files:**
- Modify: `app/models.py` (`Mesa`, `Pedido`, `PedidoItem`, `SerieComprobante`, `Comprobante`)
- Modify: `tests/test_integridad_bd.py`

**Interfaces:**
- Consumes: `nombre_violacion` (Task 1).

- [ ] **Step 1: Tests que fallan.** Un test parametrizado (`pytest.mark.parametrize`) con filas `(objeto_invalido, nombre_esperado)` que cubra: `Mesa(estado="ocupda")` → `ck_mesa_estado`; `Pedido(estado="x")` → `ck_pedido_estado`; `Pedido(tipo="x")` → `ck_pedido_tipo`; `PedidoItem(estado="x")` → `ck_pedido_item_estado`; `SerieComprobante(tipo="x", serie="Z001")` → `ck_serie_tipo`; `Comprobante(tipo="x")` → `ck_comprobante_tipo`; `Comprobante(metodo_pago="bitcoin")` → `ck_comprobante_metodo_pago`. Las filas necesitan un pedido/usuario/serie válidos; construirlas con las fixtures `mesa`, `usuario_mozo`, `producto`, `serie_boleta` dentro del test.
  - `test_mesa_estado_reservada_es_valido`: `Mesa(..., estado="reservada")` hace commit.
- [ ] **Step 2: Ejecutar** `pytest tests/test_integridad_bd.py -v`. Esperado: FAIL.
- [ ] **Step 3: Agregar `CheckConstraint(<sql>, name=...)`** a `__table_args__` de cada modelo con los nombres y valores de Global Constraints.
- [ ] **Step 4: Ejecutar** `pytest -v`. Esperado: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: CHECK de estados y tipos en mesas, pedidos y comprobantes"` (incluir el test).

### Task 3: Numeración fiscal y un pedido abierto por mesa (puntos 4 y 5)

**Files:**
- Modify: `app/models.py` (`Comprobante`, `Pedido`)
- Modify: `tests/test_integridad_bd.py`

**Interfaces:**
- Consumes: `nombre_violacion`.

- [ ] **Step 1: Tests que fallan.**
  - `test_correlativo_repetido` → dos `Comprobante` con misma `serie` y `correlativo`, distintos `pedido_id` → `uq_comprobante_serie_correlativo`.
  - `test_dos_comprobantes_mismo_pedido` → `uq_comprobante_pedido`.
  - `test_segundo_pedido_abierto_en_la_misma_mesa` → con un `Pedido(estado="abierto")` en la fixture `mesa`, otro `abierto` → `uq_pedido_abierto_por_mesa`.
  - **Review Focus** `test_pedido_nuevo_tras_cerrar_o_anular`: con un pedido `cerrado` y otro `anulado` en la mesa, un `abierto` hace commit.
  - **Review Focus** `test_segundo_comprobante_via_api_sigue_siendo_400`: reutilizar el flujo de `test_no_duplicar_comprobante` y afirmar `status_code == 400` (no 409 ni 500).
- [ ] **Step 2: Ejecutar** los tests nuevos. Esperado: FAIL salvo el 400 (ya pasa; confirma que no regresa).
- [ ] **Step 3: Implementar** en `models.py`: `UniqueConstraint("serie", "correlativo", name=...)` y `UniqueConstraint("pedido_id", name=...)` en `Comprobante`; en `Pedido`, `Index("uq_pedido_abierto_por_mesa", "mesa_id", unique=True, postgresql_where=text("estado = 'abierto'"))`.
- [ ] **Step 4: Ejecutar** `pytest -v`. Esperado: PASS. Si falla algún test previo por dos pedidos abiertos en una mesa, ajustar el fixture del test.
- [ ] **Step 5: Commit** — `git commit -am "feat: correlativo y pedido por comprobante únicos; un pedido abierto por mesa"`.

### Task 4: Rangos numéricos (punto 6)

**Files:**
- Modify: `app/models.py` (`Producto`, `Mesa`, `Pedido`, `PedidoItem`, `Comprobante`, `ComprobanteItem`)
- Modify: `tests/test_integridad_bd.py`

**Interfaces:**
- Consumes: `nombre_violacion`.

- [ ] **Step 1: Tests que fallan.** Parametrizado con `(objeto, nombre)`: `Producto(precio=-1)` → `ck_producto_precio`; `Mesa(capacidad=0)` → `ck_mesa_capacidad`; `PedidoItem(cantidad=0)` y `cantidad=-3` → `ck_pedido_item_cantidad`; `PedidoItem(precio_unit=-1)` → `ck_pedido_item_montos`; `Pedido(total=-1)` → `ck_pedido_montos`; `Comprobante(vuelto=-1)` → `ck_comprobante_montos`; `ComprobanteItem(cantidad=0)` → `ck_comprobante_item_cantidad`.
  - `test_precio_cero_es_valido`: `Producto(precio=0)` hace commit.
- [ ] **Step 2: Ejecutar.** Esperado: FAIL.
- [ ] **Step 3: Agregar los `CheckConstraint`** con los nombres de la tabla. Los `CHECK` de montos son una sola expresión con `AND`; los `NULL` pasan.
- [ ] **Step 4: Ejecutar** `pytest -v`. Esperado: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: CHECK de rangos numéricos en precios, cantidades y montos"`.

### Task 5: API: errores 409/422 claros (puntos 1-6 hacia el usuario)

**Files:**
- Create: `app/integridad.py`
- Modify: `app/main.py`, `app/schemas.py`
- Test: `tests/test_integridad_api.py`

**Interfaces:**
- Produces: `MENSAJES: dict[str, str]` (nombre de restricción → mensaje en español) y `async def manejar_integrity_error(request: Request, exc: IntegrityError) -> JSONResponse` en `app/integridad.py`. Devuelve 409 con `{"detail": <mensaje>}`; si el nombre (`exc.orig.diag.constraint_name`) no está en `MENSAJES`, 409 con «La operación viola una regla de integridad de los datos». Registrado en `main.py` con `app.add_exception_handler(IntegrityError, manejar_integrity_error)`.
- Mensajes mínimos: `uq_mesa_salon_numero` «Ya existe una mesa con ese número en el salón»; `fk_mesa_salon` «El salón indicado no existe»; `uq_salon_nombre` / `uq_categoria_nombre` «Ya existe un registro con ese nombre»; `uq_pedido_abierto_por_mesa` «La mesa ya tiene un pedido abierto»; `uq_comprobante_pedido` «El pedido ya tiene comprobante»; `uq_comprobante_serie_correlativo` «El correlativo ya fue emitido; reintenta».

- [ ] **Step 1: Tests que fallan** en `tests/test_integridad_api.py`:
  - `test_crear_mesa_numero_repetido_409` → `POST /api/mesas` (`auth_admin`, `{"salon_id": salon.id, "numero": "01"}`) → 409 y `detail` igual al mensaje de `uq_mesa_salon_numero`.
  - **Review Focus** `test_actualizar_mesa_a_numero_existente_409` → crear mesa `"02"`, `PUT` a `"01"` → 409.
  - `test_crear_mesa_salon_inexistente_409` → `salon_id=9999` → 409 con el mensaje de `fk_mesa_salon`.
  - `test_crear_salon_y_categoria_duplicados_409`.
  - `test_agregar_item_cantidad_cero_422` y `..._negativa_422` (`POST /api/pedidos/{id}/items`); **Review Focus** `test_producto_precio_cero_es_valido` → `POST /api/productos` con `precio: 0` → 200, `precio: -1` → 422.
  - `test_pedido_tipo_invalido_422`; `test_comprobante_metodo_pago_invalido_422`.
  - `test_abrir_pedido_con_huerfano_sigue_funcionando`: insertar por `db` un pedido abierto en `mesa`, luego `POST /api/pedidos` debe devolver 200 (la lógica de huérfanos lo anula antes de insertar) y quedar un solo pedido `abierto`. La carrera real entre dos mozos no se puede reproducir de forma determinista; la cubre `test_segundo_pedido_abierto_en_la_misma_mesa` (Task 3) más el mensaje de `uq_pedido_abierto_por_mesa`.
- [ ] **Step 2: Ejecutar** `pytest tests/test_integridad_api.py -v`. Esperado: FAIL (500 o 200).
- [ ] **Step 3: Implementar** `app/integridad.py`, registrarlo en `app/main.py`, y en `app/schemas.py`: `PedidoItemCreate.cantidad: int = Field(default=1, gt=0)`, `ProductoCreate.precio: float = Field(ge=0)`, `MesaCreate.capacidad: int = Field(default=4, gt=0)`, `PedidoCreate.tipo: Literal["en_mesa","para_llevar","delivery"] = "en_mesa"`, `ComprobanteCreate.tipo: Literal["boleta","factura"]`, `.metodo_pago: Literal["efectivo","tarjeta","yape","plin"] = "efectivo"`, `.monto_pagado` y `.vuelto` con `Field(ge=0)`.
- [ ] **Step 4: Ejecutar** `pytest -v`. Esperado: PASS completo.
- [ ] **Step 5: Commit** — `git add app tests && git commit -m "feat: traducir violaciones de integridad a 409 y validar rangos en schemas"`.

### Task 6: SQL: init, diagnóstico, migración y rollback

**Files:**
- Modify: `scripts/init_db.sql`
- Create: `scripts/migrations/001_diagnostico.sql`, `scripts/migrations/001_integridad.sql`, `scripts/migrations/001_rollback.sql`
- Modify: `CLAUDE.md` (sección Architecture: carpeta `scripts/migrations/`, y regla «cada restricción se declara en `models.py` y en SQL con el mismo nombre»)

**Interfaces:**
- Consumes: tabla de nombres de este plan.
- Produces: tres scripts ejecutables con `psql -v ON_ERROR_STOP=1`.

- [ ] **Step 1: Actualizar `init_db.sql`** con las mismas reglas y nombres (constraints en los `CREATE TABLE`, índice parcial después de `pedido`). Los `ON CONFLICT DO NOTHING` existentes pasan a ser efectivos.
- [ ] **Step 2: Escribir `001_diagnostico.sql`**: un `SELECT` de solo lectura por regla, con columna `regla` y las filas infractoras (mesas sin salón o con `salon_id` inexistente, `numero` nulo, números repetidos por salón, nombres repetidos de salón/categoría, series repetidas, estados fuera de lista por tabla, correlativos repetidos, pedidos con comprobante múltiple, mesas con más de un pedido abierto, valores negativos o cantidades ≤ 0). Todo vacío = apto para migrar.
- [ ] **Step 3: Escribir `001_integridad.sql`**: `BEGIN; … COMMIT;` con `ALTER TABLE … ADD CONSTRAINT <nombre> …`, `ALTER COLUMN … SET NOT NULL` y `CREATE UNIQUE INDEX uq_pedido_abierto_por_mesa … WHERE estado = 'abierto'`. `001_rollback.sql`: los `DROP CONSTRAINT IF EXISTS` / `DROP INDEX IF EXISTS` inversos y `DROP NOT NULL`.
- [ ] **Step 4: Verificar en base de prueba aislada:**
  1. `createdb -h localhost -U admin orbezo_migtest` y cargar el **init antiguo**: `git show 15b86ad:scripts/init_db.sql | psql -h localhost -U admin -d orbezo_migtest`.
  2. Insertar datos sucios (mesa sin salón, estado `'ocupda'`, dos pedidos abiertos en una mesa) y ejecutar `001_diagnostico.sql`. Esperado: devuelve esas filas.
  3. Corregir a mano los datos de prueba, ejecutar `001_integridad.sql` con `-v ON_ERROR_STOP=1`. Esperado: sin errores.
  4. Con datos sucios aún presentes, confirmar que `001_integridad.sql` falla y no deja cambios parciales (transacción).
  5. **Equivalencia con los modelos:** crear `orbezo_modelos` con `Base.metadata.create_all` y comparar `SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'orbezo' ORDER BY 1` (más `pg_indexes` para el índice parcial) entre `orbezo_migtest` migrada, una base creada solo con el nuevo `init_db.sql`, y `orbezo_modelos`. Esperado: las listas de nombres de restricciones explícitas coinciden.
  6. **Review Focus:** ejecutar el nuevo `init_db.sql` dos veces sobre una base vacía y comprobar con `SELECT count(*)` que `salon` = 2, `categoria` = 4 y `serie_comprobante` = 2.
  7. Ejecutar `001_rollback.sql` y confirmar que las restricciones desaparecen.
  8. `dropdb` de las tres bases temporales.
- [ ] **Step 5: Commit** — `git add scripts CLAUDE.md && git commit -m "feat: migración SQL de integridad con diagnóstico y rollback; init_db con las mismas reglas"`.

### Task 7: Frontend: mostrar los errores nuevos

**Files:**
- Modify: `frontend_react/src/pages/Comanda.jsx` (`enviarACocina`)

**Interfaces:**
- Consumes: respuestas 409/422 con `detail` de string (Task 5).

- [ ] **Step 1: En `enviarACocina` agregar `catch (e)`** que abra `setModal({ titulo: 'No se pudo enviar el pedido', mensaje: e.response?.data?.detail || 'Ocurrió un error inesperado.', labelConfirm: 'Entendido', colorConfirm: 'danger', onConfirm: () => navigate('/mesas') })` (al volver, `Mesas` carga el pedido ya abierto de esa mesa, como pide el spec). Hoy solo tiene `try/finally`, por lo que un 409 quedaría sin mostrar.
- [ ] **Step 2: Verificar** `npm run lint` (sin errores nuevos). Revisar que `Admin.jsx` (línea ~410) y `Cobro.jsx` (línea ~66) ya muestran `detail`; no requieren cambios.
- [ ] **Step 3: Prueba manual** (`uvicorn app.main:app --reload` + `npm run dev`): con una mesa abierta desde otro navegador, enviar un ítem desde una comanda vacía de la misma mesa → modal con «La mesa ya tiene un pedido abierto» y regreso a `/mesas`; crear una mesa con número repetido en Admin → mensaje de duplicado.
- [ ] **Step 4: Commit** — `git add frontend_react && git commit -m "fix: mostrar errores de integridad al enviar a cocina"`.

---

## Verificación final

- `pytest` completo en verde y `npm run lint` sin errores nuevos.
- Migración probada con datos limpios, con datos sucios (aborta sin cambios) y con rollback, en base temporal.
- **Antes de aplicar en producción:** `pg_dump`, ejecutar `001_diagnostico.sql` y resolver cada fila con decisión explícita.

## Autoevaluación contra el spec

- Cobertura: puntos 1-6 → Tasks 1-4; manejo de errores y schemas → Task 5; entregables 1-4 → Task 6; frontend → Task 7; despliegue y respaldo → Verificación final.
- Resuelto: el spec dudaba de si el fixture `mesa` crea un salón; **ya lo crea** (`conftest.py`), no hay que cambiarlo.
- Ampliación respecto al spec: `categorias` también devuelve 409 por nombre duplicado (el spec solo listaba `mesas`, `salones`, `pedidos`, `comprobantes`); se resuelve con el manejador global, sin tocar cada router.
- Preguntas abiertas del spec (`estado_sunat`, `tipo_doc_cliente`, datos de producción) siguen fuera de alcance.
