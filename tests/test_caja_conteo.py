"""Tarea 1.2: conteo por denominaciones al cerrar la caja."""
from decimal import Decimal
import pytest
from app import models
from app.cobro import DENOMINACIONES


def _cerrar(client, headers, **cuerpo):
    return client.post("/api/caja/cerrar", json=cuerpo, headers=headers)


def test_denominaciones_peruanas_estandar():
    assert [str(d) for d in DENOMINACIONES] == ["200", "100", "50", "20", "10", "5", "2", "1", "0.50", "0.20", "0.10"]


def test_conteo_que_suma_igual_cierra_y_se_guarda(client, auth_cajero, caja_cajero, db):
    conteo = {"50": 1, "20": 2, "5": 2, "2": 0, "0.50": 1}  # 50 + 40 + 10 + 0.50 = 100.50
    r = _cerrar(client, auth_cajero, monto_contado=100.5, conteo=conteo, observaciones="Sobra medio sol")
    assert r.status_code == 200, r.text
    assert r.json()["conteo"] == {"50": 1, "20": 2, "5": 2, "2": 0, "0.50": 1}
    db.expire_all()
    assert db.get(models.Caja, caja_cajero.id).conteo == {"50": 1, "20": 2, "5": 2, "2": 0, "0.50": 1}


def test_conteo_con_centimos_sin_error_de_coma_flotante(client, auth_cajero, caja_cajero, db):
    caja_cajero.monto_inicial = Decimal("0.60")
    db.commit()
    # 3 x 0.10 + 1 x 0.20 + 1 x 0.10 = 0.60 exacto (en float 0.1*3 = 0.30000000000000004)
    r = _cerrar(client, auth_cajero, monto_contado=0.6, conteo={"0.10": 4, "0.20": 1})
    assert r.status_code == 200, r.text
    assert r.json()["diferencia"] == 0.0


def test_conteo_que_no_suma_el_monto_422_y_no_cierra(client, auth_cajero, caja_cajero, db):
    r = _cerrar(client, auth_cajero, monto_contado=100, conteo={"50": 1, "20": 2})  # suma 90
    assert r.status_code == 422
    assert "no coincide" in r.json()["detail"].lower()
    db.expire_all()
    assert db.get(models.Caja, caja_cajero.id).estado == "abierta"


def test_denominacion_desconocida_422(client, auth_cajero, caja_cajero):
    assert _cerrar(client, auth_cajero, monto_contado=3, conteo={"3": 1}).status_code == 422
    assert _cerrar(client, auth_cajero, monto_contado=0.05, conteo={"0.05": 1}).status_code == 422
    assert _cerrar(client, auth_cajero, monto_contado=1, conteo={"abc": 1}).status_code == 422
    for rara in ("sNaN", "NaN", "Infinity", "1e2000"):
        assert _cerrar(client, auth_cajero, monto_contado=1, conteo={rara: 1}).status_code == 422


@pytest.mark.parametrize("cantidad", [-1, 1.5, "2", True, None])
def test_cantidad_invalida_422(client, auth_cajero, caja_cajero, cantidad):
    assert _cerrar(client, auth_cajero, monto_contado=0, conteo={"10": cantidad}).status_code == 422


def test_cantidad_absurda_422(client, auth_cajero, caja_cajero):
    assert _cerrar(client, auth_cajero, monto_contado=0, conteo={"10": 10**9}).status_code == 422


def test_conteo_en_cero_con_monto_cero_es_valido(client, auth_cajero, caja_cajero, db):
    caja_cajero.monto_inicial = 0
    db.commit()
    assert _cerrar(client, auth_cajero, monto_contado=0, conteo={}).status_code == 200


def test_claves_equivalentes_se_normalizan(client, auth_cajero, caja_cajero):
    r = _cerrar(client, auth_cajero, monto_contado=100.5, conteo={"100": 1, "0.5": 1}, observaciones="Sobra medio sol")
    assert r.status_code == 200, r.text
    assert r.json()["conteo"] == {"100": 1, "0.50": 1}


def test_claves_duplicadas_tras_normalizar_422(client, auth_cajero, caja_cajero):
    assert _cerrar(client, auth_cajero, monto_contado=1, conteo={"0.5": 1, "0.50": 1}).status_code == 422


def test_sin_conteo_se_mantiene_el_monto_unico(client, auth_cajero, caja_cajero):
    r = _cerrar(client, auth_cajero, monto_contado=100)
    assert r.status_code == 200 and r.json()["conteo"] is None


def test_caja_abierta_y_cerrada_exponen_conteo_en_historial(client, auth_cajero, caja_cajero):
    assert client.get("/api/caja/actual", headers=auth_cajero).json()["conteo"] is None
    _cerrar(client, auth_cajero, monto_contado=100, conteo={"100": 1})
    assert client.get("/api/caja", headers=auth_cajero).json()[0]["conteo"] == {"100": 1}
