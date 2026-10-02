"""Permisos y rastro al anular pedidos y cancelar ítems."""
import pytest
from sqlalchemy.exc import IntegrityError

from app import models
from app.pinhash import hash_pin
from app.security import create_access_token

MOTIVO = {"motivo": "Cliente se retiró"}


@pytest.fixture
def usuario_cocinero(db):
    rol = models.Rol(nombre="cocinero", permisos={}, activo=True)
    db.add(rol); db.commit()
    u = models.Usuario(rol_id=rol.id, nombre="Coc", email="coc@t.com", pin=hash_pin("4444"), activo=True)
    db.add(u); db.commit(); db.refresh(u)
    return u


@pytest.fixture
def auth_cocinero(usuario_cocinero):
    return {"Authorization": f"Bearer {create_access_token(usuario_cocinero.id, 'cocinero')}"}


@pytest.fixture
def auth_otro_mozo(db, rol_mozo):
    u = models.Usuario(rol_id=rol_mozo.id, nombre="Mozo 2", email="m2@t.com", pin=hash_pin("5656"), activo=True)
    db.add(u); db.commit(); db.refresh(u)
    return {"Authorization": f"Bearer {create_access_token(u.id, 'mozo')}"}


@pytest.fixture
def pedido(client, auth_mozo, mesa, producto):
    p = client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_mozo).json()
    client.post(f"/api/pedidos/{p['id']}/items", json={"producto_id": producto.id, "cantidad": 1}, headers=auth_mozo)
    return p


def _item(db, pedido_id):
    return db.query(models.PedidoItem).filter_by(pedido_id=pedido_id).first()


def _cancelar(client, pid, headers, body=MOTIVO):
    return client.put(f"/api/pedidos/{pid}/cancelar", json=body, headers=headers)


# --- (a) motivo obligatorio ---
@pytest.mark.parametrize("body", [None, {}, {"motivo": "ab"}, {"motivo": "x" * 201}])
def test_cancelar_pedido_exige_motivo_valido(client, auth_mozo, pedido, body):
    r = client.put(f"/api/pedidos/{pedido['id']}/cancelar", headers=auth_mozo, **({"json": body} if body is not None else {}))
    assert r.status_code == 422


# --- (b) permisos de pedido ---
def test_mozo_anula_su_pedido_y_queda_rastro(client, auth_mozo, usuario_mozo, pedido, db):
    r = _cancelar(client, pedido["id"], auth_mozo)
    assert r.status_code == 200
    db.expire_all()
    p = db.get(models.Pedido, pedido["id"])
    assert (p.estado, p.anulado_por, p.motivo_anulacion) == ("anulado", usuario_mozo.id, "Cliente se retiró")
    assert p.anulado_at is not None
    it = _item(db, p.id)
    assert (it.estado, it.cancelado_por, it.motivo_cancelacion) == ("cancelado", usuario_mozo.id, "Cliente se retiró")


def test_mozo_no_anula_pedido_ajeno(client, auth_otro_mozo, pedido):
    r = _cancelar(client, pedido["id"], auth_otro_mozo)
    assert r.status_code == 403


def test_mozo_no_anula_con_items_en_cocina(client, auth_mozo, pedido, db):
    it = _item(db, pedido["id"]); it.estado = "en_preparacion"; db.commit()
    r = _cancelar(client, pedido["id"], auth_mozo)
    assert r.status_code == 403 and "cocina" in r.json()["detail"].lower()


def test_mozo_anula_si_lo_enviado_ya_estaba_cancelado(client, auth_mozo, pedido, db):
    it = _item(db, pedido["id"]); it.estado = "cancelado"; it.motivo_cancelacion = "x" * 3; db.commit()
    assert _cancelar(client, pedido["id"], auth_mozo).status_code == 200


def test_cajero_y_admin_anulan_pedido_ajeno_con_items_en_cocina(client, auth_cajero, auth_admin, mesa, producto, auth_mozo, db):
    p = client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_mozo).json()
    client.post(f"/api/pedidos/{p['id']}/items", json={"producto_id": producto.id}, headers=auth_mozo)
    it = _item(db, p["id"]); it.estado = "listo"; db.commit()
    assert _cancelar(client, p["id"], auth_cajero).status_code == 200
    db.expire_all()
    assert db.get(models.Pedido, p["id"]).anulado_por is not None


def test_admin_anula(client, auth_admin, pedido):
    assert _cancelar(client, pedido["id"], auth_admin).status_code == 200


def test_cocinero_nunca_anula(client, auth_cocinero, pedido):
    assert _cancelar(client, pedido["id"], auth_cocinero).status_code == 403


def test_anular_pedido_ya_anulado_sigue_siendo_400(client, auth_mozo, pedido):
    _cancelar(client, pedido["id"], auth_mozo)
    assert _cancelar(client, pedido["id"], auth_mozo).status_code == 400


