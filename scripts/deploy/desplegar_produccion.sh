#!/usr/bin/env bash
# Despliegue de las migraciones de integridad, anulación con rastro, PIN con hash, caja/arqueo (003) y
# movimientos de caja con conteo y autorización (004).
# Guía completa: docs/despliegue-produccion.md
#
# Fases (se ejecutan por separado, en este orden):
#   pre        Solo lectura + respaldo: estado, diagnóstico (debe salir vacío) y pg_dump verificado.
#   migrar     Requiere --confirmar. Aplica 001 + 002 + 003 + 004 (SQL) y hashea los PIN. EXIGE la API detenida.
#   verificar  Solo lectura: comprueba restricciones, columnas y que no quede ningún PIN en claro.
#   restaurar  Imprime el comando para volver al respaldo (no ejecuta nada).
#
# Variables (opcionales): PGDATABASE (def. restaurant_pos), PGUSER (def. $USER), PGHOST, PGPORT,
#   PGPASSWORD, RESPALDOS (def. ~/backups-orbezo), PYTHON (def. python del venv del repo o python3),
#   API_URL (def. vacío; si se define, 'verificar' prueba que un PIN incorrecto devuelve 401).
# Este script no lee ni escribe SECRET_KEY, y no detiene ni arranca la API.
set -euo pipefail

