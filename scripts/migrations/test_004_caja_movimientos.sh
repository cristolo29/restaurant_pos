#!/usr/bin/env bash
# Prueba la migración 004 en bases TEMPORALES (las crea y las borra). No toca ninguna otra base.
# (a) base construida con el init_db.sql PREVIO a la 004 (commit 4e3a29e); (b) estado real de producción tras la 003:
# init_db.sql previo a la 003 (fbd16da) + caja heredada vacía + 003 aplicada (caja nueva, caja_legada, pago);
# (c) reaplicada; (d) rollback; (e) colisiones y 003 ausente; (f) el esquema migrado == el de init_db.sql actual.
# Uso: scripts/migrations/test_004_caja_movimientos.sh
set -uo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
M="$RAIZ/scripts/migrations"; P4="$(mktemp)"; P3="$(mktemp)"
git -C "$RAIZ" show 4e3a29e:scripts/init_db.sql > "$P4"; git -C "$RAIZ" show fbd16da:scripts/init_db.sql > "$P3"
USUARIO="${PGUSER:-$USER}"; export PGUSER="$USUARIO"; fallos=0
nueva() { dropdb --if-exists "$1" 2>/dev/null; createdb "$1"; psql -X -q -v ON_ERROR_STOP=1 -d "$1" -f "$2" >/dev/null; }
sql()  { psql -X -At -d "$1" -c "$2"; }
mig()  { psql -X -q -v ON_ERROR_STOP=1 -d "$1" -f "$M/$2" 2>&1; }
chk()  { if [ "$2" = "$3" ]; then echo "  ok   $1"; else echo "  FALLA $1: esperado '$3', obtenido '$2'"; fallos=$((fallos+1)); fi; }
tiene() { sql "$1" "select count(*) from information_schema.columns where table_schema='orbezo' and table_name='$2' and column_name='$3'"; }
tabla() { sql "$1" "select count(*) from information_schema.tables where table_schema='orbezo' and table_name='$2'"; }
cons()  { sql "$1" "select count(*) from pg_constraint where conname in ($2)"; }
NOMBRES="'ck_caja_mov_tipo','ck_caja_mov_monto','ck_caja_mov_motivo','fk_caja_mov_caja','fk_caja_mov_usuario','fk_caja_autorizado_por'"
estructura() { sql "$1" "select 'col '||table_name||'.'||column_name||' '||data_type||' '||is_nullable||' '||coalesce(column_default,'') from information_schema.columns where table_schema='orbezo' and table_name in ('caja','caja_movimiento') union all select 'con '||conrelid::regclass||' '||conname||' '||pg_get_constraintdef(oid) from pg_constraint where connamespace='orbezo'::regnamespace and conrelid in ('orbezo.caja'::regclass,'orbezo.caja_movimiento'::regclass) and contype in ('f','c') union all select 'idx '||indexdef from pg_indexes where schemaname='orbezo' and tablename in ('caja','caja_movimiento') order by 1"; }
DBS="tmp_t004_a tmp_t004_b tmp_t004_c tmp_t004_d tmp_t004_e tmp_t004_f"
trap 'for d in $DBS; do dropdb --if-exists $d 2>/dev/null; done; rm -f "$P4" "$P3"' EXIT
usuario() { sql "$1" "insert into orbezo.rol(nombre) values('admin') on conflict do nothing" >/dev/null; sql "$1" "insert into orbezo.usuario(rol_id,nombre,email,password_hash,pin) select id,'U','u@t.com','x','x' from orbezo.rol limit 1" >/dev/null; }

