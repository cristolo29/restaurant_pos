"""La API debe responder 409/422 claros, nunca 500, ante datos que violan la integridad."""
from app import models
from app.integridad import MENSAJES


def _pedido_abierto(client, auth_mozo, mesa, usuario_mozo):
    r = client.post("/api/pedidos", json={"mesa_id": mesa.id, "usuario_id": usuario_mozo.id}, headers=auth_mozo)
    assert r.status_code == 200, r.text
    return r.json()


def test_crear_mesa_numero_repetido_409(client, auth_admin, salon, mesa):
    r = client.post("/api/mesas", json={"salon_id": salon.id, "numero": "01"}, headers=auth_admin)
    assert r.status_code == 409
    assert r.json()["detail"] == MENSAJES["uq_mesa_salon_numero"]


def test_actualizar_mesa_a_numero_existente_409(client, auth_admin, salon, mesa):
    r = client.post("/api/mesas", json={"salon_id": salon.id, "numero": "02"}, headers=auth_admin)
    assert r.status_code == 200
    r = client.put(f"/api/mesas/{r.json()['id']}", json={"salon_id": salon.id, "numero": "01"}, headers=auth_admin)
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya existe una mesa con ese número en el salón"


def test_crear_mesa_salon_inexistente_409(client, auth_admin):
    r = client.post("/api/mesas", json={"salon_id": 9999, "numero": "05"}, headers=auth_admin)
    assert r.status_code == 409
    assert r.json()["detail"] == "El salón indicado no existe"


def test_crear_salon_y_categoria_duplicados_409(client, auth_admin, salon, categoria):
    r = client.post("/api/salones", json={"nombre": "Salón Principal"}, headers=auth_admin)
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya existe un registro con ese nombre"
    r = client.post("/api/categorias", json={"nombre": "Platos"}, headers=auth_admin)
    assert r.status_code == 409
    assert r.json()["detail"] == "Ya existe un registro con ese nombre"


def test_agregar_item_cantidad_cero_422(client, auth_mozo, mesa, usuario_mozo, producto):
    pedido = _pedido_abierto(client, auth_mozo, mesa, usuario_mozo)
    r = client.post(f"/api/pedidos/{pedido['id']}/items",
                    json={"producto_id": producto.id, "cantidad": 0}, headers=auth_mozo)
    assert r.status_code == 422


def test_agregar_item_cantidad_negativa_422(client, auth_mozo, mesa, usuario_mozo, producto):
    pedido = _pedido_abierto(client, auth_mozo, mesa, usuario_mozo)
    r = client.post(f"/api/pedidos/{pedido['id']}/items",
                    json={"producto_id": producto.id, "cantidad": -2}, headers=auth_mozo)
    assert r.status_code == 422


def test_producto_precio_cero_es_valido(client, auth_admin, categoria):
    base = {"categoria_id": categoria.id, "nombre": "Cortesía"}
    assert client.post("/api/productos", json={**base, "precio": 0}, headers=auth_admin).status_code == 200
    assert client.post("/api/productos", json={**base, "nombre": "Malo", "precio": -1},
                       headers=auth_admin).status_code == 422


def test_pedido_tipo_invalido_422(client, auth_mozo, mesa, usuario_mozo):
    r = client.post("/api/pedidos", json={"mesa_id": mesa.id, "usuario_id": usuario_mozo.id, "tipo": "x"},
                    headers=auth_mozo)
    assert r.status_code == 422


def test_comprobante_metodo_pago_invalido_422(client, auth_cajero):
    r = client.post("/api/comprobantes", json={"pedido_id": 1, "tipo": "boleta", "metodo_pago": "bitcoin"},
                    headers=auth_cajero)
    assert r.status_code == 422


def test_mesa_capacidad_cero_422(client, auth_admin, salon):
    r = client.post("/api/mesas", json={"salon_id": salon.id, "numero": "09", "capacidad": 0}, headers=auth_admin)
    assert r.status_code == 422


def test_abrir_pedido_con_huerfano_sigue_funcionando(client, auth_mozo, db, mesa, usuario_mozo):
    db.add(models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="abierto"))
    db.commit()
    r = client.post("/api/pedidos", json={"mesa_id": mesa.id, "usuario_id": usuario_mozo.id}, headers=auth_mozo)
    assert r.status_code == 200
    db.expire_all()
    abiertos = db.query(models.Pedido).filter(models.Pedido.mesa_id == mesa.id,
                                              models.Pedido.estado == "abierto").count()
    assert abiertos == 1


def test_restriccion_desconocida_devuelve_mensaje_generico():
    import asyncio
    from types import SimpleNamespace
    from sqlalchemy.exc import IntegrityError
    from app.integridad import manejar_integrity_error
    orig = SimpleNamespace(diag=SimpleNamespace(constraint_name="no_existe"))
    resp = asyncio.run(manejar_integrity_error(None, IntegrityError("x", {}, orig)))
    assert resp.status_code == 409
    assert b"viola una regla de integridad" in resp.body
