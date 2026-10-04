# Despliegue a producción: integridad de BD, anulación con rastro, PIN con hash, caja/arqueo y movimientos de caja

Script: `scripts/deploy/desplegar_produccion.sh` · Rama: `integracion/ui-profesional-integridad`

## Qué cambia en producción

- La base `restaurant_pos` recibe restricciones nuevas (migración `001`), columnas de rastro de anulación (`002_anulacion_rastro`) y los PIN pasan a **hash scrypt** (`002_pin_hash` + `002_hashear_pins.py`).
- Migración `003_caja` (tabla `caja` y `comprobante.caja_id`): agrega el turno de caja con arqueo. Es solo aditiva (no toca datos; los comprobantes históricos quedan sin caja) e idempotente.
- Migración `004_caja_movimientos` (requiere la 003): tabla `caja_movimiento` (ingresos, egresos y retiros de efectivo del turno) y las columnas `caja.conteo` (JSONB) y `caja.autorizado_por`. Solo aditiva e idempotente; no toca datos. Si algún nombre de la 004 ya existe con otra forma, **aborta sin cambios**.
- **Caja profesional (fase 1):** el efectivo esperado pasa a ser fondo + efectivo cobrado + ingresos − egresos − retiros (calculado solo en el servidor); el cajero cierra **a ciegas** (la API no le envía el esperado mientras la caja está abierta; el admin sí lo ve); el cierre acepta conteo por denominaciones; una diferencia mayor a `CAJA_TOLERANCIA` exige el PIN de un administrador (ver más abajo).
- **Desde este cambio, cobrar exige una caja abierta del cajero/admin que cobra** (`409 «Abre la caja antes de cobrar»`). Avisa al personal: la primera acción del turno es abrir caja en `/caja`.
- El cobro pasa a ser una sola llamada atómica (`POST /api/pedidos/{id}/cobrar`) con el pago validado en el servidor; `PUT /cerrar` y `POST /api/comprobantes` quedan obsoletos pero siguen funcionando.
- El código nuevo **ya no acepta PIN en claro**: si arranca antes de migrar, nadie entra.
- **El hash del PIN no es reversible.** La única vuelta atrás es restaurar el respaldo.
- Los usuarios entran con **el mismo PIN de siempre**; solo cambia cómo se guarda.

## Antes de empezar

- Hacerlo cuando no haya pedidos abiertos (el script avisa si los hay; la migración no los modifica, pero la API se detiene unos minutos).
- Tener a mano el comando con el que arrancas la API (con su `SECRET_KEY`). El script **no** lo toca. Si cambias la `SECRET_KEY`, las sesiones abiertas caen.
- Tu trabajo sin commitear no se pierde: el código nuevo corre desde la rama de integración; ver el paso 5.

## Pasos

```bash
cd <repo>   # carpeta que contiene scripts/deploy (worktree .claude/worktrees/integracion)

# 1) Respaldo + diagnóstico (solo lectura; la API puede seguir corriendo)
./scripts/deploy/desplegar_produccion.sh pre
#    Debe terminar con "Respaldo verificado" y "Diagnóstico 001 vacío"
#    (el diagnóstico 003 es informativo: no tiene filas que bloqueen).
#    Si el diagnóstico devuelve filas, se detiene: corrígelas a mano y repite.

# 2) Detén la API de producción (tú, con tu método habitual).

# 3) Migrar (exige --confirmar, respaldo de menos de 30 min y cero conexiones abiertas)
./scripts/deploy/desplegar_produccion.sh migrar --confirmar

# 4) Verificar la base
./scripts/deploy/desplegar_produccion.sh verificar

# 5) Arranca la API y el frontend con el CÓDIGO NUEVO (rama integracion/ui-profesional-integridad),
#    con tu SECRET_KEY de siempre y CORS_ORIGINS que incluya el origen del frontend.
#    Luego comprueba el login:
API_URL=http://localhost:8000 ./scripts/deploy/desplegar_produccion.sh verificar
```

Variables opcionales: `PGDATABASE` (por defecto `restaurant_pos`), `PGUSER`, `PGHOST`, `PGPORT`, `PGPASSWORD`, `RESPALDOS` (por defecto `~/backups-orbezo`), `PYTHON`.

