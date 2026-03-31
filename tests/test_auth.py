"""Tests de autenticación — login, JWT, acceso sin token."""


def test_login_pin_correcto(client, usuario_mozo):
    r = client.post("/api/login", json={"pin": "2222"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["usuario"]["nombre"] == "Mozo Test"
    assert data["usuario"]["rol_nombre"] == "mozo"


def test_login_pin_incorrecto(client, usuario_mozo):
    r = client.post("/api/login", json={"pin": "9999"})
    assert r.status_code == 401


def test_login_usuario_inactivo(client, db, rol_mozo):
    from app import models
    u = models.Usuario(
        rol_id=rol_mozo.id, nombre="Inactivo",
        email="inactivo@test.com", password_hash="x", pin="5555", activo=False
    )
    db.add(u); db.commit()
    r = client.post("/api/login", json={"pin": "5555"})
    assert r.status_code == 401


def test_endpoint_sin_token_rechazado(client):
    r = client.get("/api/mesas")
    assert r.status_code == 403 or r.status_code == 401


def test_endpoint_con_token_invalido(client):
    r = client.get("/api/mesas", headers={"Authorization": "Bearer token_falso"})
    assert r.status_code == 401


def test_endpoint_rol_insuficiente(client, auth_mozo):
    """Un mozo no puede listar usuarios (solo admin)."""
    r = client.get("/api/usuarios", headers=auth_mozo)
    assert r.status_code == 403
