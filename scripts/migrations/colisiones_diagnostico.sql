-- Colisiones de nombres de las migraciones 001-003 con objetos YA existentes. SOLO LECTURA (catálogo).
-- Lista cada constraint/índice/tabla/columna que 001-003 crean y que ya existe en la base, con su definición,
-- para ver si es la misma (migración ya aplicada) o una HEREDADA con otra forma. En una base limpia previa a
-- las migraciones debe devolver 0 filas en las dos primeras consultas.
-- Uso: psql -h HOST -U USER -d BD -f scripts/migrations/colisiones_diagnostico.sql
WITH nombres(n) AS (VALUES
 ('ck_caja_cierre'),('ck_caja_estado'),('ck_caja_montos'),('ck_comprobante_item_cantidad'),('ck_comprobante_metodo_pago'),
 ('ck_comprobante_montos'),('ck_comprobante_tipo'),('ck_mesa_capacidad'),('ck_mesa_estado'),('ck_pedido_anulacion'),
 ('ck_pedido_estado'),('ck_pedido_item_cancelacion'),('ck_pedido_item_cantidad'),('ck_pedido_item_estado'),
 ('ck_pedido_item_montos'),('ck_pedido_montos'),('ck_pedido_tipo'),('ck_producto_precio'),('ck_serie_tipo'),
 ('fk_caja_cerrada_por'),('fk_caja_usuario'),('fk_comprobante_caja'),('fk_mesa_salon'),('fk_pedido_anulado_por'),
 ('fk_pedido_item_cancelado_por'),('uq_caja_abierta_por_usuario'),('uq_categoria_nombre'),('uq_comprobante_pedido'),
 ('uq_comprobante_serie_correlativo'),('uq_mesa_salon_numero'),('uq_pedido_abierto_por_mesa'),('uq_salon_nombre'),
 ('uq_serie_tipo_serie'))
SELECT 'constraint ya existe' AS tipo, c.conname AS nombre, c.conrelid::regclass::text AS tabla, pg_get_constraintdef(c.oid) AS definicion
FROM pg_constraint c JOIN nombres ON nombres.n = c.conname
UNION ALL
SELECT 'indice ya existe', i.indexname, i.schemaname || '.' || i.tablename, i.indexdef
FROM pg_indexes i JOIN nombres ON nombres.n = i.indexname
ORDER BY 1, 2;

SELECT 'tabla ya existe' AS tipo, table_name AS nombre
FROM information_schema.tables WHERE table_schema = 'orbezo' AND table_name IN ('caja', 'caja_legada')
ORDER BY 2;

SELECT 'columna ya existe' AS tipo, table_name || '.' || column_name AS nombre, data_type
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND (
      (table_name = 'pedido' AND column_name IN ('anulado_por', 'anulado_at', 'motivo_anulacion'))
   OR (table_name = 'pedido_item' AND column_name IN ('cancelado_por', 'cancelado_at', 'motivo_cancelacion'))
   OR (table_name = 'comprobante' AND column_name = 'caja_id'))
ORDER BY 2;
