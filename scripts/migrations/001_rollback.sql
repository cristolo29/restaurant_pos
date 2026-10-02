-- Rollback de 001_integridad.sql (quita restricciones; no toca datos).
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/001_rollback.sql
BEGIN;

ALTER TABLE orbezo.producto DROP CONSTRAINT IF EXISTS ck_producto_precio;

ALTER TABLE orbezo.comprobante_item DROP CONSTRAINT IF EXISTS ck_comprobante_item_cantidad;
ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS ck_comprobante_montos;
ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS uq_comprobante_pedido;
ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS uq_comprobante_serie_correlativo;
ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS ck_comprobante_metodo_pago;
ALTER TABLE orbezo.comprobante DROP CONSTRAINT IF EXISTS ck_comprobante_tipo;

ALTER TABLE orbezo.pedido_item DROP CONSTRAINT IF EXISTS ck_pedido_item_montos;
ALTER TABLE orbezo.pedido_item DROP CONSTRAINT IF EXISTS ck_pedido_item_cantidad;
ALTER TABLE orbezo.pedido_item DROP CONSTRAINT IF EXISTS ck_pedido_item_estado;

DROP INDEX IF EXISTS orbezo.uq_pedido_abierto_por_mesa;
ALTER TABLE orbezo.pedido DROP CONSTRAINT IF EXISTS ck_pedido_montos;
ALTER TABLE orbezo.pedido DROP CONSTRAINT IF EXISTS ck_pedido_tipo;
ALTER TABLE orbezo.pedido DROP CONSTRAINT IF EXISTS ck_pedido_estado;

ALTER TABLE orbezo.serie_comprobante DROP CONSTRAINT IF EXISTS ck_serie_tipo;
ALTER TABLE orbezo.serie_comprobante DROP CONSTRAINT IF EXISTS uq_serie_tipo_serie;

ALTER TABLE orbezo.mesa DROP CONSTRAINT IF EXISTS ck_mesa_capacidad;
ALTER TABLE orbezo.mesa DROP CONSTRAINT IF EXISTS ck_mesa_estado;
ALTER TABLE orbezo.mesa DROP CONSTRAINT IF EXISTS uq_mesa_salon_numero;
ALTER TABLE orbezo.mesa DROP CONSTRAINT IF EXISTS fk_mesa_salon;
ALTER TABLE orbezo.mesa ALTER COLUMN estado   DROP NOT NULL;
ALTER TABLE orbezo.mesa ALTER COLUMN numero   DROP NOT NULL;
ALTER TABLE orbezo.mesa ALTER COLUMN salon_id DROP NOT NULL;

ALTER TABLE orbezo.categoria DROP CONSTRAINT IF EXISTS uq_categoria_nombre;
ALTER TABLE orbezo.salon     DROP CONSTRAINT IF EXISTS uq_salon_nombre;

COMMIT;