FASE="${1:-}"; shift || true
CONFIRMAR=0; for a in "$@"; do [ "$a" = "--confirmar" ] && CONFIRMAR=1; done

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIG="$RAIZ/scripts/migrations"
BD="${PGDATABASE:-restaurant_pos}"
USUARIO="${PGUSER:-${USER:-postgres}}"
RESPALDOS="${RESPALDOS:-$HOME/backups-orbezo}"
MARCA="$RESPALDOS/.ultimo_respaldo_$BD"
PYTHON="${PYTHON:-$RAIZ/../../../venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON=python3   # necesita sqlalchemy y psycopg2 (el del venv del proyecto los tiene)
export PGDATABASE="$BD" PGUSER="$USUARIO"

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$BD" -U "$USUARIO")
q() { "${PSQL[@]}" -At -c "$1"; }          # una consulta, salida limpia
ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
info() { printf '  • %s\n' "$*"; }
fallo(){ printf '  \033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }
titulo(){ printf '\n== %s\n' "$*"; }

ya_001()  { [ "$(q "select count(*) from pg_constraint where conname='uq_mesa_salon_numero'")" -gt 0 ]; }
ya_002a() { [ "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='pedido' and column_name='anulado_por'")" -gt 0 ]; }
ya_003()  { [ "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name='monto_inicial'")" -gt 0 ] && [ "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='comprobante' and column_name='caja_id'")" -gt 0 ]; }
ya_004()  { [ "$(q "select count(*) from information_schema.tables where table_schema='orbezo' and table_name='caja_movimiento'")" -gt 0 ] && [ "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name in ('conteo','autorizado_por')")" = 2 ]; }
caja_heredada() { [ "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name='monto_apertura'")" -gt 0 ] && [ "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name='monto_inicial'")" = 0 ]; }
pin_ancho() { q "select character_maximum_length from information_schema.columns where table_schema='orbezo' and table_name='usuario' and column_name='pin'"; }
pins_claro() { q "select count(*) from orbezo.usuario where pin is not null and pin !~ '^scrypt\\$'"; }
pins_hash()  { q "select count(*) from orbezo.usuario where pin like 'scrypt\$%'"; }
conexiones_ajenas() { q "select count(*) from pg_stat_activity where datname='$BD' and pid<>pg_backend_pid()"; }

conectar() {
  q "select 1" >/dev/null 2>&1 || fallo "No puedo conectar a la base '$BD' como '$USUARIO'. Revisa PGDATABASE/PGUSER/PGHOST/PGPASSWORD."
  [ "$(q "select count(*) from information_schema.schemata where schema_name='orbezo'")" = "1" ] || fallo "La base '$BD' no tiene el esquema orbezo."
  ok "Conectado a '$BD' como '$USUARIO'"
}

fase_pre() {
  titulo "PRE · estado y respaldo de '$BD' (solo lectura + pg_dump)"
  conectar
  info "Código: $(git -C "$RAIZ" branch --show-current 2>/dev/null) @ $(git -C "$RAIZ" log --oneline -1 2>/dev/null | cut -c1-70)"
  info "Estado de migraciones: 001=$(ya_001 && echo aplicada || echo pendiente) | 002 anulación=$(ya_002a && echo aplicada || echo pendiente) | 003 caja=$(ya_003 && echo aplicada || echo pendiente) | 004 movimientos=$(ya_004 && echo aplicada || echo pendiente) | PIN hasheados=$(pins_hash) en claro=$(pins_claro)"
  info "Pedidos: $(q "select string_agg(estado||'='||n, ', ') from (select estado, count(*) n from orbezo.pedido group by 1 order by 1) t")"
  abiertos=$(q "select count(*) from orbezo.pedido where estado='abierto'")
  if [ "$abiertos" -gt 0 ]; then
    printf '  \033[33m⚠ Hay %s pedido(s) abierto(s). La migración no los modifica, pero quien los esté atendiendo verá un corte.\033[0m\n' "$abiertos"
    "${PSQL[@]}" -c "select p.id as pedido, m.numero as mesa, p.total, p.created_at from orbezo.pedido p join orbezo.mesa m on m.id=p.mesa_id where p.estado='abierto' order by p.id"
  fi

  titulo "Diagnóstico 001 (cada fila impediría la migración)"
  if ya_001; then ok "001 ya aplicada: no se vuelve a diagnosticar"; else
    out="$("${PSQL[@]}" -At -f "$MIG/001_diagnostico.sql")"
    [ -z "$out" ] || { printf '%s\n' "$out"; fallo "El diagnóstico 001 devolvió filas (arriba). Corrígelas a mano antes de migrar; el script no toca datos."; }
    ok "Diagnóstico 001 vacío"
  fi
  titulo "Diagnóstico 002 anulación (informativo)"
  "${PSQL[@]}" -f "$MIG/002_anulacion_diagnostico.sql" | sed 's/^/  /'
  titulo "Colisiones de nombres con objetos existentes (informativo)"
  "${PSQL[@]}" -f "$MIG/colisiones_diagnostico.sql" | sed 's/^/  /'
  titulo "Diagnóstico 003 caja"
  if caja_heredada; then
    filas=$(q "select count(*) from orbezo.caja")
    printf '  \033[33m⚠ orbezo.caja existe con la forma HEREDADA (monto_apertura), %s fila(s).\033[0m\n' "$filas"
    if [ "$filas" = 0 ]; then info "La migración 003 la renombrará a caja_legada (sin perder nada) y creará la caja nueva."
    else printf '  \033[31m✘ Tiene datos: la migración 003 ABORTARÁ sin cambios. Decide a mano qué hacer con ellos antes de migrar.\033[0m\n'; fi
  fi
  "${PSQL[@]}" -f "$MIG/003_caja_diagnostico.sql" | sed 's/^/  /'
  titulo "Diagnóstico 004 movimientos de caja"
  if ya_003 || ya_004; then "${PSQL[@]}" -f "$MIG/004_caja_movimientos_diagnostico.sql" | sed 's/^/  /'
  else info "La 004 exige la caja de forma nueva (003): se aplicará después de la 003 en 'migrar'. Diagnóstico omitido (no hay caja nueva que consultar)."; fi

  titulo "Respaldo"
  mkdir -p "$RESPALDOS"; chmod 700 "$RESPALDOS"
  archivo="$RESPALDOS/${BD}_pre_despliegue_$(date +%Y%m%d_%H%M%S).dump"
  pg_dump -U "$USUARIO" -d "$BD" -Fc -f "$archivo"
  chmod 600 "$archivo"
  pg_restore --list "$archivo" >/dev/null || fallo "El respaldo $archivo no se puede leer. NO continúes."
  printf '%s %s\n' "$(date +%s)" "$archivo" > "$MARCA"
  ok "Respaldo verificado: $archivo ($(du -h "$archivo" | cut -f1))"
  info "AVISO: el respaldo contiene los PIN en texto plano. Guárdalo en lugar seguro y bórralo cuando ya no lo necesites."
  titulo "Siguiente paso"
  info "1) Detén la API de producción (el comando lo conoces tú)  2) $0 migrar --confirmar"
}

fase_migrar() {
  titulo "MIGRAR · '$BD'"
  [ "$CONFIRMAR" = 1 ] || fallo "Falta --confirmar. Esta fase modifica la base (el hash del PIN no es reversible sin el respaldo)."
  conectar
  # 1) respaldo reciente
  [ -f "$MARCA" ] || fallo "No hay respaldo registrado. Ejecuta primero: $0 pre"
  read -r ts archivo < "$MARCA"
  [ -f "$archivo" ] || fallo "El respaldo registrado no existe: $archivo. Ejecuta de nuevo: $0 pre"
  edad=$(( $(date +%s) - ts ))
  [ "$edad" -le 1800 ] || fallo "El último respaldo tiene $((edad/60)) min (máximo 30). Ejecuta de nuevo: $0 pre"
  ok "Respaldo reciente ($((edad/60)) min): $archivo"
  # 2) API detenida
  n=$(conexiones_ajenas)
  if [ "$n" -gt 0 ]; then
    "${PSQL[@]}" -c "select pid, usename, application_name, state, client_addr from pg_stat_activity where datname='$BD' and pid<>pg_backend_pid()"
    fallo "Hay $n conexión(es) abiertas a '$BD'. Detén la API (y cualquier cliente) y reintenta."
  fi
  ok "Sin otras conexiones: la API está detenida"

  titulo "001 · integridad (restricciones)"
  if ya_001; then info "ya aplicada, se omite"; else "${PSQL[@]}" -f "$MIG/001_integridad.sql"; ok "001 aplicada"; fi
  titulo "002 · anulación con rastro"
  if ya_002a; then info "ya aplicada, se omite"; else "${PSQL[@]}" -f "$MIG/002_anulacion_rastro.sql"; ok "002 anulación aplicada"; fi
  titulo "003 · caja y arqueo"
  if ya_003; then info "ya aplicada, se omite"; else "${PSQL[@]}" -f "$MIG/003_caja.sql"; ok "003 caja aplicada"; fi
  titulo "004 · movimientos de caja, conteo y autorización"
  if ya_004; then info "ya aplicada, se omite"; else "${PSQL[@]}" -f "$MIG/004_caja_movimientos.sql"; ok "004 movimientos aplicada"; fi
  titulo "002 · columna del PIN"
  if [ "$(pin_ancho)" -ge 255 ]; then info "ya es VARCHAR(255), se omite"; else "${PSQL[@]}" -f "$MIG/002_pin_hash.sql"; ok "columna ampliada"; fi
  titulo "002 · hash de PIN (transacción única, idempotente)"
  DATABASE_URL="postgresql:///${BD}?user=${USUARIO}" "$PYTHON" "$MIG/002_hashear_pins.py" --confirmar
  titulo "Siguiente paso"
  info "$0 verificar   y luego arranca la API/frontend con el código nuevo (rama integracion/ui-profesional-integridad)."
}

fase_verificar() {
  titulo "VERIFICAR · '$BD' (solo lectura)"
  conectar; fallos=0
  chk() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else printf '  \033[31m✘ %s: esperado %s, obtenido %s\033[0m\n' "$1" "$3" "$2" >&2; fallos=$((fallos+1)); fi; }
  chk "Restricciones de integridad (fk_/uq_/ck_), mínimo 24" "$([ "$(q "select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='orbezo' and c.conname ~ '^(fk_|uq_|ck_)'")" -ge 24 ] && echo si || echo no)" "si"
  chk "uq_mesa_salon_numero" "$(q "select count(*) from pg_constraint where conname='uq_mesa_salon_numero'")" "1"
  chk "uq_pedido_abierto_por_mesa (índice)" "$(q "select count(*) from pg_indexes where indexname='uq_pedido_abierto_por_mesa'")" "1"
  chk "ck_pedido_anulacion" "$(q "select count(*) from pg_constraint where conname='ck_pedido_anulacion'")" "1"
  chk "ck_pedido_item_cancelacion" "$(q "select count(*) from pg_constraint where conname='ck_pedido_item_cancelacion'")" "1"
  chk "columna pedido.anulado_por" "$(ya_002a && echo 1 || echo 0)" "1"
  chk "orbezo.caja tiene la forma nueva (monto_inicial)" "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name='monto_inicial'")" "1"
  chk "orbezo.caja sin columnas heredadas (monto_apertura, apertura_en, total_efectivo...)" "$(q "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name in ('monto_apertura','monto_cierre','apertura_en','cierre_en','total_efectivo','total_tarjeta','total_yape','total_plin','total_otros','observacion')")" "0"
  chk "uq_caja_abierta_por_usuario (índice)" "$(q "select count(*) from pg_indexes where indexname='uq_caja_abierta_por_usuario'")" "1"
  chk "restricciones de caja (ck_caja_estado, ck_caja_montos, ck_caja_cierre)" "$(q "select count(*) from pg_constraint where conname in ('ck_caja_estado','ck_caja_montos','ck_caja_cierre')")" "3"
  chk "columna comprobante.caja_id con fk_comprobante_caja" "$(q "select count(*) from pg_constraint where conname='fk_comprobante_caja'")" "1"
  chk "tabla caja_movimiento con idx_caja_mov_caja" "$(q "select (select count(*) from information_schema.tables where table_schema='orbezo' and table_name='caja_movimiento') + (select count(*) from pg_indexes where indexname='idx_caja_mov_caja' and tablename='caja_movimiento')")" "2"
  chk "restricciones de movimientos (ck_caja_mov_tipo/monto/motivo, fk_caja_mov_caja/usuario)" "$(q "select count(*) from pg_constraint where conrelid='orbezo.caja_movimiento'::regclass and conname in ('ck_caja_mov_tipo','ck_caja_mov_monto','ck_caja_mov_motivo','fk_caja_mov_caja','fk_caja_mov_usuario')")" "5"
  chk "columnas caja.conteo y caja.autorizado_por con fk_caja_autorizado_por" "$(q "select (select count(*) from information_schema.columns where table_schema='orbezo' and table_name='caja' and column_name in ('conteo','autorizado_por')) + (select count(*) from pg_constraint where conname='fk_caja_autorizado_por' and conrelid='orbezo.caja'::regclass)")" "3"
  chk "Movimientos de caja con monto <= 0 o tipo inválido" "$(q "select count(*) from orbezo.caja_movimiento where monto <= 0 or tipo not in ('ingreso','egreso','retiro')")" "0"
  chk "Usuarios con más de una caja abierta" "$(q "select count(*) from (select 1 from orbezo.caja where estado='abierta' group by usuario_id having count(*)>1) t")" "0"
  chk "usuario.pin es VARCHAR(255)" "$(pin_ancho)" "255"
  chk "PIN en texto plano restantes" "$(pins_claro)" "0"
  chk "Pedidos anulados sin motivo" "$(q "select count(*) from orbezo.pedido where estado='anulado' and motivo_anulacion is null")" "0"
  info "PIN hasheados: $(pins_hash) | usuarios: $(q "select count(*) from orbezo.usuario")"
  if [ -n "${API_URL:-}" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/api/login" -H 'content-type: application/json' -d '{"pin":"000000"}' || true)
    chk "API: un PIN incorrecto responde 401" "$code" "401"
  else info "API_URL no definida: omito la prueba de login (define API_URL=http://localhost:8000 tras arrancar la API)"; fi
  [ "$fallos" = 0 ] || fallo "$fallos comprobación(es) fallaron. NO des el despliegue por bueno; considera restaurar: $0 restaurar"
  titulo "Todo correcto"
}

fase_restaurar() {
  titulo "RESTAURAR (solo imprime; no ejecuta)"
  [ -f "$MARCA" ] && read -r _ archivo < "$MARCA" || archivo="<archivo .dump>"
  cat <<EOF
  1) Detén la API y todo cliente de '$BD'.
  2) Restaura sobre una base vacía (más seguro que sobre la actual):
       createdb -U $USUARIO ${BD}_restaurada
       pg_restore -U $USUARIO -d ${BD}_restaurada --no-owner "$archivo"
     y comprueba los datos. Cuando estés conforme:
       psql -U $USUARIO -d postgres -c "ALTER DATABASE $BD RENAME TO ${BD}_fallida"
       psql -U $USUARIO -d postgres -c "ALTER DATABASE ${BD}_restaurada RENAME TO $BD"
  3) Vuelve a arrancar el código ANTERIOR (rama feat/ui-profesional en 87a5a80, que valida PIN en claro).
  Nota: el respaldo contiene PIN en claro; protégelo.
EOF
}

case "$FASE" in
  pre) fase_pre ;; migrar) fase_migrar ;; verificar) fase_verificar ;; restaurar) fase_restaurar ;;
  *) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