# --- (c) cancelar ítem ---
def _cancelar_item(client, item_id, headers, body=MOTIVO):
    return client.put(f"/api/pedidos/items/{item_id}/estado", json={"estado": "cancelado", **body}, headers=headers)


def test_cancelar_item_exige_motivo(client, auth_mozo, pedido, db):
    it = _item(db, pedido["id"])
    assert _cancelar_item(client, it.id, auth_mozo, body={}).status_code == 422
    assert _cancelar_item(client, it.id, auth_mozo, body={"motivo": "ab"}).status_code == 422


def test_mozo_cancela_item_pendiente_propio_con_rastro(client, auth_mozo, usuario_mozo, pedido, db):
    it = _item(db, pedido["id"])
    assert _cancelar_item(client, it.id, auth_mozo).status_code == 200
    db.expire_all()
    it = db.get(models.PedidoItem, it.id)
    assert (it.estado, it.cancelado_por, it.motivo_cancelacion) == ("cancelado", usuario_mozo.id, "Cliente se retiró")
    assert it.cancelado_at is not None


def test_mozo_no_cancela_item_de_pedido_ajeno(client, auth_otro_mozo, pedido, db):
    assert _cancelar_item(client, _item(db, pedido["id"]).id, auth_otro_mozo).status_code == 403


@pytest.mark.parametrize("estado", ["en_preparacion", "listo"])
def test_mozo_no_cancela_item_enviado_a_cocina(client, auth_mozo, pedido, db, estado):
    it = _item(db, pedido["id"]); it.estado = estado; db.commit()
    assert _cancelar_item(client, it.id, auth_mozo).status_code == 403


@pytest.mark.parametrize("estado", ["pendiente", "en_preparacion", "listo"])
def test_cajero_cancela_item_hasta_listo(client, auth_cajero, pedido, db, estado):
    it = _item(db, pedido["id"]); it.estado = estado; db.commit()
    assert _cancelar_item(client, it.id, auth_cajero).status_code == 200


@pytest.mark.parametrize("estado", ["entregado", "cancelado"])
def test_nadie_cancela_item_entregado_o_cancelado(client, auth_admin, pedido, db, estado):
    it = _item(db, pedido["id"]); it.estado = estado; it.motivo_cancelacion = "previo"; db.commit()
    assert _cancelar_item(client, it.id, auth_admin).status_code == 409


def test_cocinero_no_cancela_item(client, auth_cocinero, pedido, db):
    assert _cancelar_item(client, _item(db, pedido["id"]).id, auth_cocinero).status_code == 403


def test_cocinero_sigue_avanzando_estado(client, auth_cocinero, pedido, db):
    it = _item(db, pedido["id"])
    r = client.put(f"/api/pedidos/items/{it.id}/estado", json={"estado": "en_preparacion"}, headers=auth_cocinero)
    assert r.status_code == 200


# --- (d) identidad desde el token ---
def test_abrir_pedido_ignora_usuario_id_del_cuerpo(client, auth_mozo, usuario_mozo, usuario_admin, mesa):
    r = client.post("/api/pedidos", json={"mesa_id": mesa.id, "usuario_id": usuario_admin.id}, headers=auth_mozo)
    assert r.status_code == 200 and r.json()["usuario_id"] == usuario_mozo.id


def test_abrir_pedido_sin_usuario_id_en_el_cuerpo(client, auth_mozo, usuario_mozo, mesa):
    r = client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_mozo)
    assert r.status_code == 200 and r.json()["usuario_id"] == usuario_mozo.id


# --- (e) rastro en huérfanos y restricciones ---
def test_huerfano_anulado_al_abrir_deja_motivo_y_responsable(client, auth_cajero, usuario_cajero, usuario_mozo, mesa, db):
    huerfano = models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="abierto")
    db.add(huerfano); db.commit()
    r = client.post("/api/pedidos", json={"mesa_id": mesa.id}, headers=auth_cajero)
    assert r.status_code == 200
    db.expire_all()
    h = db.get(models.Pedido, huerfano.id)
    assert (h.estado, h.motivo_anulacion, h.anulado_por) == (
        "anulado", "Pedido huérfano anulado al abrir uno nuevo", usuario_cajero.id)


def test_bd_rechaza_pedido_anulado_sin_motivo(db, mesa, usuario_mozo):
    db.add(models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="anulado"))
    with pytest.raises(IntegrityError) as e:
        db.commit()
    assert e.value.orig.diag.constraint_name == "ck_pedido_anulacion"
    db.rollback()


def test_bd_rechaza_item_cancelado_sin_motivo(db, pedido):
    it = _item(db, pedido["id"]); it.estado = "cancelado"
    with pytest.raises(IntegrityError) as e:
        db.commit()
    assert e.value.orig.diag.constraint_name == "ck_pedido_item_cancelacion"
    db.rollback()
