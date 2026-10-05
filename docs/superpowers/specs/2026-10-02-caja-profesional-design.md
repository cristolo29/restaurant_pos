# Caja profesional — diseño y tareas

Fecha: 2026-10-02 · Estado: **borrador para revisión** (sin implementar) · Rama base: `feat/cobro-caja` (`050693a`)

Parte de: apertura, resumen en vivo, cierre con diferencia, arqueo imprimible, historial (migración 003). Este spec lleva esa caja a un nivel profesional en **tres fases**; cada fase se entrega y se prueba por separado.

## Objetivo

Que el dueño pueda confiar en los números del turno: que el efectivo esperado cuente ingresos, egresos y retiros; que el cajero cuente sin ver el esperado; que una diferencia grande exija autorización; y que cada movimiento de dinero deje rastro.

Éxito de la fase 1 = (1) el esperado = fondo + efectivo cobrado + ingresos − egresos − retiros, calculado por el servidor; (2) el conteo por denominaciones suma igual que el monto contado, verificado por el servidor; (3) el cajero no ve el esperado antes de confirmar su conteo; (4) una diferencia mayor a la tolerancia no cierra sin PIN de admin; (5) ningún movimiento se edita ni se borra.

## Hechos del repo y de producción que condicionan el diseño

- Caja actual: tabla `caja` (nueva forma) con `monto_inicial`, `monto_contado`, `monto_esperado`, `diferencia`, `observaciones`, `estado`, `cerrada_por`; `comprobante.caja_id`. Una caja abierta por usuario (`uq_caja_abierta_por_usuario`). Una caja cerrada es inmutable por API. Montos con `Decimal` y 2 decimales (`app/cobro.py`).
- **Producción tiene tablas heredadas que el repositorio no define** (lección de la 003): `caja_legada` tras migrar, `pago`, `insumo`, `producto_insumo`. Antes de crear cualquier objeto nuevo, comprobar colisión de nombres con `scripts/migrations/colisiones_diagnostico.sql` (el patrón existente) y no reutilizar nombres heredados. Nombres confirmados libres en producción: `caja_movimiento`, `idx_caja_mov_caja`, `caja.conteo`, `caja.autorizado_por`.
- Regla del proyecto: cada restricción lleva **el mismo nombre** en `models.py`, `scripts/init_db.sql` y la migración (`scripts/migrations/004_*.sql`), con diagnóstico de solo lectura, rollback y detección de «ya aplicada» en `scripts/deploy/desplegar_produccion.sh`.
- Los PIN están hasheados (`app/pinhash.py`); verificar PIN de admin con `verify_pin`, nunca comparar en claro.
- Frontend: sistema de UI en `components/ui/`, `ModalConfirm` (acepta `pedirMotivo`), pantallas en `pages/caja/`, navegación y roles en `config/navegacion.js` y `App.jsx`. Nunca `alert()`/`confirm()` nativos.
- Un `cajero` solo ve sus cajas; el `admin` ve todas.

## Reglas de proceso para el subagente

