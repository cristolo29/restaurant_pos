-- Migración 001: integridad de la base de datos (una sola transacción).
-- Antes: pg_dump + 001_diagnostico.sql (debe devolver todo vacío). Nunca borra ni corrige datos.
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/001_integridad.sql
BEGIN;

-- Salones y categorías
ALTER TABLE orbezo.salon     ADD CONSTRAINT uq_salon_nombre UNIQUE (nombre);
ALTER TABLE orbezo.categoria ADD CONSTRAINT uq_categoria_nombre UNIQUE (nombre);

-- Mesas
ALTER TABLE orbezo.mesa ALTER COLUMN salon_id SET NOT NULL;
ALTER TABLE orbezo.mesa ALTER COLUMN numero   SET NOT NULL;
ALTER TABLE orbezo.mesa ALTER COLUMN estado   SET NOT NULL;
ALTER TABLE orbezo.mesa ADD CONSTRAINT fk_mesa_salon FOREIGN KEY (salon_id) REFERENCES orbezo.salon(id) ON DELETE RESTRICT;
ALTER TABLE orbezo.mesa ADD CONSTRAINT uq_mesa_salon_numero UNIQUE (salon_id, numero);
ALTER TABLE orbezo.mesa ADD CONSTRAINT ck_mesa_estado CHECK (estado IN ('disponible','ocupada','reservada'));
ALTER TABLE orbezo.mesa ADD CONSTRAINT ck_mesa_capacidad CHECK (capacidad > 0);

-- Series
ALTER TABLE orbezo.serie_comprobante ADD CONSTRAINT uq_serie_tipo_serie UNIQUE (tipo, serie);
ALTER TABLE orbezo.serie_comprobante ADD CONSTRAINT ck_serie_tipo CHECK (tipo IN ('boleta','factura'));

-- Pedidos
ALTER TABLE orbezo.pedido ADD CONSTRAINT ck_pedido_estado CHECK (estado IN ('abierto','cerrado','anulado'));
ALTER TABLE orbezo.pedido ADD CONSTRAINT ck_pedido_tipo CHECK (tipo IN ('en_mesa','para_llevar','delivery'));
ALTER TABLE orbezo.pedido ADD CONSTRAINT ck_pedido_montos CHECK (subtotal >= 0 AND igv >= 0 AND total >= 0);
CREATE UNIQUE INDEX uq_pedido_abierto_por_mesa ON orbezo.pedido (mesa_id) WHERE estado = 'abierto';

-- Items de pedido
ALTER TABLE orbezo.pedido_item ADD CONSTRAINT ck_pedido_item_estado CHECK (estado IN ('pendiente','en_preparacion','listo','entregado','cancelado'));
ALTER TABLE orbezo.pedido_item ADD CONSTRAINT ck_pedido_item_cantidad CHECK (cantidad > 0);
ALTER TABLE orbezo.pedido_item ADD CONSTRAINT ck_pedido_item_montos CHECK (precio_unit >= 0 AND subtotal >= 0);

-- Comprobantes
ALTER TABLE orbezo.comprobante ADD CONSTRAINT ck_comprobante_tipo CHECK (tipo IN ('boleta','factura'));
ALTER TABLE orbezo.comprobante ADD CONSTRAINT ck_comprobante_metodo_pago CHECK (metodo_pago IN ('efectivo','tarjeta','yape','plin'));
ALTER TABLE orbezo.comprobante ADD CONSTRAINT uq_comprobante_serie_correlativo UNIQUE (serie, correlativo);
ALTER TABLE orbezo.comprobante ADD CONSTRAINT uq_comprobante_pedido UNIQUE (pedido_id);
ALTER TABLE orbezo.comprobante ADD CONSTRAINT ck_comprobante_montos CHECK (subtotal >= 0 AND igv >= 0 AND descuento >= 0 AND total >= 0 AND monto_pagado >= 0 AND vuelto >= 0);
ALTER TABLE orbezo.comprobante_item ADD CONSTRAINT ck_comprobante_item_cantidad CHECK (cantidad > 0);

-- Productos
ALTER TABLE orbezo.producto ADD CONSTRAINT ck_producto_precio CHECK (precio >= 0);

COMMIT;
