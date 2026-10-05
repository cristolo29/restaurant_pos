-- Diagnóstico previo a 003_caja.sql. SOLO LECTURA.
-- Detecta la tabla orbezo.caja HEREDADA (columna monto_apertura, sin monto_inicial) y dice qué hará la
-- migración: renombrarla a caja_legada (si está vacía) o ABORTAR (si tiene filas).
-- Uso: psql -h HOST -U USER -d BD -f scripts/migrations/003_caja_diagnostico.sql

SELECT 'tabla caja ya existe' AS regla, count(*) AS filas
FROM information_schema.tables WHERE table_schema = 'orbezo' AND table_name = 'caja';

SELECT 'caja con forma NUEVA (monto_inicial): migración ya aplicada' AS regla, count(*) AS filas
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_inicial';

SELECT 'caja con forma HEREDADA (monto_apertura): se renombrará a caja_legada o abortará' AS regla, count(*) AS filas
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_apertura';

SELECT CASE
         WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='orbezo' AND table_name='caja' AND column_name='monto_apertura')
              OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='orbezo' AND table_name='caja' AND column_name='monto_inicial')
           THEN 'sin caja heredada: la migración crea la tabla nueva'
         WHEN (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM orbezo.caja', false, true, '')))[1]::text::bigint = 0
           THEN 'caja heredada VACIA: la migración la renombrará a caja_legada y creará la nueva'
         ELSE 'caja heredada CON FILAS: la migración ABORTARÁ sin cambios (resuelve esos datos a mano)'
       END AS accion_de_la_migracion;

SELECT 'tablas que referencian orbezo.caja (sus FK seguirán apuntando a caja_legada)' AS regla,
       coalesce(string_agg(DISTINCT cl.relname || '.' || c.conname, ', '), '(ninguna)') AS filas
FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid
WHERE c.contype = 'f' AND c.confrelid = to_regclass('orbezo.caja');

SELECT 'caja_legada ya existe' AS regla, count(*) AS filas
FROM information_schema.tables WHERE table_schema = 'orbezo' AND table_name = 'caja_legada';

SELECT 'columna comprobante.caja_id ya existe' AS regla, count(*) AS filas
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND table_name = 'comprobante' AND column_name = 'caja_id';

SELECT 'comprobantes históricos (quedarán sin caja)' AS regla, count(*) AS filas FROM orbezo.comprobante;

SELECT 'pedidos abiertos hoy (no se tocan)' AS regla, count(*) AS filas
FROM orbezo.pedido WHERE estado = 'abierto';
