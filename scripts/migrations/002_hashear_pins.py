"""Migración 002 (parte Python): convierte los PIN en texto plano de orbezo.usuario a hash scrypt.

No se puede hacer en SQL (scrypt no existe en Postgres). Requisitos y orden:
  1. Backup lógico:  pg_dump -Fc -h HOST -U USER -d BD -f backup_pre_002.dump
  2. Ejecutar scripts/migrations/002_pin_hash.sql (amplía la columna a VARCHAR(255)).
  3. DATABASE_URL=postgresql://... python scripts/migrations/002_hashear_pins.py --confirmar

Idempotente: los valores que ya empiezan por "scrypt$" se omiten. Todo ocurre en una transacción.
ROLLBACK: el hash NO es reversible. Para volver atrás hay que restaurar el pg_dump del paso 1
o asignar PIN nuevos desde el panel de admin.
"""
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.pinhash import es_hash, hash_pin  # noqa: E402

INSTRUCCION_BACKUP = (
    "Antes de continuar haz un backup lógico:\n"
    "  pg_dump -Fc -h HOST -U USER -d BD -f backup_pre_002.dump\n"
    "y ejecuta 002_pin_hash.sql. Luego vuelve a correr este script con --confirmar."
)


def convertir(engine) -> dict:
    resumen = {"convertidos": 0, "ya_hasheados": 0, "sin_pin": 0}
    with engine.begin() as conn:  # una transacción: o se convierten todos o ninguno
        filas = conn.execute(text("SELECT id, pin FROM orbezo.usuario ORDER BY id")).all()
        for uid, pin in filas:
            if pin is None or pin == "":
                resumen["sin_pin"] += 1
            elif es_hash(pin):
                resumen["ya_hasheados"] += 1
            else:
                conn.execute(text("UPDATE orbezo.usuario SET pin = :h WHERE id = :i"),
                             {"h": hash_pin(pin), "i": uid})
                resumen["convertidos"] += 1
    return resumen


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if "--confirmar" not in argv:
        print(INSTRUCCION_BACKUP)
        return 1
    url = os.getenv("DATABASE_URL")
    if not url:
        print("Define DATABASE_URL.")
        return 2
    print(convertir(create_engine(url)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
