"""Tests de emisión de comprobantes — boleta, factura y validaciones."""
import pytest
from app import models


def _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto):
    """Helper: crea y cierra un pedido listo para emitir comprobante."""
    pedido = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id
    }, headers=auth_mozo).json()

    client.post(f"/api/pedidos/{pedido['id']}/items", json={
        "producto_id": producto.id, "cantidad": 2
    }, headers=auth_mozo)

    client.put(f"/api/pedidos/{pedido['id']}/cerrar", headers=auth_cajero)
    return pedido


@pytest.fixture
def serie_boleta(db):
    s = models.SerieComprobante(tipo="boleta", serie="B001", correlativo=1, activo=True)
    db.add(s); db.commit(); db.refresh(s)
    return s


@pytest.fixture
def serie_factura(db):
    s = models.SerieComprobante(tipo="factura", serie="F001", correlativo=1, activo=True)
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_emitir_boleta(client, auth_cajero, auth_mozo, mesa, usuario_mozo, producto, serie_boleta):
    pedido = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)

    r = client.post("/api/comprobantes", json={
        "pedido_id":   pedido["id"],
        "tipo":        "boleta",
        "metodo_pago": "efectivo",
        "monto_pagado": 60.0,
        "vuelto":      3.96,
    }, headers=auth_cajero)
    assert r.status_code == 200
    data = r.json()
    assert data["tipo"] == "boleta"
    assert data["numero"] == "B001-000001"
    assert float(data["total"]) == pytest.approx(56.0, abs=0.01)


def test_emitir_boleta_con_dni(client, auth_cajero, auth_mozo, mesa, usuario_mozo, producto, serie_boleta):
    pedido = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)

    r = client.post("/api/comprobantes", json={
        "pedido_id":       pedido["id"],
        "tipo":            "boleta",
        "metodo_pago":     "yape",
        "monto_pagado":    56.0,
        "vuelto":          0,
        "nro_doc_cliente": "12345678",
        "razon_social":    "Juan García",
    }, headers=auth_cajero)
    assert r.status_code == 200
    assert r.json()["nro_doc_cliente"] == "12345678"


def test_emitir_factura_sin_ruc_falla(client, auth_cajero, auth_mozo, mesa, usuario_mozo, producto, serie_factura):
    pedido = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)

    r = client.post("/api/comprobantes", json={
        "pedido_id": pedido["id"], "tipo": "factura",
        "metodo_pago": "tarjeta", "monto_pagado": 56.0, "vuelto": 0,
    }, headers=auth_cajero)
    assert r.status_code == 400
    assert "RUC" in r.json()["detail"]


def test_emitir_factura_con_ruc(client, auth_cajero, auth_mozo, mesa, usuario_mozo, producto, serie_factura):
    pedido = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)

    r = client.post("/api/comprobantes", json={
        "pedido_id":       pedido["id"],
        "tipo":            "factura",
        "metodo_pago":     "tarjeta",
        "monto_pagado":    56.0,
        "vuelto":          0,
        "nro_doc_cliente": "20123456789",
        "razon_social":    "Empresa SAC",
        "direccion_cliente": "Av. Lima 123",
    }, headers=auth_cajero)
    assert r.status_code == 200
    assert r.json()["numero"] == "F001-000001"


def test_no_duplicar_comprobante(client, auth_cajero, auth_mozo, mesa, usuario_mozo, producto, serie_boleta):
    """No se puede emitir dos comprobantes para el mismo pedido."""
    pedido = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)
    payload = {"pedido_id": pedido["id"], "tipo": "boleta", "metodo_pago": "efectivo", "monto_pagado": 56.0, "vuelto": 0}

    client.post("/api/comprobantes", json=payload, headers=auth_cajero)
    r = client.post("/api/comprobantes", json=payload, headers=auth_cajero)
    assert r.status_code == 400


def test_mozo_no_puede_emitir_comprobante(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto, serie_boleta):
    pedido = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)

    r = client.post("/api/comprobantes", json={
        "pedido_id": pedido["id"], "tipo": "boleta",
        "metodo_pago": "efectivo", "monto_pagado": 56.0, "vuelto": 0,
    }, headers=auth_mozo)
    assert r.status_code == 403


def test_correlativo_avanza(client, auth_cajero, auth_mozo, mesa, usuario_mozo, producto, db, serie_boleta, salon):
    """Cada boleta emitida avanza el correlativo."""
    # Primer comprobante
    pedido1 = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto)
    client.post("/api/comprobantes", json={
        "pedido_id": pedido1["id"], "tipo": "boleta",
        "metodo_pago": "efectivo", "monto_pagado": 56.0, "vuelto": 0,
    }, headers=auth_cajero)

    # Segunda mesa y pedido
    mesa2 = models.Mesa(salon_id=salon.id, numero="02", capacidad=4, estado="disponible")
    db.add(mesa2); db.commit(); db.refresh(mesa2)
    pedido2 = _crear_pedido_cerrado(client, auth_mozo, auth_cajero, mesa2, usuario_mozo, producto)
    r = client.post("/api/comprobantes", json={
        "pedido_id": pedido2["id"], "tipo": "boleta",
        "metodo_pago": "yape", "monto_pagado": 56.0, "vuelto": 0,
    }, headers=auth_cajero)
    assert r.json()["numero"] == "B001-000002"
