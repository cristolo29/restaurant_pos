"""Tests de caja y arqueo."""
import pytest
from sqlalchemy.exc import IntegrityError
from app import models
from tests.test_cobro import _pedido_listo, _pago, serie_boleta, serie_factura  # noqa: F401


def _cobrar(client, headers, pedido, **kw):
    r = client.post(f"/api/pedidos/{pedido['id']}/cobrar", json=_pago(**kw), headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _mesa_extra(db, salon, numero):
    m = models.Mesa(salon_id=salon.id, numero=numero, capacidad=4, estado="disponible")
    db.add(m); db.commit(); db.refresh(m)
    return m


# ── Apertura ──────────────────────────────────────────────────────────────────

def test_abrir_caja(client, auth_cajero, usuario_cajero):
    r = client.post("/api/caja/abrir", json={"monto_inicial": 150.5}, headers=auth_cajero)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["estado"] == "abierta" and d["monto_inicial"] == 150.5
    assert d["usuario_id"] == usuario_cajero.id and d["monto_esperado"] == 150.5


def test_abrir_caja_duplicada_409(client, auth_cajero):
    assert client.post("/api/caja/abrir", json={"monto_inicial": 10}, headers=auth_cajero).status_code == 200
    r = client.post("/api/caja/abrir", json={"monto_inicial": 10}, headers=auth_cajero)
    assert r.status_code == 409
    assert "ya tienes" in r.json()["detail"].lower()


def test_abrir_caja_monto_negativo_o_con_tres_decimales_422(client, auth_cajero):
    assert client.post("/api/caja/abrir", json={"monto_inicial": -1}, headers=auth_cajero).status_code == 422
    assert client.post("/api/caja/abrir", json={"monto_inicial": 1.234}, headers=auth_cajero).status_code == 422


def test_caja_actual_sin_caja_es_null(client, auth_cajero):
    r = client.get("/api/caja/actual", headers=auth_cajero)
    assert r.status_code == 200 and r.json() is None


# ── Cobro exige caja ──────────────────────────────────────────────────────────

def test_cobrar_sin_caja_409_y_no_cambia_nada(client, auth_mozo, auth_cajero, mesa, producto, serie_boleta, db):
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    r = client.post(f"/api/pedidos/{p['id']}/cobrar", json=_pago(), headers=auth_cajero)
    assert r.status_code == 409
    assert r.json()["detail"] == "Abre la caja antes de cobrar"
    db.expire_all()
    assert db.get(models.Pedido, p["id"]).estado == "abierto"


def test_cobrar_con_la_caja_de_otro_usuario_409(client, auth_mozo, auth_cajero, mesa, producto, serie_boleta, db, usuario_admin):
    db.add(models.Caja(usuario_id=usuario_admin.id, monto_inicial=0)); db.commit()
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    assert client.post(f"/api/pedidos/{p['id']}/cobrar", json=_pago(), headers=auth_cajero).status_code == 409


def test_cobro_asigna_la_caja_al_comprobante(client, auth_cajero, auth_mozo, mesa, producto, serie_boleta, caja_cajero, db):
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    comp_id = _cobrar(client, auth_cajero, p)["comprobante"]["id"]
    assert db.get(models.Comprobante, comp_id).caja_id == caja_cajero.id


# ── Resumen y arqueo ──────────────────────────────────────────────────────────

@pytest.fixture
def caja_con_ventas(client, auth_cajero, auth_mozo, mesa, producto, serie_boleta, caja_cajero, db, salon):
    """Fondo 100; vende S/ 56 en efectivo (paga 60), S/ 56 con tarjeta y S/ 28 con yape."""
    _cobrar(client, auth_cajero, _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto))
    m2 = _mesa_extra(db, salon, "02")
    _cobrar(client, auth_cajero, _pedido_listo(client, auth_mozo, auth_cajero, m2, producto),
            metodo_pago="tarjeta", monto_pagado=56.0, vuelto=0)
    m3 = _mesa_extra(db, salon, "03")
    _cobrar(client, auth_cajero, _pedido_listo(client, auth_mozo, auth_cajero, m3, producto, cantidad=1),
            metodo_pago="yape", monto_pagado=28.0, vuelto=0)
    return caja_cajero


def test_resumen_en_vivo_mezcla_de_metodos(client, auth_cajero, caja_con_ventas):
    d = client.get("/api/caja/actual", headers=auth_cajero).json()
    assert d["comprobantes"] == 3
    assert d["por_metodo"] == {"efectivo": 56.0, "tarjeta": 56.0, "yape": 28.0, "plin": 0.0}
    assert d["total_cobrado"] == 140.0
    assert d["monto_esperado"] == 156.0  # 100 + 56 en efectivo (el vuelto no cuenta); tarjeta y yape no entran