## Atención: caja heredada en producción

Producción ya tiene una tabla `orbezo.caja` **heredada y distinta** (columnas `monto_apertura`, `total_efectivo`, `apertura_en`...; con `orbezo.pago` apuntándole), con 0 filas. La 003 la detecta: si está vacía la renombra a `orbezo.caja_legada` (con su pkey, secuencia y constraints; `pago_caja_id_fkey` sigue apuntando a ella) y crea la nueva; si tiene filas, **aborta sin cambiar nada** (nunca borra ni migra datos de caja). `pre` muestra la advertencia y `verificar` exige la forma nueva (`monto_inicial`) sin columnas heredadas. El rollback devuelve la heredada con sus nombres originales. Prueba automatizada en bases temporales: `scripts/migrations/test_003_caja.sh`. `scripts/migrations/colisiones_diagnostico.sql` (solo lectura) lista cualquier otro nombre de 001-003 que ya exista en la base, con su definición.

## Migración 003 por separado (si la quieres aplicar a mano)

```bash
psql -h HOST -U USER -d BD -f scripts/migrations/003_caja_diagnostico.sql   # solo lectura
psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja.sql
psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja_rollback.sql   # DESTRUCTIVO: borra cajas y arqueos
```

El script `migrar` ya la aplica (detecta si la tabla `caja` y `comprobante.caja_id` existen y la omite). `verificar` comprueba la tabla, `uq_caja_abierta_por_usuario`, los tres `ck_caja_*` y `fk_comprobante_caja`.

## Migración 004 (movimientos de caja) y configuración nueva

```bash
psql -h HOST -U USER -d BD -f scripts/migrations/004_caja_movimientos_diagnostico.sql   # solo lectura
psql -h HOST -U USER -d BD -f scripts/migrations/colisiones_diagnostico.sql             # solo lectura: nombres ya existentes (incluye los de la 004)
psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/004_caja_movimientos.sql
psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/004_caja_movimientos_rollback.sql   # DESTRUCTIVO: borra los movimientos y los conteos/autorizaciones de los cierres
```

- `migrar` la aplica después de la 003 y la detecta como «ya aplicada» solo si existen la tabla `caja_movimiento` **y** las dos columnas nuevas de `caja`. `pre` ejecuta su diagnóstico; `verificar` comprueba `ck_caja_mov_tipo`, `ck_caja_mov_monto`, `ck_caja_mov_motivo`, `fk_caja_mov_caja`, `fk_caja_mov_usuario`, `idx_caja_mov_caja`, `fk_caja_autorizado_por` y que no haya movimientos inválidos.
- **Estado real de producción tras la 003**: la tabla `caja` nueva convive con `caja_legada` y `pago` (que apunta a `caja_legada`). La 004 no toca ninguna de las dos; nombres confirmados libres: `caja_movimiento`, `idx_caja_mov_caja`, `caja.conteo`, `caja.autorizado_por`. Si la base aún no tiene la 003 (caja heredada), la 004 **aborta** pidiendo aplicarla primero.
- Prueba automatizada en bases temporales (limpia previa a la 004, estado de producción tras la 003, reaplicada, rollback, colisiones, 003 ausente y comparación con `init_db.sql`): `scripts/migrations/test_004_caja_movimientos.sh`.
- **Rollback con cajas abiertas:** al quitar la tabla los movimientos se pierden y el esperado de las cajas abiertas dejaría de cuadrar. Haz el rollback solo con las cajas cerradas.
- **`CAJA_TOLERANCIA`** (variable de entorno de la API, por defecto `2.00`): diferencia máxima, en soles, con la que se cierra sin PIN de administrador. Debe ser un número ≥ 0 con máximo 2 decimales; si es inválida **la API no arranca** y el mensaje lo dice. Se lee una sola vez, al arrancar.
- **Autorización de una diferencia grande:** con más de un administrador activo, el PIN debe ser de **otro** administrador distinto de quien cierra; con un solo administrador se acepta su propio PIN y las observaciones deben tener al menos 10 caracteres. Tras 5 PIN erróneos seguidos el usuario queda bloqueado 15 minutos (limitador en memoria, válido para una sola instancia de la API).
- Los PIN de autorización nunca se registran ni se devuelven.

