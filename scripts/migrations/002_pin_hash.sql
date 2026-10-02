-- Migración 002 (parte SQL): amplía orbezo.usuario.pin para alojar el hash scrypt (~115 caracteres).
-- Orden: 1) pg_dump  2) este archivo  3) python scripts/migrations/002_hashear_pins.py --confirmar
--        4) recién entonces desplegar el código nuevo (el login ya no acepta PIN en claro).
-- Rollback: la ampliación se revierte (ver abajo) pero el HASH NO ES REVERSIBLE: volver a PIN en
-- claro exige restaurar el pg_dump previo o que cada usuario tenga un PIN nuevo asignado por el admin.
--   ALTER TABLE orbezo.usuario ALTER COLUMN pin TYPE VARCHAR(6);  -- solo si ya no hay hashes
-- Uso: psql -v ON_ERROR_STOP=1 -h HOST -U USER -d BD -f scripts/migrations/002_pin_hash.sql
BEGIN;
ALTER TABLE orbezo.usuario ALTER COLUMN pin TYPE VARCHAR(255);
COMMIT;
