"""
conftest.py — fixtures compartidas para todos los tests.
Usa una BD PostgreSQL de prueba separada (orbezo_test).
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.security import create_access_token
from app import models

# ── Base de datos de prueba ────────────────────────────────────────────────────
TEST_DB_URL = "postgresql://admin:1234@localhost:5432/orbezo_test"

engine_test = create_engine(TEST_DB_URL)
SessionTest  = sessionmaker(bind=engine_test)

# Crear schema orbezo si no existe
with engine_test.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS orbezo"))
    conn.commit()


def override_get_db():
    db = SessionTest()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ── Crear / limpiar tablas antes y después de cada test ───────────────────────
@pytest.fixture(autouse=True)
def limpiar_bd():
    """Crea las tablas antes del test y las elimina al terminar."""
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


# ── Cliente HTTP ──────────────────────────────────────────────────────────────
@pytest.fixture
def client():
    return TestClient(app)


# ── Datos base reutilizables ──────────────────────────────────────────────────
@pytest.fixture
def db():
    session = SessionTest()
    yield session
    session.close()


@pytest.fixture
def rol_admin(db):
    rol = models.Rol(nombre="admin", permisos={}, activo=True)
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


@pytest.fixture
def rol_mozo(db):
    rol = models.Rol(nombre="mozo", permisos={}, activo=True)
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


@pytest.fixture
def rol_cajero(db):
    rol = models.Rol(nombre="cajero", permisos={}, activo=True)
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


@pytest.fixture
def usuario_admin(db, rol_admin):
    u = models.Usuario(
        rol_id=rol_admin.id, nombre="Admin Test",
        email="admin@test.com", password_hash="x", pin="1111", activo=True
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def usuario_mozo(db, rol_mozo):
    u = models.Usuario(
        rol_id=rol_mozo.id, nombre="Mozo Test",
        email="mozo@test.com", password_hash="x", pin="2222", activo=True
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def usuario_cajero(db, rol_cajero):
    u = models.Usuario(
        rol_id=rol_cajero.id, nombre="Cajero Test",
        email="cajero@test.com", password_hash="x", pin="3333", activo=True
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def token_admin(usuario_admin):
    return create_access_token(usuario_admin.id, "admin")


@pytest.fixture
def token_mozo(usuario_mozo):
    return create_access_token(usuario_mozo.id, "mozo")


@pytest.fixture
def token_cajero(usuario_cajero):
    return create_access_token(usuario_cajero.id, "cajero")


@pytest.fixture
def auth_admin(token_admin):
    return {"Authorization": f"Bearer {token_admin}"}


@pytest.fixture
def auth_mozo(token_mozo):
    return {"Authorization": f"Bearer {token_mozo}"}


@pytest.fixture
def auth_cajero(token_cajero):
    return {"Authorization": f"Bearer {token_cajero}"}


@pytest.fixture
def salon(db):
    s = models.Salon(nombre="Salón Principal", activo=True)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture
def mesa(db, salon):
    m = models.Mesa(salon_id=salon.id, numero="01", capacidad=4, estado="disponible")
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@pytest.fixture
def categoria(db):
    c = models.Categoria(nombre="Platos", activo=True)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@pytest.fixture
def producto(db, categoria):
    p = models.Producto(
        categoria_id=categoria.id, nombre="Lomo Saltado",
        precio=28.00, disponible=True, afecto_igv=True
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
