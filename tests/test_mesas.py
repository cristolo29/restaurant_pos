from app import models

CAMPOS = ("pedido_id", "mozo_id", "items_total", "items_pendientes", "items_listos")


def _pedido_con_items(db, mesa, usuario, producto, estados, estado_pedido="abierto"):
    pedido = models.Pedido(mesa_id=mesa.id, usuario_id=usuario.id, estado=estado_pedido)
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    for estado in estados:
        db.add(models.PedidoItem(
            pedido_id=pedido.id, producto_id=producto.id, cantidad=1,
            precio_unit=28, subtotal=28, estado=estado,
            motivo_cancelacion="prueba" if estado == "cancelado" else None,  # ck_pedido_item_cancelacion
        ))
    db.commit()
    return pedido


def _mesa_json(client, auth, mesa_id):
    r = client.get("/api/mesas", headers=auth)
    assert r.status_code == 200
    return next(m for m in r.json() if m["id"] == mesa_id)


def test_mesa_sin_pedido_tiene_campos_nulos(client, auth_mozo, mesa):
    data = _mesa_json(client, auth_mozo, mesa.id)
    for campo in CAMPOS:
        assert data[campo] is None


def test_mesa_ocupada_sin_pedido_abierto_tiene_campos_nulos(client, auth_mozo, mesa, db):
    mesa.estado = "ocupada"
    db.commit()
    data = _mesa_json(client, auth_mozo, mesa.id)
    for campo in CAMPOS:
        assert data[campo] is None


def test_pedido_cerrado_no_cuenta_como_abierto(client, auth_mozo, mesa, usuario_mozo, producto, db):
    _pedido_con_items(db, mesa, usuario_mozo, producto, ["listo"], estado_pedido="cerrado")
    data = _mesa_json(client, auth_mozo, mesa.id)
    for campo in CAMPOS:
        assert data[campo] is None


def test_conteos_por_estado_excluyen_cancelados(client, auth_mozo, mesa, usuario_mozo, producto, db):
    pedido = _pedido_con_items(
        db, mesa, usuario_mozo, producto,
        ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"],
    )
    data = _mesa_json(client, auth_mozo, mesa.id)
    assert data["pedido_id"] == pedido.id
    assert data["mozo_id"] == usuario_mozo.id
    assert data["items_total"] == 4
    assert data["items_pendientes"] == 2
    assert data["items_listos"] == 1


def test_pedido_solo_con_cancelados_tiene_total_cero(client, auth_mozo, mesa, usuario_mozo, producto, db):
    _pedido_con_items(db, mesa, usuario_mozo, producto, ["cancelado", "cancelado"])
    data = _mesa_json(client, auth_mozo, mesa.id)
    assert data["items_total"] == 0
    assert data["items_pendientes"] == 0
    assert data["items_listos"] == 0


def test_pedido_solo_entregados(client, auth_mozo, mesa, usuario_mozo, producto, db):
    _pedido_con_items(db, mesa, usuario_mozo, producto, ["entregado", "entregado"])
    data = _mesa_json(client, auth_mozo, mesa.id)
    assert data["items_total"] == 2
    assert data["items_pendientes"] == 0
    assert data["items_listos"] == 0


def test_conteos_independientes_por_mesa(client, auth_mozo, mesa, salon, usuario_mozo, producto, db):
    mesa2 = models.Mesa(salon_id=salon.id, numero="99", capacidad=2, estado="ocupada")
    db.add(mesa2)
    db.commit()
    db.refresh(mesa2)
    _pedido_con_items(db, mesa, usuario_mozo, producto, ["listo"])
    _pedido_con_items(db, mesa2, usuario_mozo, producto, ["pendiente", "pendiente"])
    d1 = _mesa_json(client, auth_mozo, mesa.id)
    d2 = _mesa_json(client, auth_mozo, mesa2.id)
    assert (d1["items_total"], d1["items_pendientes"], d1["items_listos"]) == (1, 0, 1)
    assert (d2["items_total"], d2["items_pendientes"], d2["items_listos"]) == (2, 2, 0)
