"""Tarea 1.1: movimientos de efectivo (ingresos, egresos y retiros) y esperado del servidor."""
from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from app import models
from tests.test_caja import _cobrar, _mesa_extra  # noqa: F401
from tests.test_cobro import _pedido_listo, serie_boleta, serie_factura  # noqa: F401


def _mov(client, headers, tipo, monto, motivo="Cambio para la gaveta"):
    return client.post("/api/caja/movimientos", json={"tipo": tipo, "monto": monto, "motivo": motivo}, headers=headers)


def _actual(client, headers):
    return client.get("/api/caja/actual", headers=headers).json()


def _de(client, headers, caja_id):
    return client.get(f"/api/caja/{caja_id}", headers=headers).json()


# ── Validación ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("monto", [0, -5, 1.234, "abc"])
def test_monto_invalido_422(client, auth_cajero, caja_cajero, monto):
    assert _mov(client, auth_cajero, "ingreso", monto).status_code == 422


@pytest.mark.parametrize("motivo", ["", "ab", "  a ", "x" * 201])
def test_motivo_invalido_422(client, auth_cajero, caja_cajero, motivo):
    assert _mov(client, auth_cajero, "ingreso", 10, motivo).status_code == 422


def test_tipo_invalido_422(client, auth_cajero, caja_cajero):
    assert _mov(client, auth_cajero, "regalo", 10).status_code == 422


def test_motivo_se_guarda_sin_espacios_sobrantes(client, auth_cajero, caja_cajero):
    r = _mov(client, auth_cajero, "ingreso", 10, "  Sencillo del banco  ")
    assert r.status_code == 200, r.text
    assert _actual(client, auth_cajero)["movimientos"][0]["motivo"] == "Sencillo del banco"


# ── Reglas ────────────────────────────────────────────────────────────────────

def test_sin_caja_409(client, auth_cajero):
    r = _mov(client, auth_cajero, "ingreso", 10)
    assert r.status_code == 409
    assert r.json()["detail"] == "Abre la caja antes de registrar un movimiento"


def test_solo_sobre_la_caja_abierta_del_propio_usuario(client, auth_cajero, auth_admin, caja_cajero, usuario_admin, db):
    # el admin no tiene caja abierta: no puede mover la del cajero
    assert _mov(client, auth_admin, "ingreso", 10).status_code == 409
    db.expire_all()
    assert db.query(models.CajaMovimiento).count() == 0


def test_mozo_403(client, auth_mozo):
    assert _mov(client, auth_mozo, "ingreso", 10).status_code == 403


def test_registra_y_devuelve_movimientos_con_totales(client, auth_cajero, caja_cajero, usuario_cajero):
    assert _mov(client, auth_cajero, "ingreso", 50, "Sencillo").status_code == 200
    assert _mov(client, auth_cajero, "egreso", 20.5, "Compra de hielo").status_code == 200
    assert _mov(client, auth_cajero, "retiro", 30, "Retiro a caja fuerte").status_code == 200
    d = _actual(client, auth_cajero)
    assert [m["tipo"] for m in d["movimientos"]] == ["ingreso", "egreso", "retiro"]
    m = d["movimientos"][1]
    assert m["monto"] == 20.5 and m["motivo"] == "Compra de hielo"
    assert m["usuario_id"] == usuario_cajero.id and m["usuario_nombre"] == "Cajero Test" and m["created_at"]
    assert d["totales_movimientos"] == {"ingreso": 50.0, "egreso": 20.5, "retiro": 30.0}
    assert d["efectivo_cobrado"] == 0.0 and d["monto_inicial"] == 100.0


def test_egreso_o_retiro_mayor_al_disponible_409(client, auth_cajero, auth_admin, caja_cajero, db):
    r = _mov(client, auth_cajero, "egreso", 100.01)
    assert r.status_code == 409
    # el cajero no debe poder leer el esperado (cierre a ciegas): el mensaje no lleva la cifra
    assert "100.00" not in r.json()["detail"] and "disponible" in r.json()["detail"].lower()
    assert _mov(client, auth_cajero, "retiro", 100.01).status_code == 409
    db.expire_all()
    assert db.query(models.CajaMovimiento).count() == 0
    # justo el disponible sí se puede
    assert _mov(client, auth_cajero, "retiro", 100).status_code == 200
    assert _mov(client, auth_cajero, "egreso", 0.01).status_code == 409


