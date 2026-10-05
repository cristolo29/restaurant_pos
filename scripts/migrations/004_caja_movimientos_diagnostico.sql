-- Diagnóstico previo a 004_caja_movimientos.sql. SOLO LECTURA.
-- Dice si la 003 está aplicada, si ya existe algo con los nombres de la 004 (y con qué forma) y qué hará la migración.
-- Uso: psql -h HOST -U USER -d BD -f scripts/migrations/004_caja_movimientos_diagnostico.sql

SELECT 'orbezo.caja con forma NUEVA (003 aplicada; requisito de la 004)' AS regla, count(*) AS filas
FROM information_schema.columns WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_inicial';

SELECT 'tabla caja_movimiento ya existe' AS regla, count(*) AS filas
FROM information_schema.tables WHERE table_schema = 'orbezo' AND table_name = 'caja_movimiento';

SELECT 'columnas de caja_movimiento (si existe; debe incluir motivo y monto)' AS regla,
       coalesce(string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position), '(la tabla no existe)') AS filas
FROM information_schema.columns WHERE table_schema = 'orbezo' AND table_name = 'caja_movimiento';

SELECT 'indice idx_caja_mov_caja ya existe (en que tabla)' AS regla,
       coalesce(string_agg(tablename, ', '), '(no existe)') AS filas
FROM pg_indexes WHERE schemaname = 'orbezo' AND indexname = 'idx_caja_mov_caja';

SELECT 'columnas nuevas de caja ya existen (conteo, autorizado_por)' AS regla, count(*) AS filas
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name IN ('conteo', 'autorizado_por');

SELECT 'constraints con nombres de la 004 que ya existen (tabla y definición)' AS regla,
       coalesce(string_agg(conrelid::regclass::text || '.' || conname || ': ' || pg_get_constraintdef(oid), E'\n'), '(ninguna)') AS filas
FROM pg_constraint
WHERE conname IN ('fk_caja_mov_caja', 'fk_caja_mov_usuario', 'ck_caja_mov_tipo', 'ck_caja_mov_monto', 'ck_caja_mov_motivo', 'fk_caja_autorizado_por');

SELECT CASE
         WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='orbezo' AND table_name='caja' AND column_name='monto_inicial')
           THEN 'ABORTARÁ: falta la migración 003 (caja con forma nueva)'
         WHEN to_regclass('orbezo.caja_movimiento') IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='orbezo' AND table_name='caja_movimiento' AND column_name='motivo')
           THEN 'ABORTARÁ: caja_movimiento existe con otra forma'
         WHEN to_regclass('orbezo.caja_movimiento') IS NOT NULL
           THEN 'ya aplicada (o parcial): la migración completará lo que falte sin tocar datos'
         ELSE 'limpio: la migración creará la tabla, el índice y las columnas'
       END AS accion_de_la_migracion;

SELECT 'movimientos existentes (no se tocan)' AS regla,
       CASE WHEN to_regclass('orbezo.caja_movimiento') IS NULL THEN 0
            ELSE (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orbezo.caja_movimiento', false, true, '')))[1]::text::bigint END AS filas;
