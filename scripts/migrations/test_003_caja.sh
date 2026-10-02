#!/usr/bin/env bash
# Prueba la migración 003 en bases TEMPORALES (las crea y las borra). No toca ninguna otra base.
# Estado previo = scripts/init_db.sql del commit fbd16da. Uso: scripts/migrations/test_003_caja.sh
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
M="$RAIZ/scripts/migrations"; PREVIO="$(mktemp)"; git -C "$RAIZ" show fbd16da:scripts/init_db.sql > "$PREVIO"
USUARIO="${PGUSER:-$USER}"; export PGUSER="$USUARIO"; fallos=0
nueva() { dropdb --if-exists "$1" 2>/dev/null; createdb "$1"; psql -X -q -v ON_ERROR_STOP=1 -d "$1" -f "$PREVIO" >/dev/null; }
sql()  { psql -X -At -d "$1" -c "$2"; }
mig()  { psql -X -q -v ON_ERROR_STOP=1 -d "$1" -f "$M/$2" 2>&1; }
chk()  { if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FALLA $1: esperado '$3', obtenido '$2'"; fallos=$((fallos+1)); fi; }
tiene() { sql "$1" "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='$2' and column_name='$3'"; }
DBS="tmp_t003_a tmp_t003_b tmp_t003_c"; trap 'for d in $DBS; do dropdb --if-exists $d 2>/dev/null; done; rm -f "$PREVIO"' EXIT

echo "(a) caja heredada VACÍA -> se renombra y se crea la nueva"
nueva tmp_t003_a; psql -X -q -d tmp_t003_a -f "$M/003_caja_legada_fixture.sql"
mig tmp_t003_a 003_caja_diagnostico.sql | grep -E "VACIA" >/dev/null && echo "  ok   diagnóstico anuncia el renombrado" || { echo "  FALLA diagnóstico"; fallos=$((fallos+1)); }
mig tmp_t003_a 003_caja.sql >/dev/null
chk "caja tiene monto_inicial" "$(tiene tmp_t003_a caja monto_inicial)" 1
chk "caja ya no tiene monto_apertura" "$(tiene tmp_t003_a caja monto_apertura)" 0
chk "caja_legada conserva monto_apertura" "$(tiene tmp_t003_a caja_legada monto_apertura)" 1
chk "pago_caja_id_fkey intacta y apunta a caja_legada" "$(sql tmp_t003_a "select confrelid::regclass from pg_constraint where conname='pago_caja_id_fkey'")" "orbezo.caja_legada"
chk "constraints legados renombrados" "$(sql tmp_t003_a "select count(*) from pg_constraint where conname in ('caja_legada_estado_check','caja_legada_usuario_id_fkey')")" 2
chk "índice único de caja nueva" "$(sql tmp_t003_a "select count(*) from pg_indexes where indexname='uq_caja_abierta_por_usuario' and tablename='caja'")" 1
chk "fk_comprobante_caja -> caja nueva" "$(sql tmp_t003_a "select confrelid::regclass from pg_constraint where conname='fk_comprobante_caja'")" "orbezo.caja"
echo "(c) reaplicar la migración"
mig tmp_t003_a 003_caja.sql >/dev/null; chk "reaplicar sin error" "$?" 0
chk "caja_legada sigue una sola vez" "$(sql tmp_t003_a "select count(*) from information_schema.tables where table_schema='orbezo' and table_name in ('caja','caja_legada')")" 2
echo "(d) rollback devuelve la heredada con sus nombres"
mig tmp_t003_a 003_caja_rollback.sql >/dev/null; chk "rollback sin error" "$?" 0
chk "caja vuelve a ser la heredada" "$(tiene tmp_t003_a caja monto_apertura)" 1
chk "sin monto_inicial" "$(tiene tmp_t003_a caja monto_inicial)" 0
chk "nombres originales" "$(sql tmp_t003_a "select count(*) from pg_constraint where conname in ('caja_estado_check','caja_usuario_id_fkey','caja_pkey')")" 3
chk "secuencia original" "$(sql tmp_t003_a "select count(*) from pg_class where relname='caja_id_seq'")" 1
chk "caja_legada ya no existe" "$(sql tmp_t003_a "select count(*) from information_schema.tables where table_name='caja_legada'")" 0
chk "pago_caja_id_fkey sigue a caja" "$(sql tmp_t003_a "select confrelid::regclass from pg_constraint where conname='pago_caja_id_fkey'")" "orbezo.caja"
mig tmp_t003_a 003_caja.sql >/dev/null; chk "re-migrar tras rollback" "$(tiene tmp_t003_a caja monto_inicial)" 1

echo "(b) caja heredada CON 1 FILA -> aborta sin cambios"
nueva tmp_t003_b; psql -X -q -d tmp_t003_b -f "$M/003_caja_legada_fixture.sql"
sql tmp_t003_b "insert into orbezo.usuario(rol_id,nombre,email,password_hash,pin) select id,'U','u@t.com','x','x' from orbezo.rol limit 1" >/dev/null
sql tmp_t003_b "insert into orbezo.caja(usuario_id) values(1)" >/dev/null
out="$(mig tmp_t003_b 003_caja.sql)"; rc=$?
chk "la migración falla (código != 0)" "$([ $rc -ne 0 ] && echo si || echo no)" si
echo "$out" | grep -q "1 fila" && echo "  ok   mensaje claro" || { echo "  FALLA mensaje: $out"; fallos=$((fallos+1)); }
chk "sin cambios: caja heredada intacta" "$(tiene tmp_t003_b caja monto_apertura)" 1
chk "sin cambios: no hay caja_legada ni comprobante.caja_id" "$(sql tmp_t003_b "select (select count(*) from information_schema.tables where table_name='caja_legada') + (select count(*) from information_schema.columns where table_name='comprobante' and column_name='caja_id')")" 0
chk "la fila sigue ahí" "$(sql tmp_t003_b "select count(*) from orbezo.caja")" 1

echo "(e) sin caja heredada (caso init_db.sql)"
nueva tmp_t003_c; mig tmp_t003_c 003_caja_diagnostico.sql | grep "sin caja heredada" >/dev/null && echo "  ok   diagnóstico" || { echo "  FALLA diagnóstico"; fallos=$((fallos+1)); }
mig tmp_t003_c 003_caja.sql >/dev/null; chk "crea la caja nueva" "$(tiene tmp_t003_c caja monto_inicial)" 1
chk "no crea caja_legada" "$(sql tmp_t003_c "select count(*) from information_schema.tables where table_name='caja_legada'")" 0

echo; [ "$fallos" = 0 ] && echo "TODO OK" || { echo "$fallos fallo(s)"; exit 1; }