def test_cerrar_sin_diferencia_no_exige_observaciones(client, auth_cajero, caja_con_ventas):
    r = client.post("/api/caja/cerrar", json={"monto_contado": 156.0}, headers=auth_cajero)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["estado"] == "cerrada" and d["diferencia"] == 0.0
    assert d["monto_esperado"] == 156.0 and d["monto_contado"] == 156.0
    assert d["por_metodo"]["tarjeta"] == 56.0 and d["cerrada_at"]


def test_cerrar_con_faltante_exige_observaciones_422(client, auth_cajero, caja_con_ventas, db):
    r = client.post("/api/caja/cerrar", json={"monto_contado": 150.0}, headers=auth_cajero)
    assert r.status_code == 422
    r = client.post("/api/caja/cerrar", json={"monto_contado": 150.0, "observaciones": " ab "}, headers=auth_cajero)
    assert r.status_code == 422
    db.expire_all()
    assert db.get(models.Caja, caja_con_ventas.id).estado == "abierta"
    r = client.post("/api/caja/cerrar", json={"monto_contado": 150.0, "observaciones": "Faltó cambio"}, headers=auth_cajero)
    assert r.status_code == 200
    assert r.json()["diferencia"] == -6.0 and r.json()["observaciones"] == "Faltó cambio"


def test_sobrante_tambien_exige_observaciones(client, auth_cajero, caja_con_ventas):
    assert client.post("/api/caja/cerrar", json={"monto_contado": 160.5}, headers=auth_cajero).status_code == 422
    r = client.post("/api/caja/cerrar", json={"monto_contado": 160.5, "observaciones": "Propina"}, headers=auth_cajero)
    assert r.json()["diferencia"] == 4.5


def test_decimales_sin_error_de_coma_flotante(client, auth_cajero, caja_cajero, db):
    caja_cajero.monto_inicial = 0.1
    db.commit()
    r = client.post("/api/caja/cerrar", json={"monto_contado": 0.3, "observaciones": "x y z"}, headers=auth_cajero)
    assert r.json()["monto_esperado"] == 0.1
    assert r.json()["diferencia"] == 0.2  # 0.3 - 0.1 exacto, no 0.19999999999999998


def test_caja_cerrada_es_inmutable(client, auth_cajero, caja_con_ventas, db, auth_mozo, mesa, producto):
    cerrada = client.post("/api/caja/cerrar", json={"monto_contado": 156}, headers=auth_cajero).json()
    r = client.post("/api/caja/cerrar", json={"monto_contado": 1, "observaciones": "otra vez"}, headers=auth_cajero)
    assert r.status_code == 409
    assert client.get("/api/caja/actual", headers=auth_cajero).json() is None
    # cobrar ya no es posible hasta abrir una caja nueva
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    assert client.post(f"/api/pedidos/{p['id']}/cobrar", json=_pago(), headers=auth_cajero).status_code == 409
    # una caja nueva no toca la cerrada
    nueva = client.post("/api/caja/abrir", json={"monto_inicial": 0}, headers=auth_cajero).json()
    assert nueva["id"] != cerrada["id"]
    igual = client.get(f"/api/caja/{cerrada['id']}", headers=auth_cajero).json()
    assert igual["monto_contado"] == 156.0 and igual["estado"] == "cerrada"


def test_resumen_advierte_pedidos_abiertos_sin_bloquear_el_cierre(client, auth_cajero, auth_mozo, mesa, caja_cajero):
    client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_mozo)
    d = client.get("/api/caja/actual", headers=auth_cajero).json()
    assert d["pedidos_abiertos"] == 1
    assert d["advertencia"] == "Hay 1 pedido(s) abierto(s) sin cobrar"
    assert client.post("/api/caja/cerrar", json={"monto_contado": 100}, headers=auth_cajero).status_code == 200


# ── Permisos e historial ──────────────────────────────────────────────────────

def test_mozo_no_accede_a_caja(client, auth_mozo):
    assert client.post("/api/caja/abrir", json={"monto_inicial": 0}, headers=auth_mozo).status_code == 403
    assert client.get("/api/caja/actual", headers=auth_mozo).status_code == 403
    assert client.post("/api/caja/cerrar", json={"monto_contado": 0}, headers=auth_mozo).status_code == 403
    assert client.get("/api/caja", headers=auth_mozo).status_code == 403


