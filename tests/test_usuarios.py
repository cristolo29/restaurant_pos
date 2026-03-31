"""Tests de gestión de usuarios — CRUD y validaciones de negocio."""


def test_crear_usuario(client, auth_admin, rol_mozo):
    r = client.post("/api/usuarios", json={
        "nombre": "Juan Pérez", "email": "juan@test.com",
        "pin": "4444", "rol_id": rol_mozo.id, "activo": True
    }, headers=auth_admin)
    assert r.status_code == 200
    assert r.json()["nombre"] == "Juan Pérez"


def test_crear_usuario_pin_duplicado(client, auth_admin, rol_mozo, usuario_mozo):
    """No se puede crear un usuario con el PIN de otro."""
    r = client.post("/api/usuarios", json={
        "nombre": "Otro", "email": "otro@test.com",
        "pin": "2222",  # mismo que usuario_mozo
        "rol_id": rol_mozo.id, "activo": True
    }, headers=auth_admin)
    assert r.status_code == 400
    assert "PIN" in r.json()["detail"]


def test_crear_usuario_email_duplicado(client, auth_admin, rol_mozo, usuario_mozo):
    r = client.post("/api/usuarios", json={
        "nombre": "Clon", "email": "mozo@test.com",  # mismo email
        "pin": "7777", "rol_id": rol_mozo.id, "activo": True
    }, headers=auth_admin)
    assert r.status_code == 400


def test_editar_usuario_pin_de_otro(client, auth_admin, rol_mozo, usuario_mozo, usuario_cajero):
    """Al editar, no se puede asignar el PIN que ya usa otro usuario."""
    r = client.put(f"/api/usuarios/{usuario_cajero.id}", json={
        "nombre": "Cajero", "email": "cajero@test.com",
        "pin": "2222",  # PIN del mozo
        "rol_id": usuario_cajero.rol_id, "activo": True
    }, headers=auth_admin)
    assert r.status_code == 400


def test_eliminar_usuario(client, auth_admin, usuario_mozo):
    r = client.delete(f"/api/usuarios/{usuario_mozo.id}", headers=auth_admin)
    assert r.status_code == 200


def test_listar_usuarios_solo_admin(client, auth_mozo):
    r = client.get("/api/usuarios", headers=auth_mozo)
    assert r.status_code == 403