echo "(a) base con el init_db.sql previo a la 004 (caja nueva sin movimientos)"
nueva tmp_t004_a "$P4"
dg="$(mig tmp_t004_a 004_caja_movimientos_diagnostico.sql)"; echo "$dg" | grep -q "limpio" && echo "  ok   diagnóstico: limpio" || { echo "  FALLA diagnóstico"; fallos=$((fallos+1)); }
co="$(mig tmp_t004_a colisiones_diagnostico.sql)"; echo "$co" | grep -E "caja_movimiento|idx_caja_mov|autorizado_por|caja_mov_|conteo" >/dev/null && { echo "  FALLA: colisiones de la 004 en base limpia"; fallos=$((fallos+1)); } || echo "  ok   colisiones_diagnostico: ningún nombre de la 004 existe antes de migrar"
sql tmp_t004_a "select count(*) from pg_constraint where conname in ($NOMBRES)" | grep -q '^0$' && echo "  ok   ninguno de los nombres de la 004 existe antes" || { echo "  FALLA: nombres de la 004 ya existían"; fallos=$((fallos+1)); }
usuario tmp_t004_a; sql tmp_t004_a "insert into orbezo.caja(usuario_id,monto_inicial) values(1,50)" >/dev/null
mig tmp_t004_a 004_caja_movimientos.sql >/dev/null; chk "004 aplica sin error" "$?" 0
chk "tabla caja_movimiento" "$(tabla tmp_t004_a caja_movimiento)" 1
chk "caja.conteo y caja.autorizado_por" "$(tiene tmp_t004_a caja conteo)$(tiene tmp_t004_a caja autorizado_por)" 11
chk "5 constraints de movimiento + fk_caja_autorizado_por" "$(cons tmp_t004_a "$NOMBRES")" 6
chk "índice idx_caja_mov_caja" "$(sql tmp_t004_a "select count(*) from pg_indexes where indexname='idx_caja_mov_caja'")" 1
chk "la caja existente no se tocó" "$(sql tmp_t004_a "select monto_inicial::text||estado from orbezo.caja")" "50.00abierta"
sql tmp_t004_a "insert into orbezo.caja_movimiento(caja_id,tipo,monto,motivo,usuario_id) values(1,'ingreso',5,'Sencillo',1)" >/dev/null; chk "acepta un movimiento válido" "$?" 0
sql tmp_t004_a "insert into orbezo.caja_movimiento(caja_id,tipo,monto,motivo,usuario_id) values(1,'ingreso',0,'Sencillo',1)" >/dev/null 2>&1; chk "rechaza monto 0" "$([ $? -ne 0 ] && echo si || echo no)" si
sql tmp_t004_a "insert into orbezo.caja_movimiento(caja_id,tipo,monto,motivo,usuario_id) values(1,'x',5,'Sencillo',1)" >/dev/null 2>&1; chk "rechaza tipo inválido" "$([ $? -ne 0 ] && echo si || echo no)" si
sql tmp_t004_a "insert into orbezo.caja_movimiento(caja_id,tipo,monto,motivo,usuario_id) values(1,'egreso',5,'ab',1)" >/dev/null 2>&1; chk "rechaza motivo corto" "$([ $? -ne 0 ] && echo si || echo no)" si
echo "(c) reaplicar"
mig tmp_t004_a 004_caja_movimientos.sql >/dev/null; chk "reaplicar sin error" "$?" 0
chk "el movimiento sigue ahí (sin duplicar ni borrar)" "$(sql tmp_t004_a "select count(*) from orbezo.caja_movimiento")" 1
chk "mismos 6 constraints" "$(cons tmp_t004_a "$NOMBRES")" 6
dg="$(mig tmp_t004_a 004_caja_movimientos_diagnostico.sql)"; echo "$dg" | grep -q "ya aplicada" && echo "  ok   diagnóstico: ya aplicada" || { echo "  FALLA diagnóstico tras aplicar"; fallos=$((fallos+1)); }
echo "(d) rollback"
mig tmp_t004_a 004_caja_movimientos_rollback.sql >/dev/null; chk "rollback sin error" "$?" 0
chk "sin tabla caja_movimiento" "$(tabla tmp_t004_a caja_movimiento)" 0
chk "sin columnas nuevas" "$(tiene tmp_t004_a caja conteo)$(tiene tmp_t004_a caja autorizado_por)" 00
chk "sin constraints de la 004" "$(cons tmp_t004_a "$NOMBRES")" 0
chk "la caja y su fondo siguen intactos" "$(sql tmp_t004_a "select monto_inicial::text from orbezo.caja")" "50.00"
mig tmp_t004_a 004_caja_movimientos_rollback.sql >/dev/null; chk "rollback repetido sin error" "$?" 0
mig tmp_t004_a 004_caja_movimientos.sql >/dev/null; chk "re-migrar tras rollback" "$(tabla tmp_t004_a caja_movimiento)" 1

