# Despliegue a producción: integridad de BD, anulación con rastro, PIN con hash y caja/arqueo

Script: `scripts/deploy/desplegar_produccion.sh` · Rama: `integracion/ui-profesional-integridad`

## Qué cambia en producción

- La base `restaurant_pos` recibe restricciones nuevas (migración `001`), columnas de rastro de anulación (`002_anulacion_rastro`) y los PIN pasan a **hash scrypt** (`002_pin_hash` + `002_hashear_pins.py`).
- Migración `003_caja` (tabla `caja` y `comprobante.caja_id`): agrega el turno de caja con arqueo. Es solo aditiva (no toca datos; los comprobantes históricos quedan sin caja) e idempotente.
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

## Migración 003 por separado (si la quieres aplicar a mano)

```bash
psql -h HOST -U USER -d BD -f scripts/migrations/003_caja_diagnostico.sql   # solo lectura
psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja.sql
psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja_rollback.sql   # DESTRUCTIVO: borra cajas y arqueos
```

El script `migrar` ya la aplica (detecta si la tabla `caja` y `comprobante.caja_id` existen y la omite). `verificar` comprueba la tabla, `uq_caja_abierta_por_usuario`, los tres `ck_caja_*` y `fk_comprobante_caja`.

## Prueba manual después del despliegue

1. Entrar con tu PIN de siempre (admin) y con uno de mozo.
2. Mesas: se ven agrupadas por salón y se puede abrir una mesa.
3. Comanda: enviar un ítem a cocina; anular un pedido propio vacío (pide motivo).
4. Como mozo: no puede anular un pedido ajeno ni uno con ítems en cocina (botón deshabilitado y 403 del servidor).
5. Cajero: sin caja abierta, Cobro muestra el aviso y no deja cobrar; en `/caja` abrir con un fondo, cobrar una mesa y ver el resumen; cerrar caja con el efectivo contado (con diferencia pide observaciones) e imprimir el arqueo. Admin ve el historial de cajas.
6. Admin → Comprobantes: abrir el detalle de uno y probar Imprimir (Cmd+P).

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
