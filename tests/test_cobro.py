"""Tests del cobro atómico: POST /api/pedidos/{id}/cobrar."""
import pytest
from app import models


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


def _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto, cantidad=2, estado_items="listo"):
    """Pedido abierto con `cantidad` x S/ 28 (total S/ 56 si cantidad=2)."""
    pedido = client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_mozo).json()
    client.post(f"/api/pedidos/{pedido['id']}/items",
                json={"producto_id": producto.id, "cantidad": cantidad}, headers=auth_mozo)
    if estado_items != "pendiente":
        for it in client.get(f"/api/pedidos/{pedido['id']}", headers=auth_cajero).json()["items"]:
            client.put(f"/api/pedidos/items/{it['id']}/estado", json={"estado": estado_items}, headers=auth_cajero)
    return pedido


def _pago(**kw):
    datos = {"tipo": "boleta", "metodo_pago": "efectivo", "monto_pagado": 60.0, "vuelto": 4.0}
    datos.update(kw)
    return datos


@pytest.fixture
def listo(client, auth_mozo, auth_cajero, mesa, producto, serie_boleta, caja_cajero):
    return _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)


def test_cobrar_efectivo_cierra_libera_entrega_y_emite(client, auth_cajero, listo, mesa, db, usuario_cajero):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=auth_cajero)
    assert r.status_code == 200, r.text
    comp = r.json()["comprobante"]
    assert comp["numero"] == "B001-000001"
    assert comp["total"] == pytest.approx(56.0)
    assert comp["vuelto"] == pytest.approx(4.0)

    db.expire_all()
    assert db.get(models.Pedido, listo["id"]).estado == "cerrado"
    assert db.get(models.Mesa, mesa.id).estado == "disponible"
    estados = {i.estado for i in db.query(models.PedidoItem).filter_by(pedido_id=listo["id"])}
    assert estados == {"entregado"}


def test_comprobante_registra_al_cajero_no_al_mozo(client, auth_cajero, listo, db, usuario_cajero, usuario_mozo):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=auth_cajero)
    assert r.status_code == 200
    comp = db.query(models.Comprobante).filter_by(pedido_id=listo["id"]).one()
    assert comp.usuario_id == usuario_cajero.id
    assert db.get(models.Pedido, listo["id"]).usuario_id == usuario_mozo.id


def test_pago_insuficiente_422(client, auth_cajero, listo, db):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(monto_pagado=50.0, vuelto=0), headers=auth_cajero)
    assert r.status_code == 422
    assert "menor al total" in r.json()["detail"]
    db.expire_all()
    assert db.get(models.Pedido, listo["id"]).estado == "abierto"


def test_vuelto_incorrecto_422(client, auth_cajero, listo):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(monto_pagado=60.0, vuelto=3.96), headers=auth_cajero)
    assert r.status_code == 422
    assert "vuelto" in r.json()["detail"].lower()


def test_efectivo_exacto_sin_vuelto_ok(client, auth_cajero, listo):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(monto_pagado=56.0, vuelto=0), headers=auth_cajero)
    assert r.status_code == 200


@pytest.mark.parametrize("metodo", ["tarjeta", "yape", "plin"])
def test_pago_electronico_con_monto_distinto_422(client, auth_cajero, listo, metodo):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(metodo_pago=metodo, monto_pagado=60.0, vuelto=4.0), headers=auth_cajero)
    assert r.status_code == 422
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(metodo_pago=metodo, monto_pagado=56.0, vuelto=1.0), headers=auth_cajero)
    assert r.status_code == 422
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(metodo_pago=metodo, monto_pagado=56.0, vuelto=0), headers=auth_cajero)
    assert r.status_code == 200


def test_monto_con_mas_de_dos_decimales_422(client, auth_cajero, listo):
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar",
                    json=_pago(monto_pagado=56.004, vuelto=0), headers=auth_cajero)
    assert r.status_code == 422


def test_items_en_cocina_bloquean_el_cobro(client, auth_mozo, auth_cajero, mesa, producto, serie_boleta, db, caja_cajero):
    for estado in ("pendiente", "en_preparacion"):
        mesa_id = mesa.id
        p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto, estado_items=estado)
        r = client.post(f"/api/pedidos/{p['id']}/cobrar", json=_pago(), headers=auth_cajero)
        assert r.status_code == 409
        assert "cocina" in r.json()["detail"]
        db.expire_all()
        assert db.get(models.Pedido, p["id"]).estado == "abierto"
        client.put(f"/api/pedidos/{p['id']}/cancelar", json={"motivo": "prueba"}, headers=auth_cajero)


def test_pedido_ya_cerrado_409(client, auth_cajero, listo):
    assert client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=auth_cajero).status_code == 200
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=auth_cajero)
    assert r.status_code == 409
    assert "cerrado" in r.json()["detail"]