echo "(b) estado de producción tras la 003: caja nueva + caja_legada + pago"
nueva tmp_t004_b "$P3"; psql -X -q -d tmp_t004_b -f "$M/003_caja_legada_fixture.sql"
mig tmp_t004_b 003_caja.sql >/dev/null
chk "punto de partida: caja nueva, caja_legada y pago" "$(tabla tmp_t004_b caja)$(tabla tmp_t004_b caja_legada)$(tabla tmp_t004_b pago)" 111
co="$(mig tmp_t004_b colisiones_diagnostico.sql)"; echo "$co" | grep -E "caja_movimiento|idx_caja_mov|autorizado_por|caja_mov_|conteo" >/dev/null && { echo "  FALLA: colisiona con algo heredado"; fallos=$((fallos+1)); } || echo "  ok   colisiones_diagnostico: ningún nombre de la 004 existe"
mig tmp_t004_b 004_caja_movimientos.sql >/dev/null; chk "004 aplica sin error" "$?" 0
chk "caja_movimiento creada y caja_legada/pago intactas" "$(tabla tmp_t004_b caja_movimiento)$(tabla tmp_t004_b caja_legada)$(tabla tmp_t004_b pago)" 111
chk "pago_caja_id_fkey sigue apuntando a caja_legada" "$(sql tmp_t004_b "select confrelid::regclass from pg_constraint where conname='pago_caja_id_fkey'")" "orbezo.caja_legada"
chk "caja_legada sin columnas nuevas" "$(tiene tmp_t004_b caja_legada conteo)$(tiene tmp_t004_b caja_legada autorizado_por)" 00
mig tmp_t004_b 004_caja_movimientos.sql >/dev/null; chk "reaplicar" "$?" 0
mig tmp_t004_b 004_caja_movimientos_rollback.sql >/dev/null; chk "rollback" "$(tabla tmp_t004_b caja_movimiento)" 0
chk "rollback no toca caja_legada ni pago" "$(tabla tmp_t004_b caja_legada)$(tabla tmp_t004_b pago)" 11

echo "(e) abortos sin cambios"
nueva tmp_t004_c "$P3"   # init previo a la 003 + caja heredada, sin 003
psql -X -q -d tmp_t004_c -f "$M/003_caja_legada_fixture.sql"
out="$(mig tmp_t004_c 004_caja_movimientos.sql)"; rc=$?
chk "sin 003 (caja heredada) la 004 falla" "$([ $rc -ne 0 ] && echo si || echo no)" si
echo "$out" | grep -q "003" && echo "  ok   mensaje pide la 003" || { echo "  FALLA mensaje: $out"; fallos=$((fallos+1)); }
chk "sin cambios" "$(tabla tmp_t004_c caja_movimiento)" 0
nueva tmp_t004_d "$P4"; sql tmp_t004_d "create table orbezo.caja_movimiento(id int, concepto text)" >/dev/null
out="$(mig tmp_t004_d 004_caja_movimientos.sql)"; rc=$?
chk "caja_movimiento heredada con otra forma: aborta" "$([ $rc -ne 0 ] && echo si || echo no)" si
dg="$(mig tmp_t004_d 004_caja_movimientos_diagnostico.sql)"; echo "$dg" | grep -q "ABORTARÁ: caja_movimiento existe con otra forma" && echo "  ok   el diagnóstico lo anuncia" || { echo "  FALLA diagnóstico"; fallos=$((fallos+1)); }
chk "sin columnas nuevas en caja tras abortar" "$(tiene tmp_t004_d caja conteo)" 0
nueva tmp_t004_e "$P4"; sql tmp_t004_e "create table orbezo.otra(id int); create index idx_caja_mov_caja on orbezo.otra(id)" >/dev/null
out="$(mig tmp_t004_e 004_caja_movimientos.sql)"; rc=$?
chk "índice idx_caja_mov_caja de otra tabla: aborta" "$([ $rc -ne 0 ] && echo si || echo no)" si
co="$(mig tmp_t004_e colisiones_diagnostico.sql)"; echo "$co" | grep -q "idx_caja_mov_caja" && echo "  ok   colisiones_diagnostico lo lista" || { echo "  FALLA colisiones no lo lista"; fallos=$((fallos+1)); }

echo "(f) el esquema migrado coincide con scripts/init_db.sql actual"
nueva tmp_t004_f "$RAIZ/scripts/init_db.sql"
nueva tmp_t004_a "$P4"; mig tmp_t004_a 004_caja_movimientos.sql >/dev/null
if diff <(estructura tmp_t004_a) <(estructura tmp_t004_f) >/dev/null; then echo "  ok   columnas, constraints e índices idénticos"; else echo "  FALLA diferencias:"; diff <(estructura tmp_t004_a) <(estructura tmp_t004_f); fallos=$((fallos+1)); fi

echo; [ "$fallos" = 0 ] && echo "TODO OK" || { echo "$fallos fallo(s)"; exit 1; }
