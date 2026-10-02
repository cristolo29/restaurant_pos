-- Diagnóstico previo a 002_anulacion_rastro.sql. SOLO LECTURA.
-- Informa cuántas filas recibirán el motivo de backfill «Anulado antes del registro de motivos»
-- y si la migración ya fue aplicada. No hay datos que la bloqueen (todo se rellena, nada se borra).
-- Uso: psql -h HOST -U USER -d BD -f scripts/migrations/002_anulacion_diagnostico.sql

SELECT 'columnas de rastro ya existen (migración aplicada)' AS regla,
       count(*) AS filas
FROM information_schema.columns
WHERE table_schema = 'orbezo' AND table_name IN ('pedido', 'pedido_item')
  AND column_name IN ('anulado_por', 'anulado_at', 'motivo_anulacion',
                      'cancelado_por', 'cancelado_at', 'motivo_cancelacion');

SELECT 'pedidos anulados a rellenar con motivo de backfill' AS regla, count(*) AS filas
FROM orbezo.pedido WHERE estado = 'anulado';

SELECT 'items cancelados a rellenar con motivo de backfill' AS regla, count(*) AS filas
FROM orbezo.pedido_item WHERE estado = 'cancelado';

SELECT 'pedidos abiertos hoy (no se tocan)' AS regla, count(*) AS filas
FROM orbezo.pedido WHERE estado = 'abierto';