def test_pedido_inexistente_404(client, auth_cajero):
    assert client.post("/api/pedidos/9999/cobrar", json=_pago(), headers=auth_cajero).status_code == 404


def test_pedido_sin_items_409(client, auth_mozo, auth_cajero, mesa, serie_boleta, caja_cajero):
    p = client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_mozo).json()
    r = client.post(f"/api/pedidos/{p['id']}/cobrar", json=_pago(monto_pagado=0, vuelto=0), headers=auth_cajero)
    assert r.status_code == 409


def test_factura_sin_ruc_400_y_ruc_corto_400(client, auth_cajero, auth_mozo, mesa, producto, serie_factura, db, caja_cajero):
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    for ruc in (None, "2012345"):
        r = client.post(f"/api/pedidos/{p['id']}/cobrar", headers=auth_cajero,
                        json=_pago(tipo="factura", metodo_pago="tarjeta", monto_pagado=56.0, vuelto=0,
                                   nro_doc_cliente=ruc))
        assert r.status_code == 400
        assert "RUC" in r.json()["detail"]
    db.expire_all()
    assert db.get(models.Pedido, p["id"]).estado == "abierto"
    r = client.post(f"/api/pedidos/{p['id']}/cobrar", headers=auth_cajero,
                    json=_pago(tipo="factura", metodo_pago="tarjeta", monto_pagado=56.0, vuelto=0,
                               nro_doc_cliente="20123456789", razon_social="Empresa SAC"))
    assert r.status_code == 200
    assert r.json()["comprobante"]["numero"] == "F001-000001"


def test_fallo_en_emision_hace_rollback_completo(client, auth_cajero, auth_mozo, mesa, producto, db, caja_cajero):
    """Sin serie de boleta la emisión falla DESPUÉS de cerrar: nada debe quedar cambiado."""
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    r = client.post(f"/api/pedidos/{p['id']}/cobrar", json=_pago(), headers=auth_cajero)
    assert r.status_code == 400
    assert "serie" in r.json()["detail"]

    db.expire_all()
    assert db.get(models.Pedido, p["id"]).estado == "abierto"
    assert db.get(models.Mesa, mesa.id).estado == "ocupada"
    assert {i.estado for i in db.query(models.PedidoItem).filter_by(pedido_id=p["id"])} == {"listo"}
    assert db.query(models.Comprobante).count() == 0


def test_mozo_y_cocinero_no_pueden_cobrar(client, auth_mozo, listo, db, rol_admin):
    assert client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=auth_mozo).status_code == 403
    from app.security import create_access_token
    rol = models.Rol(nombre="cocinero", permisos={}, activo=True)
    db.add(rol); db.commit()
    u = models.Usuario(rol_id=rol.id, nombre="Coc", email="c@t.com", pin="x", activo=True)
    db.add(u); db.commit()
    h = {"Authorization": f"Bearer {create_access_token(u.id, 'cocinero')}"}
    assert client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=h).status_code == 403


def test_admin_puede_cobrar(client, auth_admin, listo, usuario_admin, db):
    db.add(models.Caja(usuario_id=usuario_admin.id, monto_inicial=0)); db.commit()
    assert client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(), headers=auth_admin).status_code == 200


def test_total_lo_calcula_el_servidor_aunque_el_cliente_mande_otro(client, auth_cajero, listo):
    """El cliente solo manda lo pagado: pagar 10 por un total de 56 se rechaza."""
    r = client.post(f"/api/pedidos/{listo['id']}/cobrar", json=_pago(monto_pagado=10, vuelto=0), headers=auth_cajero)
    assert r.status_code == 422


def test_total_sin_error_de_coma_flotante(client, auth_mozo, auth_cajero, mesa, producto, serie_boleta, categoria, db, caja_cajero):
    p33 = models.Producto(categoria_id=categoria.id, nombre="Extra", precio=0.1, disponible=True, afecto_igv=True)
    db.add(p33); db.commit()
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, p33, cantidad=3)  # 0.30 exacto
    r = client.post(f"/api/pedidos/{p['id']}/cobrar",
                    json=_pago(monto_pagado=1.0, vuelto=0.7), headers=auth_cajero)
    assert r.status_code == 200, r.text
    assert r.json()["comprobante"]["total"] == pytest.approx(0.3)


def test_comprobantes_legacy_valida_el_pago(client, auth_cajero, auth_mozo, mesa, producto, serie_boleta):
    p = _pedido_listo(client, auth_mozo, auth_cajero, mesa, producto)
    assert client.put(f"/api/pedidos/{p['id']}/cerrar", headers=auth_cajero).status_code == 200
    r = client.post("/api/comprobantes", headers=auth_cajero,
                    json={"pedido_id": p["id"], "tipo": "boleta", "metodo_pago": "efectivo",
                          "monto_pagado": 10.0, "vuelto": 0})
    assert r.status_code == 422
