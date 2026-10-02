"""Tarea 1.3: cierre a ciegas. El servidor no envía el esperado de una caja abierta al cajero."""
from app import models
from tests.test_caja import caja_con_ventas  # noqa: F401
from tests.test_cobro import serie_boleta, serie_factura  # noqa: F401


def test_cajero_no_recibe_el_esperado_de_su_caja_abierta(client, auth_cajero, caja_con_ventas):
    d = client.get("/api/caja/actual", headers=auth_cajero).json()
    assert "monto_esperado" not in d and "efectivo_esperado" not in d
    assert "diferencia" not in d or d["diferencia"] is None
    assert d["por_metodo"]["efectivo"] == 56.0  # las ventas por método siguen visibles
    assert "156" not in str(d.get("monto_esperado"))


def test_cajero_no_recibe_el_esperado_ni_al_abrir_ni_en_historial_ni_por_id(client, auth_cajero):
    r = client.post("/api/caja/abrir", json={"monto_inicial": 80}, headers=auth_cajero).json()
    assert "monto_esperado" not in r
    assert "monto_esperado" not in client.get("/api/caja", headers=auth_cajero).json()[0]
    assert "monto_esperado" not in client.get(f"/api/caja/{r['id']}", headers=auth_cajero).json()


def test_cajero_no_recibe_el_esperado_tras_un_movimiento(client, auth_cajero, caja_cajero):
    r = client.post("/api/caja/movimientos", json={"tipo": "ingreso", "monto": 5, "motivo": "Sencillo"}, headers=auth_cajero)
    assert r.status_code == 200 and "monto_esperado" not in r.json()


def test_admin_si_ve_el_esperado_de_una_caja_abierta(client, auth_admin, caja_con_ventas):
    d = client.get(f"/api/caja/{caja_con_ventas.id}", headers=auth_admin).json()
    assert d["monto_esperado"] == 156.0
    assert client.get("/api/caja", headers=auth_admin).json()[0]["monto_esperado"] == 156.0


def test_admin_ve_el_esperado_de_su_propia_caja_abierta(client, auth_admin, usuario_admin, db):
    db.add(models.Caja(usuario_id=usuario_admin.id, monto_inicial=70)); db.commit()
    assert client.get("/api/caja/actual", headers=auth_admin).json()["monto_esperado"] == 70.0


def test_cerrar_devuelve_esperado_y_diferencia_despues_de_cerrar(client, auth_cajero, caja_con_ventas):
    r = client.post("/api/caja/cerrar", json={"monto_contado": 155, "observaciones": "Faltó cambio"}, headers=auth_cajero)
    d = r.json()
    assert d["estado"] == "cerrada" and d["monto_esperado"] == 156.0 and d["diferencia"] == -1.0
    # y la caja ya cerrada conserva esperado y diferencia para el cajero (historial, arqueo)
    h = client.get(f"/api/caja/{d['id']}", headers=auth_cajero).json()
    assert h["monto_esperado"] == 156.0 and h["diferencia"] == -1.0
