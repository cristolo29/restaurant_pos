# Despliegue a producción: integridad de BD, anulación con rastro y PIN con hash

Script: `scripts/deploy/desplegar_produccion.sh` · Rama: `integracion/ui-profesional-integridad`

## Qué cambia en producción

- La base `restaurant_pos` recibe restricciones nuevas (migración `001`), columnas de rastro de anulación (`002_anulacion_rastro`) y los PIN pasan a **hash scrypt** (`002_pin_hash` + `002_hashear_pins.py`).
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
#    Debe terminar con "Respaldo verificado" y "Diagnóstico 001 vacío".
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

## Prueba manual después del despliegue

1. Entrar con tu PIN de siempre (admin) y con uno de mozo.
2. Mesas: se ven agrupadas por salón y se puede abrir una mesa.
3. Comanda: enviar un ítem a cocina; anular un pedido propio vacío (pide motivo).
4. Como mozo: no puede anular un pedido ajeno ni uno con ítems en cocina (botón deshabilitado y 403 del servidor).
5. Admin → Comprobantes: abrir el detalle de uno y probar Imprimir (Cmd+P).

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
