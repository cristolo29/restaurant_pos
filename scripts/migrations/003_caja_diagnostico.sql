-- Diagnóstico previo a 003_caja.sql. SOLO LECTURA.
-- No hay datos que bloqueen la migración (solo agrega una tabla y una columna nullable).
-- Informa si ya fue aplicada y cuántos comprobantes quedarán con caja_id NULL (todos los actuales).
-- Uso: psql -h HOST -U USER -d BD -f scripts/migrations/003_caja_diagnostico.sql

SELECT 'tabla caja ya existe (migración aplicada)' AS regla, count(*) AS filas
FROM information_schema.tables WHERE table_schema = 'orbezo' AND table_name = 'caja';

SELECT 'columna comprobante.caja_id ya existe' AS regla, count(*) AS filas
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND table_name = 'comprobante' AND column_name = 'caja_id';

SELECT 'comprobantes históricos (quedarán sin caja)' AS regla, count(*) AS filas
FROM orbezo.comprobante;

SELECT 'pedidos abiertos hoy (no se tocan)' AS regla, count(*) AS filas
FROM orbezo.pedido WHERE estado = 'abierto';
