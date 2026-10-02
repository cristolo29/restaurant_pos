-- Diagnóstico previo a 001_integridad.sql. SOLO LECTURA.
-- Cada fila devuelta es un dato que impediría la migración. Todo vacío = apto.
-- Uso: psql -h HOST -U USER -d BD -f scripts/migrations/001_diagnostico.sql

SELECT 'mesa sin salon o salon inexistente' AS regla, m.id, m.salon_id::text AS detalle
FROM orbezo.mesa m LEFT JOIN orbezo.salon s ON s.id = m.salon_id
WHERE s.id IS NULL;

SELECT 'mesa con numero nulo' AS regla, id, NULL::text AS detalle
FROM orbezo.mesa WHERE numero IS NULL;

SELECT 'mesa con estado nulo' AS regla, id, NULL::text AS detalle
FROM orbezo.mesa WHERE estado IS NULL;

SELECT 'mesa numero repetido por salon' AS regla, min(id) AS id, 'salon ' || salon_id || ' numero ' || numero || ' x' || count(*) AS detalle
FROM orbezo.mesa WHERE salon_id IS NOT NULL AND numero IS NOT NULL
GROUP BY salon_id, numero HAVING count(*) > 1;

SELECT 'salon nombre repetido' AS regla, min(id) AS id, nombre || ' x' || count(*) AS detalle
FROM orbezo.salon GROUP BY nombre HAVING count(*) > 1;

SELECT 'categoria nombre repetido' AS regla, min(id) AS id, nombre || ' x' || count(*) AS detalle
FROM orbezo.categoria GROUP BY nombre HAVING count(*) > 1;

SELECT 'serie repetida (tipo, serie)' AS regla, min(id) AS id, tipo || ' ' || serie || ' x' || count(*) AS detalle
FROM orbezo.serie_comprobante GROUP BY tipo, serie HAVING count(*) > 1;

SELECT 'mesa.estado fuera de lista' AS regla, id, estado AS detalle
FROM orbezo.mesa WHERE estado IS NOT NULL AND estado NOT IN ('disponible','ocupada','reservada');

SELECT 'mesa.capacidad <= 0' AS regla, id, capacidad::text AS detalle
FROM orbezo.mesa WHERE capacidad <= 0;

SELECT 'pedido.estado fuera de lista' AS regla, id, estado AS detalle
FROM orbezo.pedido WHERE estado IS NOT NULL AND estado NOT IN ('abierto','cerrado','anulado');

SELECT 'pedido.tipo fuera de lista' AS regla, id, tipo AS detalle
FROM orbezo.pedido WHERE tipo IS NOT NULL AND tipo NOT IN ('en_mesa','para_llevar','delivery');

SELECT 'pedido_item.estado fuera de lista' AS regla, id, estado AS detalle
FROM orbezo.pedido_item
WHERE estado IS NOT NULL AND estado NOT IN ('pendiente','en_preparacion','listo','entregado','cancelado');

SELECT 'serie_comprobante.tipo fuera de lista' AS regla, id, tipo AS detalle
FROM orbezo.serie_comprobante WHERE tipo NOT IN ('boleta','factura');

SELECT 'comprobante.tipo fuera de lista' AS regla, id, tipo AS detalle
FROM orbezo.comprobante WHERE tipo NOT IN ('boleta','factura');

SELECT 'comprobante.metodo_pago fuera de lista' AS regla, id, metodo_pago AS detalle
FROM orbezo.comprobante
WHERE metodo_pago IS NOT NULL AND metodo_pago NOT IN ('efectivo','tarjeta','yape','plin');

SELECT 'comprobante correlativo repetido' AS regla, min(id) AS id, serie || '-' || correlativo || ' x' || count(*) AS detalle
FROM orbezo.comprobante GROUP BY serie, correlativo HAVING count(*) > 1;

SELECT 'pedido con mas de un comprobante' AS regla, min(id) AS id, 'pedido ' || pedido_id || ' x' || count(*) AS detalle
FROM orbezo.comprobante GROUP BY pedido_id HAVING count(*) > 1;

SELECT 'mesa con mas de un pedido abierto' AS regla, min(id) AS id, 'mesa ' || mesa_id || ' x' || count(*) AS detalle
FROM orbezo.pedido WHERE estado = 'abierto' GROUP BY mesa_id HAVING count(*) > 1;

SELECT 'pedido con montos negativos' AS regla, id, subtotal || '/' || igv || '/' || total AS detalle
FROM orbezo.pedido WHERE subtotal < 0 OR igv < 0 OR total < 0;

SELECT 'pedido_item cantidad <= 0' AS regla, id, cantidad::text AS detalle
FROM orbezo.pedido_item WHERE cantidad <= 0;

SELECT 'pedido_item montos negativos' AS regla, id, precio_unit || '/' || subtotal AS detalle
FROM orbezo.pedido_item WHERE precio_unit < 0 OR subtotal < 0;

SELECT 'comprobante con montos negativos' AS regla, id, total::text AS detalle
FROM orbezo.comprobante
WHERE subtotal < 0 OR igv < 0 OR descuento < 0 OR total < 0 OR monto_pagado < 0 OR vuelto < 0;

SELECT 'comprobante_item cantidad <= 0' AS regla, id, cantidad::text AS detalle
FROM orbezo.comprobante_item WHERE cantidad <= 0;

SELECT 'producto precio negativo' AS regla, id, precio::text AS detalle
FROM orbezo.producto WHERE precio < 0;
