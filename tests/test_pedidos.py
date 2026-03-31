"""Tests del flujo completo de pedidos: abrir → agregar items → cerrar."""


def test_abrir_pedido_mesa_disponible(client, auth_mozo, mesa, usuario_mozo):
    r = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id, "tipo": "en_mesa"
    }, headers=auth_mozo)
    assert r.status_code == 200
    assert r.json()["estado"] == "abierto"


def test_abrir_pedido_mesa_ocupada(client, auth_mozo, mesa, usuario_mozo, db):
    """No se puede abrir un pedido en una mesa ya ocupada."""
    from app import models
    mesa.estado = "ocupada"
    db.commit()
    r = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id
    }, headers=auth_mozo)
    assert r.status_code == 400


def test_agregar_item_al_pedido(client, auth_mozo, mesa, usuario_mozo, producto):
    pedido = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id
    }, headers=auth_mozo).json()

    r = client.post(f"/api/pedidos/{pedido['id']}/items", json={
        "producto_id": producto.id, "cantidad": 2
    }, headers=auth_mozo)
    assert r.status_code == 200
    assert r.json()["cantidad"] == 2
    assert float(r.json()["subtotal"]) == 56.0  # 28 * 2


def test_cancelar_pedido(client, auth_mozo, mesa, usuario_mozo, db):
    pedido = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id
    }, headers=auth_mozo).json()

    r = client.put(f"/api/pedidos/{pedido['id']}/cancelar", headers=auth_mozo)
    assert r.status_code == 200

    # Mesa debe quedar disponible
    db.refresh(mesa)
    assert mesa.estado == "disponible"


def test_cerrar_pedido_solo_cajero(client, auth_mozo, auth_cajero, mesa, usuario_mozo):
    """Solo cajero/admin puede cerrar un pedido."""
    pedido = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id
    }, headers=auth_mozo).json()

    # Mozo intenta cerrar → debe fallar
    r = client.put(f"/api/pedidos/{pedido['id']}/cerrar", headers=auth_mozo)
    assert r.status_code == 403

    # Cajero cierra → debe funcionar
    r = client.put(f"/api/pedidos/{pedido['id']}/cerrar", headers=auth_cajero)
    assert r.status_code == 200


def test_flujo_completo(client, auth_mozo, auth_cajero, mesa, usuario_mozo, producto, db):
    """Flujo end-to-end: abrir → item → cerrar → verificar mesa libre."""
    # Abrir
    pedido = client.post("/api/pedidos", json={
        "mesa_id": mesa.id, "usuario_id": usuario_mozo.id
    }, headers=auth_mozo).json()

    # Agregar item
    client.post(f"/api/pedidos/{pedido['id']}/items", json={
        "producto_id": producto.id, "cantidad": 1
    }, headers=auth_mozo)

    # Cerrar
    r = client.put(f"/api/pedidos/{pedido['id']}/cerrar", headers=auth_cajero)
    assert r.status_code == 200

    # Mesa libre
    db.refresh(mesa)
    assert mesa.estado == "disponible"
