"""Tests de integridad: PostgreSQL debe rechazar por sí mismo los datos inválidos."""
import pytest
from sqlalchemy.exc import IntegrityError
from app import models


def nombre_violacion(db, objeto):
    """Intenta persistir `objeto`; devuelve el nombre de la restricción violada."""
    db.add(objeto)
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    db.rollback()
    return exc.value.orig.diag.constraint_name


# ── Mesas, salones y semillas únicas ──────────────────────────────────────────

def test_mesa_con_salon_inexistente(db):
    assert nombre_violacion(db, models.Mesa(salon_id=9999, numero="01", estado="disponible")) == "fk_mesa_salon"


def test_mesa_sin_numero_o_sin_salon_falla(db, salon):
    for mesa in (models.Mesa(salon_id=salon.id, numero=None),
                 models.Mesa(salon_id=None, numero="1")):
        db.add(mesa)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_numero_repetido_en_mismo_salon(db, salon, mesa):
    assert nombre_violacion(db, models.Mesa(salon_id=salon.id, numero="01")) == "uq_mesa_salon_numero"


def test_mismo_numero_en_otro_salon_es_valido(db, mesa):
    otro = models.Salon(nombre="Terraza")
    db.add(otro)
    db.commit()
    db.add(models.Mesa(salon_id=otro.id, numero="01"))
    db.commit()


def test_nombre_repetido_salon_categoria_serie(db, salon, categoria):
    assert nombre_violacion(db, models.Salon(nombre="Salón Principal")) == "uq_salon_nombre"
    assert nombre_violacion(db, models.Categoria(nombre="Platos")) == "uq_categoria_nombre"
    db.add(models.SerieComprobante(tipo="boleta", serie="B001"))
    db.commit()
    assert nombre_violacion(db, models.SerieComprobante(tipo="boleta", serie="B001")) == "uq_serie_tipo_serie"


def test_eliminar_salon_con_mesas_devuelve_409(client, auth_admin, salon, mesa):
    r = client.delete(f"/api/salones/{salon.id}", headers=auth_admin)
    assert r.status_code == 409