def test_egreso_del_admin_si_informa_el_disponible(client, auth_admin, usuario_admin, db):
    db.add(models.Caja(usuario_id=usuario_admin.id, monto_inicial=40)); db.commit()
    r = _mov(client, auth_admin, "egreso", 40.5)
    assert r.status_code == 409 and "40.00" in r.json()["detail"]


def test_ingreso_amplia_lo_disponible(client, auth_cajero, caja_cajero):
    assert _mov(client, auth_cajero, "egreso", 150).status_code == 409
    assert _mov(client, auth_cajero, "ingreso", 60).status_code == 200
    assert _mov(client, auth_cajero, "egreso", 150).status_code == 200


def test_caja_cerrada_no_admite_movimientos(client, auth_cajero, caja_cajero):
    assert client.post("/api/caja/cerrar", json={"monto_contado": 100}, headers=auth_cajero).status_code == 200
    assert _mov(client, auth_cajero, "ingreso", 10).status_code == 409


def test_movimientos_son_inmutables_no_hay_put_ni_delete(client, auth_cajero, auth_admin, caja_cajero):
    _mov(client, auth_cajero, "ingreso", 10)
    mid = _actual(client, auth_cajero)["movimientos"][0]["id"]
    for h in (auth_cajero, auth_admin):
        assert client.put(f"/api/caja/movimientos/{mid}", json={"monto": 1}, headers=h).status_code in (404, 405)
        assert client.patch(f"/api/caja/movimientos/{mid}", json={"monto": 1}, headers=h).status_code in (404, 405)
        assert client.delete(f"/api/caja/movimientos/{mid}", headers=h).status_code in (404, 405)
    assert _actual(client, auth_cajero)["movimientos"][0]["monto"] == 10.0


# ── Esperado calculado por el servidor ────────────────────────────────────────

@pytest.fixture
def turno_mezclado(client, auth_cajero, auth_mozo, mesa, producto, serie_boleta, caja_cajero, db, salon):
    """Fondo 100; efectivo 56 (paga 60), tarjeta 56, yape 28; ingreso 25.50, egreso 10.25, retiro 40."""
    _cobrar(client, auth_cajero, _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto))
    m2 = _mesa_extra(db, salon, "02")
    _cobrar(client, auth_cajero, _pedido_listo(client, auth_mozo, auth_cajero, m2, producto),
            metodo_pago="tarjeta", monto_pagado=56.0, vuelto=0)
    m3 = _mesa_extra(db, salon, "03")
    _cobrar(client, auth_cajero, _pedido_listo(client, auth_mozo, auth_cajero, m3, producto, cantidad=1),
            metodo_pago="yape", monto_pagado=28.0, vuelto=0)
    assert _mov(client, auth_cajero, "ingreso", 25.5, "Sencillo").status_code == 200
    assert _mov(client, auth_cajero, "egreso", 10.25, "Hielo").status_code == 200
    assert _mov(client, auth_cajero, "retiro", 40, "A caja fuerte").status_code == 200
    return caja_cajero


def test_esperado_mezcla_efectivo_tarjeta_ingresos_egresos_y_retiro(client, auth_cajero, auth_admin, turno_mezclado):
    # 100 + 56 + 25.50 - 10.25 - 40 = 131.25 (tarjeta y yape no entran)
    d = _de(client, auth_admin, turno_mezclado.id)  # el admin lo ve; el cajero no (tarea 1.3)
    assert d["monto_esperado"] == 131.25
    assert d["efectivo_cobrado"] == 56.0
    assert d["totales_movimientos"] == {"ingreso": 25.5, "egreso": 10.25, "retiro": 40.0}
    r = client.post("/api/caja/cerrar", json={"monto_contado": 131.25}, headers=auth_cajero)
    assert r.status_code == 200, r.text
    assert r.json()["monto_esperado"] == 131.25 and r.json()["diferencia"] == 0.0


def test_cliente_no_puede_decidir_el_esperado(client, auth_cajero, turno_mezclado):
    r = client.post("/api/caja/cerrar", json={"monto_contado": 131.25, "monto_esperado": 999, "diferencia": 0},
                    headers=auth_cajero)
    assert r.status_code == 200 and r.json()["monto_esperado"] == 131.25


