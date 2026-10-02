#!/usr/bin/env bash
# Despliegue de las migraciones de integridad, anulación con rastro y PIN con hash.
# Guía completa: docs/despliegue-produccion.md
#
# Fases (se ejecutan por separado, en este orden):
#   pre        Solo lectura + respaldo: estado, diagnóstico (debe salir vacío) y pg_dump verificado.
#   migrar     Requiere --confirmar. Aplica 001 + 002 (SQL) y hashea los PIN. EXIGE la API detenida.
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
  info "Estado de migraciones: 001=$(ya_001 && echo aplicada || echo pendiente) | 002 anulación=$(ya_002a && echo aplicada || echo pendiente) | PIN hasheados=$(pins_hash) en claro=$(pins_claro)"
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
