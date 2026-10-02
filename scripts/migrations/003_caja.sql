-- Migración 003: caja y arqueo (tabla caja + comprobante.caja_id).
-- Una sola transacción. Idempotente: se puede ejecutar de nuevo sin error ni cambios.
-- Antes: pg_dump + 003_caja_diagnostico.sql. No modifica datos existentes: los comprobantes
-- históricos quedan con caja_id NULL (no pertenecen a ninguna caja).
-- Caja heredada: si orbezo.caja ya existe con la forma antigua (columna monto_apertura, sin monto_inicial)
-- y está VACÍA, se renombra a orbezo.caja_legada (con su pkey, secuencia y constraints) antes de crear la
-- nueva; los FK externos (p. ej. pago_caja_id_fkey) siguen apuntando a la tabla renombrada. Si tiene filas,
-- la migración ABORTA sin cambiar nada: nunca borra ni migra datos de caja por su cuenta.
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja.sql
-- Rollback: scripts/migrations/003_caja_rollback.sql
BEGIN;

DO $$
DECLARE
    filas BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_apertura')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_inicial') THEN
        EXECUTE 'SELECT count(*) FROM orbezo.caja' INTO filas;
        IF filas > 0 THEN
            RAISE EXCEPTION 'orbezo.caja heredada tiene % fila(s): la migracion 003 se aborta sin cambios. Decide a mano que hacer con esos datos (no se borran ni migran automaticamente).', filas;
        END IF;
        IF to_regclass('orbezo.caja_legada') IS NOT NULL THEN
            RAISE EXCEPTION 'Ya existe orbezo.caja_legada: revisa el estado de la base antes de migrar.';
        END IF;
        ALTER TABLE orbezo.caja RENAME TO caja_legada;
        IF to_regclass('orbezo.caja_pkey') IS NOT NULL THEN
            ALTER INDEX orbezo.caja_pkey RENAME TO caja_legada_pkey;
        END IF;
        IF to_regclass('orbezo.caja_id_seq') IS NOT NULL THEN
            ALTER SEQUENCE orbezo.caja_id_seq RENAME TO caja_legada_id_seq;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caja_estado_check' AND conrelid = 'orbezo.caja_legada'::regclass) THEN
            ALTER TABLE orbezo.caja_legada RENAME CONSTRAINT caja_estado_check TO caja_legada_estado_check;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caja_usuario_id_fkey' AND conrelid = 'orbezo.caja_legada'::regclass) THEN
            ALTER TABLE orbezo.caja_legada RENAME CONSTRAINT caja_usuario_id_fkey TO caja_legada_usuario_id_fkey;
        END IF;
        RAISE NOTICE 'orbezo.caja heredada (vacia) renombrada a orbezo.caja_legada';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS orbezo.caja (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER NOT NULL,
    monto_inicial  NUMERIC(10,2) NOT NULL DEFAULT 0,
    abierta_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado         VARCHAR(10) NOT NULL DEFAULT 'abierta',
    cerrada_at     TIMESTAMPTZ,
    monto_contado  NUMERIC(10,2),
    monto_esperado NUMERIC(10,2),
    diferencia     NUMERIC(10,2),
    observaciones  VARCHAR(500),
    cerrada_por    INTEGER,
    CONSTRAINT fk_caja_usuario FOREIGN KEY (usuario_id) REFERENCES orbezo.usuario(id),
    CONSTRAINT fk_caja_cerrada_por FOREIGN KEY (cerrada_por) REFERENCES orbezo.usuario(id),
    CONSTRAINT ck_caja_estado CHECK (estado IN ('abierta','cerrada')),
    CONSTRAINT ck_caja_montos CHECK (monto_inicial >= 0 AND (monto_contado IS NULL OR monto_contado >= 0) AND (monto_esperado IS NULL OR monto_esperado >= 0)),
    CONSTRAINT ck_caja_cierre CHECK (estado <> 'cerrada' OR (monto_contado IS NOT NULL AND cerrada_at IS NOT NULL AND cerrada_por IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_caja_abierta_por_usuario
    ON orbezo.caja (usuario_id) WHERE estado = 'abierta';

ALTER TABLE orbezo.comprobante ADD COLUMN IF NOT EXISTS caja_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comprobante_caja') THEN
        ALTER TABLE orbezo.comprobante
            ADD CONSTRAINT fk_comprobante_caja FOREIGN KEY (caja_id) REFERENCES orbezo.caja(id);
    END IF;
END $$;

COMMIT;