def test_esperado_sin_error_de_coma_flotante(client, auth_cajero, auth_admin, caja_cajero, db):
    caja_cajero.monto_inicial = Decimal("0.00")
    db.commit()
    assert _mov(client, auth_cajero, "ingreso", 0.1).status_code == 200
    assert _mov(client, auth_cajero, "ingreso", 0.2).status_code == 200  # 0.1 + 0.2 != 0.3 en float
    assert _de(client, auth_admin, caja_cajero.id)["monto_esperado"] == 0.3
    for _ in range(3):
        assert _mov(client, auth_cajero, "egreso", 0.1).status_code == 200  # 0.1 x 3 = 0.30000000000000004 en float
    assert _de(client, auth_admin, caja_cajero.id)["monto_esperado"] == 0.0
    assert _mov(client, auth_cajero, "egreso", 0.01).status_code == 409


def test_cerrar_con_movimientos_guarda_el_esperado_y_la_diferencia(client, auth_cajero, turno_mezclado, db):
    r = client.post("/api/caja/cerrar", json={"monto_contado": 130.0, "observaciones": "Faltó un sencillo"}, headers=auth_cajero)
    d = r.json()
    assert d["monto_esperado"] == 131.25 and d["diferencia"] == -1.25
    db.expire_all()
    assert db.get(models.Caja, turno_mezclado.id).monto_esperado == Decimal("131.25")
    # los movimientos de una caja cerrada siguen consultables por id
    assert len(client.get(f"/api/caja/{turno_mezclado.id}", headers=auth_cajero).json()["movimientos"]) == 3


def test_obtener_caja_por_id_incluye_movimientos_y_respeta_permisos(client, auth_cajero, auth_admin, caja_cajero):
    _mov(client, auth_cajero, "ingreso", 10)
    d = client.get(f"/api/caja/{caja_cajero.id}", headers=auth_admin).json()
    assert len(d["movimientos"]) == 1 and d["totales_movimientos"]["ingreso"] == 10.0


# ── Restricciones nombradas en la BD ──────────────────────────────────────────

def _viola(db, obj):
    db.add(obj)
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    db.rollback()
    return exc.value.orig.diag.constraint_name


def test_bd_restricciones_de_movimiento(db, caja_cajero, usuario_cajero):
    base = dict(caja_id=caja_cajero.id, usuario_id=usuario_cajero.id, tipo="ingreso", monto=1, motivo="Sencillo")
    assert _viola(db, models.CajaMovimiento(**{**base, "tipo": "x"})) == "ck_caja_mov_tipo"
    assert _viola(db, models.CajaMovimiento(**{**base, "monto": 0})) == "ck_caja_mov_monto"
    assert _viola(db, models.CajaMovimiento(**{**base, "monto": -1})) == "ck_caja_mov_monto"
    assert _viola(db, models.CajaMovimiento(**{**base, "motivo": "ab"})) == "ck_caja_mov_motivo"
    assert _viola(db, models.CajaMovimiento(**{**base, "motivo": "  a  "})) == "ck_caja_mov_motivo"
    assert _viola(db, models.CajaMovimiento(**{**base, "motivo": "x" * 201})) == "ck_caja_mov_motivo"
    assert _viola(db, models.CajaMovimiento(**{**base, "caja_id": 9999})) == "fk_caja_mov_caja"
    assert _viola(db, models.CajaMovimiento(**{**base, "usuario_id": 9999})) == "fk_caja_mov_usuario"


def test_bd_indice_por_caja_existe(db):
    n = db.execute(models.text("select count(*) from pg_indexes where indexname='idx_caja_mov_caja'")).scalar()
    assert n == 1


def test_mensajes_de_integridad_de_movimientos_en_espanol():
    from app.integridad import MENSAJES, MENSAJE_GENERICO
    for nombre in ("ck_caja_mov_tipo", "ck_caja_mov_monto", "ck_caja_mov_motivo", "fk_caja_mov_caja", "fk_caja_mov_usuario"):
        assert MENSAJES.get(nombre) and MENSAJES[nombre] != MENSAJE_GENERICO