- TDD (rojo → verde) y **un commit por tarea**, en español, con el pie `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; stagea solo lo tuyo; sin push.
- Trabaja en un worktree propio desde `feat/cobro-caja` (p. ej. rama `feat/caja-profesional`), **no** en `integracion` ni en el checkout principal. Prohibido tocar `restaurant_pos` y los puertos 8000/5173 (producción). Para probar usa bases temporales que crees y borres, y puertos nuevos (API 8003, Vite 5176); detén por puerto con `kill $(lsof -tiTCP:PUERTO -sTCP:LISTEN)`, **nunca** con `pkill -f`.
- Migraciones: probar sobre una base construida con el `init_db.sql` previo y también con una caja heredada (patrón de `scripts/migrations/test_003_caja.sh`); repetir la aplicación; probar el rollback.
- Verificación: `pytest` completo en 0 fallos, `npm run lint`, `npm run build`, y navegador si es posible (usuario de prueba con PIN generado por ti, nunca PIN reales).
- Ante decisión ambigua o irreversible, detenerse y reportar en lugar de adivinar.

---

## Fase 1 — Dinero que cuadra (prioridad alta)

### Tarea 1.1 — Movimientos de efectivo (ingresos y egresos)
**Modelo** `caja_movimiento`: `id`, `caja_id` (FK `fk_caja_mov_caja`), `tipo` (`'ingreso'|'egreso'|'retiro'`, `ck_caja_mov_tipo`), `monto` NUMERIC(10,2) (`ck_caja_mov_monto`: `> 0`), `motivo` TEXT NOT NULL (`ck_caja_mov_motivo`: longitud 3–200), `usuario_id` (FK `fk_caja_mov_usuario`), `created_at`. Índice `idx_caja_mov_caja (caja_id)`. Sin UPDATE ni DELETE en la API.
**Reglas:**
- `POST /api/caja/movimientos` `{tipo, monto, motivo}` (cajero y admin): solo sobre **la caja abierta del usuario**; 409 «Abre la caja antes de registrar un movimiento» si no hay.
- Un `egreso` o `retiro` no puede superar el efectivo disponible en ese momento (fondo + efectivo cobrado + ingresos − egresos − retiros): 409 con el disponible en el mensaje.
- `monto_esperado` al cerrar = fondo + efectivo cobrado + ingresos − egresos − retiros (Decimal, 2 decimales). El resumen en vivo y el arqueo desglosan cada término.
- `GET /api/caja/actual` y `GET /api/caja/{id}` incluyen la lista de movimientos y sus totales.
**Tests:** monto ≤ 0 → 422; motivo corto → 422; sin caja → 409; egreso mayor al disponible → 409; el esperado cuadra con efectivo + tarjeta + ingresos + egresos + retiro mezclados; caja cerrada no admite movimientos; existencia y nombres de las restricciones en BD (patrón `tests/test_integridad_bd.py`); mensajes nuevos en `app/integridad.py`.
**Migración** `004_caja_movimientos.sql` (+ diagnóstico, rollback, `init_db.sql`, `models.py`, script de despliegue y su test `test_004_*.sh`).
**Frontend:** botones «Ingreso», «Egreso» y «Retiro» en el resumen de la caja abierta; modal con monto (teclado grande) y motivo; lista de movimientos del turno con hora, tipo, monto y usuario. Retiro e ingreso imprimen un comprobante interno corto (`@media print`).

### Tarea 1.2 — Conteo por denominaciones y teclado numérico
**Modelo:** `caja.conteo` JSONB NULL (p. ej. `{"200": 0, "100": 2, ..., "0.10": 3}`); denominaciones válidas fijas en una constante del backend: billetes 200, 100, 50, 20, 10 y monedas 5, 2, 1, 0.50, 0.20, 0.10.
**Reglas:** `POST /api/caja/cerrar` acepta `conteo` opcional; si viene, el servidor calcula la suma y debe ser **igual** a `monto_contado` (422 en caso contrario); cantidades enteras ≥ 0; denominaciones desconocidas → 422. Si no viene, se mantiene el comportamiento actual (monto único).
**Frontend:** componente reutilizable `components/ui/Keypad` (teclado numérico, objetivos ≥ 56 px) y un `ConteoDenominaciones` con +/− por denominación y total acumulado visible; sigue permitiendo ingresar el monto directo. El arqueo impreso muestra el conteo.
**Tests:** suma correcta e incorrecta, denominación inválida, cantidad negativa, conteo ausente.

### Tarea 1.3 — Cierre a ciegas
**Regla:** antes de confirmar el conteo el cajero no ve `monto_esperado` ni `diferencia`. `GET /api/caja/actual` **omite** `efectivo_esperado` para el rol `cajero` (el `admin` sí lo ve); el `POST /cerrar` devuelve el arqueo completo con esperado y diferencia **después** de cerrar. El resumen en vivo sigue mostrando ventas por método.
**Frontend:** el modal de cierre no muestra el esperado; el arqueo final lo muestra con «Faltan/Sobran S/ X.XX» (texto y color, no solo signo).
**Tests:** el cajero no recibe `efectivo_esperado` en `actual`; el admin sí; `cerrar` devuelve esperado y diferencia.
**Decisión abierta 1:** ¿ocultar solo el esperado (propuesto) o también el total de ventas en efectivo? El total de efectivo más el fondo permite deducir el esperado. **Propuesta:** ocultar solo el esperado; el control real es el conteo antes de ver el resultado.

### Tarea 1.4 — Tolerancia de diferencia y autorización de admin
**Modelo:** `caja.autorizado_por` (FK `fk_caja_autorizado_por`, nullable). Tolerancia por variable de entorno `CAJA_TOLERANCIA` (por defecto `2.00`), leída en un solo lugar.
**Reglas:** si `|diferencia| ≤ tolerancia`, se cierra solo con observaciones (si la diferencia ≠ 0, como hoy). Si `|diferencia| > tolerancia`, `POST /cerrar` exige `pin_autorizacion` de un usuario `admin` activo distinto del que cierra (verificado con `verify_pin`), registra `autorizado_por` y devuelve 403 «Diferencia fuera de tolerancia: requiere autorización de un administrador» si falta o es incorrecto. Si el que cierra ya es admin, el PIN de **otro** admin; si solo hay un admin en el sistema, se permite el suyo con motivo reforzado (decisión abierta 2).
**Decisión abierta 2:** con un solo administrador en el local, ¿se acepta su propio PIN? **Propuesta:** sí, con observaciones obligatorias de al menos 10 caracteres; queda registrado igual.
**Tests:** dentro de tolerancia, fuera sin PIN, con PIN incorrecto, con PIN de no-admin, con PIN válido, mismo usuario, intentos repetidos (el limitador de intentos existente debe aplicarse), y que el PIN nunca aparece en logs ni respuestas.
**Frontend:** modal que, ante diferencia fuera de tolerancia, pide el PIN del administrador y explica por qué.

### Entrega de la fase 1
Spec cumplido, migración `004` aplicada y probada (con y sin caja heredada), script de despliegue y `docs/despliegue-produccion.md` actualizados, pytest en 0 fallos, lint y build, verificación en navegador con rol cajero y admin, y reporte de qué no se verificó.

---

## Fase 2 — Claridad del turno y del día (prioridad media)

### Tarea 2.1 — Resumen completo
Por método: cantidad de operaciones además del monto. Ventas por tipo (boletas y facturas, cantidad e importe). Anulaciones y cancelaciones del turno (cantidad y quién, usando las columnas de rastro existentes). Descuentos concedidos. Todo calculado en el servidor.

### Tarea 2.2 — Pedidos sin cobrar al cerrar
Al cerrar, listar los pedidos abiertos (mesa, total, mozo) con aviso claro. **Decisión abierta 3:** ¿se permite cerrar con pedidos abiertos? **Propuesta:** sí, con una confirmación que nombre los pedidos; transferirlos a otra caja queda fuera de esta fase.

### Tarea 2.3 — Cierre del día (Z)
`GET /api/caja/dia?fecha=YYYY-MM-DD` (solo admin): todas las cajas del día, totales por método, movimientos, diferencia acumulada, número de cajas con diferencia. Zona horaria de Perú (no `date.today()` del servidor). Pantalla `/caja/dia` imprimible.

### Tarea 2.4 — Historial mejorado y reimpresión
Filtros por fecha, usuario y estado; paginación en la UI (el backend ya acepta `limit` y `offset`); reimpresión de cualquier arqueo.

**Fuera de la fase 2:** PDF descargable y envío por correo (requieren librería o servidor SMTP: decisión aparte).

---

## Fase 3 — Interfaz y controles (prioridad media-baja)

- **3.1 Estado de caja en la barra superior** de toda la app («Caja abierta desde 08:12 · S/ 100»), con refresco de 15 s.
- **3.2 Caja abierta de un día anterior:** aviso al iniciar sesión y obligación de cerrarla antes de abrir otra.
- **3.3 Auditoría de caja:** depende del bloque `auditoria` de `2026-10-02-cobro-seguro-design.md`; se especifica allí.
- **3.4 Candado de inmutabilidad en BD** para cajas cerradas (trigger que rechaza UPDATE/DELETE), con migración `005`, rollback y prueba.
- **3.5 Permiso propio de caja** (usando `rol.permisos`, hoy sin uso): requiere definir el modelo de permisos; **diferir** hasta decidirlo.

## Fuera de alcance (decidido)

Varias cajas por usuario o por estación; conciliación con bancos o billeteras; cierre automático por hora; edición de una caja cerrada (los errores se corrigen con un ajuste auditado, no reabriendo); integración contable.

## Decisiones abiertas para la persona usuaria

1. ¿Ocultar solo el esperado en el cierre a ciegas, o también el efectivo cobrado? (propuesta: solo el esperado).
2. Con un solo administrador, ¿se acepta su propio PIN para autorizar? (propuesta: sí, con observaciones de ≥ 10 caracteres).
3. ¿Se puede cerrar la caja con pedidos abiertos? (propuesta: sí, con confirmación que los nombre).
4. Tolerancia de diferencia: ¿S/ 2.00 es adecuada para este local? (configurable por `CAJA_TOLERANCIA`).
5. ¿Qué denominaciones y monedas usa realmente el local? (se asume la serie peruana estándar).

## Riesgos y cómo se contienen

- **Migración sobre producción con tablas heredadas:** comprobar colisiones de nombres antes de crear; probar siempre sobre base con esquema heredado además de la limpia.
- **Dinero en coma flotante:** todo el cálculo con `Decimal` y 2 decimales; tests con importes que fallarían en `float` (p. ej. 0.10 + 0.20).
- **Ocultar el esperado solo en la UI no basta:** el servidor no debe enviar el campo al cajero.
- **PIN de autorización:** nunca registrar el PIN; limitar intentos; no mostrar cuál admin existe.
