-- Rollback de 004_caja_movimientos.sql. DESTRUCTIVO: elimina la tabla caja_movimiento (todos los ingresos,
-- egresos y retiros registrados) y las columnas caja.conteo y caja.autorizado_por (conteos y autorizaciones
-- de los cierres). Las cajas, sus montos y los comprobantes no se tocan. Solo actúa sobre la caja de forma
-- nueva (monto_inicial); nunca sobre una caja heredada.
-- OJO: tras el rollback el esperado vuelve a ser fondo + efectivo cobrado; si había movimientos, las cajas
-- abiertas dejarán de cuadrar. Haz pg_dump antes y detén la API nueva (insertaría en tablas que ya no existen).
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/004_caja_movimientos_rollback.sql
BEGIN;

DROP INDEX IF EXISTS orbezo.idx_caja_mov_caja;
DROP TABLE IF EXISTS orbezo.caja_movimiento;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_inicial') THEN
        ALTER TABLE orbezo.caja DROP CONSTRAINT IF EXISTS fk_caja_autorizado_por;
        ALTER TABLE orbezo.caja DROP COLUMN IF EXISTS autorizado_por;
        ALTER TABLE orbezo.caja DROP COLUMN IF EXISTS conteo;
    END IF;
END $$;

COMMIT;
