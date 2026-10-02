-- Migración 004: movimientos de efectivo de la caja (ingresos, egresos, retiros), conteo por
-- denominaciones y autorización de diferencias (caja.conteo, caja.autorizado_por).
-- Una sola transacción. Idempotente: se puede ejecutar de nuevo sin error ni cambios.
-- Requiere la 003 (tabla caja con forma nueva). Antes: pg_dump + 004_caja_movimientos_diagnostico.sql +
-- colisiones_diagnostico.sql. Solo AGREGA objetos: no modifica ni borra datos existentes.
-- Si algún nombre ya existe con otra forma (tabla/índice heredados), ABORTA sin cambios.
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/004_caja_movimientos.sql
-- Rollback: scripts/migrations/004_caja_movimientos_rollback.sql
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'orbezo' AND table_name = 'caja' AND column_name = 'monto_inicial') THEN
        RAISE EXCEPTION 'orbezo.caja no tiene la forma nueva (monto_inicial): aplica primero la migracion 003.';
    END IF;
    -- Colisiones: si caja_movimiento ya existe debe ser la nuestra (columnas monto y motivo).
    IF to_regclass('orbezo.caja_movimiento') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'orbezo' AND table_name = 'caja_movimiento' AND column_name = 'motivo')
    THEN
        RAISE EXCEPTION 'orbezo.caja_movimiento ya existe con otra forma (sin columna motivo): revisa la base antes de migrar.';
    END IF;
    -- idx_caja_mov_caja es unico por esquema: si existe debe ser de nuestra tabla.
    IF to_regclass('orbezo.idx_caja_mov_caja') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM pg_index i WHERE i.indexrelid = to_regclass('orbezo.idx_caja_mov_caja')
          AND i.indrelid = to_regclass('orbezo.caja_movimiento'))
    THEN
        RAISE EXCEPTION 'El indice orbezo.idx_caja_mov_caja ya existe en otra tabla: revisa la base antes de migrar.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS orbezo.caja_movimiento (
    id         SERIAL PRIMARY KEY,
    caja_id    INTEGER NOT NULL,
    tipo       VARCHAR(10) NOT NULL,
    monto      NUMERIC(10,2) NOT NULL,
    motivo     TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_caja_mov_caja FOREIGN KEY (caja_id) REFERENCES orbezo.caja(id),
    CONSTRAINT fk_caja_mov_usuario FOREIGN KEY (usuario_id) REFERENCES orbezo.usuario(id),
    CONSTRAINT ck_caja_mov_tipo CHECK (tipo IN ('ingreso','egreso','retiro')),
    CONSTRAINT ck_caja_mov_monto CHECK (monto > 0),
    CONSTRAINT ck_caja_mov_motivo CHECK (char_length(btrim(motivo)) BETWEEN 3 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_caja_mov_caja ON orbezo.caja_movimiento (caja_id);

ALTER TABLE orbezo.caja ADD COLUMN IF NOT EXISTS conteo JSONB;
ALTER TABLE orbezo.caja ADD COLUMN IF NOT EXISTS autorizado_por INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_caja_autorizado_por' AND conrelid = 'orbezo.caja'::regclass) THEN
        ALTER TABLE orbezo.caja
            ADD CONSTRAINT fk_caja_autorizado_por FOREIGN KEY (autorizado_por) REFERENCES orbezo.usuario(id);
    END IF;
END $$;

COMMIT;
