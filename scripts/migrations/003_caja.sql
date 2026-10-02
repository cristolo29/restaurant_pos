-- Migración 003: caja y arqueo (tabla caja + comprobante.caja_id).
-- Una sola transacción. Idempotente: se puede ejecutar de nuevo sin error ni cambios.
-- Antes: pg_dump + 003_caja_diagnostico.sql. No modifica datos existentes: los comprobantes
-- históricos quedan con caja_id NULL (no pertenecen a ninguna caja).
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/003_caja.sql
-- Rollback: scripts/migrations/003_caja_rollback.sql
BEGIN;

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
