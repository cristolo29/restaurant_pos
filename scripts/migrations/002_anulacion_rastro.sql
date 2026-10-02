-- Migración 002: rastro de anulación (quién, cuándo, por qué) en pedido y pedido_item.
-- Una sola transacción. Antes: pg_dump + 002_anulacion_diagnostico.sql. No cambia ningún estado.
-- Backfill: lo ya anulado/cancelado recibe el motivo «Anulado antes del registro de motivos»
-- (anulado_por/cancelado_por quedan NULL: no se sabe quién fue).
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/002_anulacion_rastro.sql
-- Rollback: scripts/migrations/002_anulacion_rollback.sql
BEGIN;

ALTER TABLE orbezo.pedido
    ADD COLUMN anulado_por      INTEGER,
    ADD COLUMN anulado_at       TIMESTAMPTZ,
    ADD COLUMN motivo_anulacion VARCHAR(200);
ALTER TABLE orbezo.pedido_item
    ADD COLUMN cancelado_por      INTEGER,
    ADD COLUMN cancelado_at       TIMESTAMPTZ,
    ADD COLUMN motivo_cancelacion VARCHAR(200);

UPDATE orbezo.pedido SET motivo_anulacion = 'Anulado antes del registro de motivos'
WHERE estado = 'anulado' AND motivo_anulacion IS NULL;
UPDATE orbezo.pedido_item SET motivo_cancelacion = 'Anulado antes del registro de motivos'
WHERE estado = 'cancelado' AND motivo_cancelacion IS NULL;

ALTER TABLE orbezo.pedido ADD CONSTRAINT fk_pedido_anulado_por
    FOREIGN KEY (anulado_por) REFERENCES orbezo.usuario(id);
ALTER TABLE orbezo.pedido_item ADD CONSTRAINT fk_pedido_item_cancelado_por
    FOREIGN KEY (cancelado_por) REFERENCES orbezo.usuario(id);
ALTER TABLE orbezo.pedido ADD CONSTRAINT ck_pedido_anulacion
    CHECK (estado <> 'anulado' OR motivo_anulacion IS NOT NULL);
ALTER TABLE orbezo.pedido_item ADD CONSTRAINT ck_pedido_item_cancelacion
    CHECK (estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL);

COMMIT;