## Datos del emisor en el comprobante impreso (opcional)

El comprobante (A4 y ticket de 80 mm) imprime el encabezado del emisor desde variables de entorno **de build** del frontend. No hay RUC, dirección ni teléfono por defecto: solo se imprime lo que definas.

| Variable | Qué imprime |
|---|---|
| `VITE_EMISOR_NOMBRE` | Nombre comercial (por defecto «Orbezo Resto Bar») |
| `VITE_EMISOR_RUC` | Línea «RUC: ...» (si no la defines, no se muestra) |
| `VITE_EMISOR_DIRECCION` | Dirección del local |
| `VITE_EMISOR_TELEFONO` | Teléfono |
| `VITE_EMISOR_LOGO` | Ruta o URL de un logo (p. ej. `/logo.png` con el archivo en `frontend_react/public/`) |
| `VITE_COMPROBANTE_LEYENDA` | Línea discreta al pie (p. ej. «Documento interno»); vacía por defecto |

Se definen en el `.env` de la raíz (docker compose las pasa como `build args`) o en `frontend_react/.env.local` (desarrollo; ver `frontend_react/.env.example`). Como son de build, **hay que reconstruir el frontend** (`docker compose up --build frontend`) para que cambien. El sistema **no envía a SUNAT**, por eso el documento no dice «electrónico», ni lleva QR, hash ni «autorizado mediante resolución».

El nombre de archivo que propone «Guardar como PDF» es «Boleta B001-000001» / «Factura F001-000001». El diálogo de impresión del navegador ofrece el formato A4 o Ticket 80 mm (se elige en la pantalla antes de imprimir; para el ticket, en el diálogo elige tu impresora térmica y márgenes «Ninguno»).

## Prueba manual después del despliegue

1. Entrar con tu PIN de siempre (admin) y con uno de mozo.
2. Mesas: se ven agrupadas por salón y se puede abrir una mesa.
3. Comanda: enviar un ítem a cocina; anular un pedido propio vacío (pide motivo).
4. Como mozo: no puede anular un pedido ajeno ni uno con ítems en cocina (botón deshabilitado y 403 del servidor).
5. Cajero: sin caja abierta, Cobro muestra el aviso y no deja cobrar; en `/caja` abrir con un fondo, cobrar una mesa y ver el resumen; cerrar caja con el efectivo contado (con diferencia pide observaciones) e imprimir el arqueo. Admin ve el historial de cajas.
6. Caja (cajero): registrar un ingreso, un egreso y un retiro (el retiro/ingreso imprime su comprobante interno); el resumen no muestra el efectivo esperado; cerrar contando por denominaciones y ver en el arqueo el esperado y «Faltan/Sobran S/ X.XX». Con una diferencia mayor a la tolerancia, el cierre pide el PIN de un administrador. Admin: ve el esperado de las cajas abiertas.
7. Admin → Comprobantes: abrir el detalle de uno y probar Imprimir en A4 y en Ticket 80 mm (vista previa de impresión).

## Si algo sale mal

```bash
./scripts/deploy/desplegar_produccion.sh restaurar    # imprime los comandos, no ejecuta nada
```

1. Detener la API.
2. Restaurar el respaldo en una base nueva, comprobarla y renombrarla (el script imprime los comandos exactos).
3. Arrancar el código anterior (`feat/ui-profesional` en `87a5a80`, que valida PIN en claro).

## Seguridad del respaldo

El `.dump` contiene los PIN **en texto plano** de antes de la migración. Se guarda con permisos `600` en una carpeta `700`. Bórralo cuando el despliegue esté validado y ya no lo necesites.

## Qué hace (y qué no) el script

- Cada fase es independiente y se detiene ante el primer error (`set -euo pipefail`, `ON_ERROR_STOP`).
- Es **idempotente**: detecta qué migraciones ya están aplicadas y las omite; el hash de PIN omite los ya hasheados.
- **No** detiene ni arranca la API, **no** lee ni escribe `SECRET_KEY`, **no** borra ni corrige datos.
