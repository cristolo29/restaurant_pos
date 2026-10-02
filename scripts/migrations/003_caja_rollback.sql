-- Rollback de 003_caja.sql. DESTRUCTIVO: elimina la tabla caja (aperturas y arqueos) y la
-- columna comprobante.caja_id (el vínculo comprobante-caja). Los comprobantes en sí no se tocan.
-- Haz pg_dump antes. Si la API nueva sigue corriendo, detenla: ya no podrá cobrar sin caja.
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja_rollback.sql
BEGIN;

ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS fk_comprobante_caja;
ALTER TABLE orbezo.comprobante DROP COLUMN IF EXISTS caja_id;
DROP INDEX IF EXISTS orbezo.uq_caja_abierta_por_usuario;
DROP TABLE IF EXISTS orbezo.caja;

COMMIT;
