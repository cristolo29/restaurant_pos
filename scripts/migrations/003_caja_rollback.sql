-- Rollback de 003_caja.sql. DESTRUCTIVO: elimina la tabla caja nueva (aperturas y arqueos) y la
-- columna comprobante.caja_id. Si la migración había renombrado la caja heredada a caja_legada, la
-- devuelve a orbezo.caja con sus nombres originales (caja_pkey, caja_id_seq, caja_estado_check,
-- caja_usuario_id_fkey). Los comprobantes en sí no se tocan.
-- Haz pg_dump antes. Si la API nueva sigue corriendo, detenla: ya no podrá cobrar sin caja.
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja_rollback.sql
BEGIN;

ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS fk_comprobante_caja;
ALTER TABLE orbezo.comprobante DROP COLUMN IF EXISTS caja_id;
DROP INDEX IF EXISTS orbezo.uq_caja_abierta_por_usuario;
-- Solo la caja de forma nueva: nunca la heredada.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_inicial') THEN
        DROP TABLE orbezo.caja;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('orbezo.caja_legada') IS NOT NULL AND to_regclass('orbezo.caja') IS NULL THEN
        ALTER TABLE orbezo.caja_legada RENAME TO caja;
        IF to_regclass('orbezo.caja_legada_pkey') IS NOT NULL THEN
            ALTER INDEX orbezo.caja_legada_pkey RENAME TO caja_pkey;
        END IF;
        IF to_regclass('orbezo.caja_legada_id_seq') IS NOT NULL THEN
            ALTER SEQUENCE orbezo.caja_legada_id_seq RENAME TO caja_id_seq;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caja_legada_estado_check' AND conrelid = 'orbezo.caja'::regclass) THEN
            ALTER TABLE orbezo.caja RENAME CONSTRAINT caja_legada_estado_check TO caja_estado_check;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caja_legada_usuario_id_fkey' AND conrelid = 'orbezo.caja'::regclass) THEN
            ALTER TABLE orbezo.caja RENAME CONSTRAINT caja_legada_usuario_id_fkey TO caja_usuario_id_fkey;
        END IF;
    END IF;
END $$;

COMMIT;
