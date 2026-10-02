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


def test_respuesta_usuarios_no_expone_pin(client, auth_admin, usuario_mozo):
    r = client.get("/api/usuarios", headers=auth_admin)
    assert r.status_code == 200
    assert all("pin" not in u for u in r.json())


def test_crear_usuario_pin_invalido(client, auth_admin, rol_mozo):
    for pin in ("12", "abcd", "1234567"):
        r = client.post("/api/usuarios", headers=auth_admin, json={
            "nombre": "X", "email": f"x{pin}@t.com", "pin": pin, "rol_id": rol_mozo.id, "activo": True
        })
        assert r.status_code == 422


def test_admin_no_puede_eliminarse_a_si_mismo(client, auth_admin, usuario_admin):
    r = client.delete(f"/api/usuarios/{usuario_admin.id}", headers=auth_admin)
    assert r.status_code == 400


def test_admin_no_puede_desactivarse_ni_quitarse_el_rol(client, auth_admin, usuario_admin, rol_mozo):
    base = {"nombre": usuario_admin.nombre, "email": usuario_admin.email}
    r = client.put(f"/api/usuarios/{usuario_admin.id}", headers=auth_admin,
                   json={**base, "rol_id": usuario_admin.rol_id, "activo": False})
    assert r.status_code == 400
    r = client.put(f"/api/usuarios/{usuario_admin.id}", headers=auth_admin,
                   json={**base, "rol_id": rol_mozo.id, "activo": True})
    assert r.status_code == 400


def test_admin_puede_eliminar_a_otro_admin(client, auth_admin, usuario_admin, db, rol_admin):
    from app import models
    from app.pinhash import hash_pin
    otro = models.Usuario(rol_id=rol_admin.id, nombre="Otro Admin", email="otro@t.com", pin=hash_pin("8888"), activo=True)
    db.add(otro); db.commit(); db.refresh(otro)
    r = client.delete(f"/api/usuarios/{otro.id}", headers=auth_admin)
    assert r.status_code == 200


def test_eliminar_usuario_con_pedidos_devuelve_409(client, auth_admin, usuario_mozo, mesa, db):
    from app import models
    db.add(models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="abierto"))
    db.commit()
    r = client.delete(f"/api/usuarios/{usuario_mozo.id}", headers=auth_admin)
    assert r.status_code == 409


def test_crear_usuario_email_invalido(client, auth_admin, rol_mozo):
    r = client.post("/api/usuarios", headers=auth_admin, json={
        "nombre": "X", "email": "no-es-email", "pin": "4321", "rol_id": rol_mozo.id, "activo": True
    })
    assert r.status_code == 422
