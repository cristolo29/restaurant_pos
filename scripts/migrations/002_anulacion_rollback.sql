-- Rollback de 002_anulacion_rastro.sql. DESTRUCTIVO para el rastro: elimina las columnas de
-- quién/cuándo/motivo de anulación y cancelación (los estados no se tocan). Haz pg_dump antes.
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/002_anulacion_rollback.sql
BEGIN;

ALTER TABLE orbezo.pedido_item DROP CONSTRAINT IF EXISTS ck_pedido_item_cancelacion;
ALTER TABLE orbezo.pedido      DROP CONSTRAINT IF EXISTS ck_pedido_anulacion;
ALTER TABLE orbezo.pedido_item DROP CONSTRAINT IF EXISTS fk_pedido_item_cancelado_por;
ALTER TABLE orbezo.pedido      DROP CONSTRAINT IF EXISTS fk_pedido_anulado_por;

ALTER TABLE orbezo.pedido_item
    DROP COLUMN IF EXISTS motivo_cancelacion,
    DROP COLUMN IF EXISTS cancelado_at,
    DROP COLUMN IF EXISTS cancelado_por;
ALTER TABLE orbezo.pedido
    DROP COLUMN IF EXISTS motivo_anulacion,
    DROP COLUMN IF EXISTS anulado_at,
    DROP COLUMN IF EXISTS anulado_por;

COMMIT;