def test_sin_token_401(client):
    assert client.get("/api/caja/actual").status_code in (401, 403)


def test_historial_acotado_por_rol(client, auth_cajero, auth_admin, usuario_cajero, usuario_admin, db):
    db.add_all([
        models.Caja(usuario_id=usuario_cajero.id, monto_inicial=10, estado="cerrada", monto_contado=10,
                    monto_esperado=10, diferencia=0, cerrada_por=usuario_cajero.id,
                    cerrada_at=models.func.now()),
        models.Caja(usuario_id=usuario_admin.id, monto_inicial=20),
    ])
    db.commit()
    mias = client.get("/api/caja", headers=auth_cajero).json()
    assert [c["usuario_id"] for c in mias] == [usuario_cajero.id]
    todas = client.get("/api/caja", headers=auth_admin).json()
    assert {c["usuario_id"] for c in todas} == {usuario_cajero.id, usuario_admin.id}
    assert todas[0]["id"] > todas[1]["id"]  # más reciente primero


def test_cajero_no_ve_la_caja_de_otro_pero_admin_si(client, auth_cajero, auth_admin, usuario_admin, db):
    otra = models.Caja(usuario_id=usuario_admin.id, monto_inicial=5)
    db.add(otra); db.commit()
    assert client.get(f"/api/caja/{otra.id}", headers=auth_cajero).status_code == 403
    assert client.get(f"/api/caja/{otra.id}", headers=auth_admin).status_code == 200
    assert client.get("/api/caja/9999", headers=auth_admin).status_code == 404


# ── Restricciones nombradas en la BD ──────────────────────────────────────────

def _viola(db, obj):
    db.add(obj)
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    db.rollback()
    return exc.value.orig.diag.constraint_name


def test_bd_una_caja_abierta_por_usuario(db, usuario_cajero, caja_cajero):
    assert _viola(db, models.Caja(usuario_id=usuario_cajero.id, monto_inicial=0)) == "uq_caja_abierta_por_usuario"


def test_bd_varias_cerradas_si_se_permiten(db, usuario_cajero):
    for _ in range(2):
        db.add(models.Caja(usuario_id=usuario_cajero.id, monto_inicial=0, estado="cerrada", monto_contado=0,
                           cerrada_at=models.func.now(), cerrada_por=usuario_cajero.id))
    db.commit()


def test_bd_ck_caja_estado_montos_y_cierre(db, usuario_cajero):
    u = usuario_cajero.id
    assert _viola(db, models.Caja(usuario_id=u, monto_inicial=0, estado="x")) == "ck_caja_estado"
    assert _viola(db, models.Caja(usuario_id=u, monto_inicial=-1)) == "ck_caja_montos"
    assert _viola(db, models.Caja(usuario_id=u, monto_inicial=0, estado="cerrada")) == "ck_caja_cierre"
    assert _viola(db, models.Caja(usuario_id=u, monto_inicial=0, estado="cerrada", monto_contado=0,
                                  cerrada_at=models.func.now())) == "ck_caja_cierre"


def test_bd_fk_nombradas(db, usuario_cajero, mesa, serie_boleta):
    assert _viola(db, models.Caja(usuario_id=9999, monto_inicial=0)) == "fk_caja_usuario"
    assert _viola(db, models.Caja(usuario_id=usuario_cajero.id, monto_inicial=0, estado="cerrada", monto_contado=0,
                                  cerrada_at=models.func.now(), cerrada_por=9999)) == "fk_caja_cerrada_por"
    ped = models.Pedido(mesa_id=mesa.id, usuario_id=usuario_cajero.id, estado="cerrado")
    db.add(ped); db.commit()
    assert _viola(db, models.Comprobante(pedido_id=ped.id, usuario_id=usuario_cajero.id, serie_id=serie_boleta.id,
                                         tipo="boleta", serie="B001", correlativo=1, subtotal=1, igv=0, total=1,
                                         caja_id=9999)) == "fk_comprobante_caja"


def test_mensajes_de_integridad_de_caja_en_espanol(client, auth_cajero, usuario_cajero, caja_cajero, monkeypatch):
    """La carrera de dos aperturas la resuelve el índice único; el handler lo traduce a 409 en español."""
    from app.routers import caja as router_caja
    monkeypatch.setattr(router_caja, "caja_abierta_de", lambda *a, **k: None)  # simula perder la carrera
    r = client.post("/api/caja/abrir", json={"monto_inicial": 5}, headers=auth_cajero)
    assert r.status_code == 409
    assert r.json()["detail"] == "El usuario ya tiene una caja abierta"
