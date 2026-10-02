"""PIN almacenado como hash con sal (scrypt): nunca en texto plano ni en respuestas."""
import importlib.util
from pathlib import Path

from sqlalchemy import text

from app import models
from app.pinhash import hash_pin, verify_pin, es_hash


def test_hash_con_sal_y_verificacion():
    h1, h2 = hash_pin("1234"), hash_pin("1234")
    assert h1 != h2  # sal aleatoria
    assert es_hash(h1) and "1234" not in h1
    assert verify_pin("1234", h1)
    assert not verify_pin("4321", h1)


def test_verify_rechaza_valores_que_no_son_hash():
    assert not verify_pin("1234", "1234")  # texto plano nunca valida
    assert not verify_pin("1234", None)
    assert not verify_pin("1234", "scrypt$basura")


def test_pin_en_bd_no_esta_en_texto_plano(db, usuario_mozo):
    fila = db.execute(text("SELECT pin FROM orbezo.usuario WHERE id=:i"), {"i": usuario_mozo.id}).scalar()
    assert fila != "2222" and es_hash(fila)


def test_login_correcto_e_incorrecto(client, usuario_mozo, usuario_cajero):
    assert client.post("/api/login", json={"pin": "3333"}).json()["usuario"]["rol_nombre"] == "cajero"
    assert client.post("/api/login", json={"pin": "2222"}).status_code == 200
    assert client.post("/api/login", json={"pin": "0000"}).status_code == 401


def test_login_ignora_usuarios_inactivos_aunque_pin_coincida(client, db, rol_mozo):
    db.add(models.Usuario(rol_id=rol_mozo.id, nombre="I", email="i@t.com", pin=hash_pin("5555"), activo=False))
    db.commit()
    assert client.post("/api/login", json={"pin": "5555"}).status_code == 401


def test_crear_usuario_guarda_hash(client, auth_admin, rol_mozo, db):
    r = client.post("/api/usuarios", headers=auth_admin, json={
        "nombre": "Nuevo", "email": "n@t.com", "pin": "4545", "rol_id": rol_mozo.id, "activo": True})
    assert r.status_code == 200
    guardado = db.execute(text("SELECT pin FROM orbezo.usuario WHERE email='n@t.com'")).scalar()
    assert guardado != "4545" and verify_pin("4545", guardado)
    assert client.post("/api/login", json={"pin": "4545"}).status_code == 200


def test_editar_usuario_rehashea_pin(client, auth_admin, usuario_mozo, db):
    r = client.put(f"/api/usuarios/{usuario_mozo.id}", headers=auth_admin, json={
        "nombre": "Mozo", "email": "mozo@test.com", "pin": "9090", "rol_id": usuario_mozo.rol_id, "activo": True})
    assert r.status_code == 200
    guardado = db.execute(text("SELECT pin FROM orbezo.usuario WHERE id=:i"), {"i": usuario_mozo.id}).scalar()
    assert verify_pin("9090", guardado)
    assert client.post("/api/login", json={"pin": "9090"}).status_code == 200
    assert client.post("/api/login", json={"pin": "2222"}).status_code == 401


def test_editar_sin_pin_conserva_hash(client, auth_admin, usuario_mozo, db):
    antes = db.execute(text("SELECT pin FROM orbezo.usuario WHERE id=:i"), {"i": usuario_mozo.id}).scalar()
    client.put(f"/api/usuarios/{usuario_mozo.id}", headers=auth_admin, json={
        "nombre": "Otro Nombre", "email": "mozo@test.com", "rol_id": usuario_mozo.rol_id, "activo": True})
    db.expire_all()
    assert db.execute(text("SELECT pin FROM orbezo.usuario WHERE id=:i"), {"i": usuario_mozo.id}).scalar() == antes


def test_pin_duplicado_rechazado_contra_hashes(client, auth_admin, rol_mozo, usuario_mozo):
    r = client.post("/api/usuarios", headers=auth_admin, json={
        "nombre": "Otro", "email": "o@t.com", "pin": "2222", "rol_id": rol_mozo.id, "activo": True})
    assert r.status_code == 400 and "PIN" in r.json()["detail"]


def test_editar_conservando_su_propio_pin_no_es_duplicado(client, auth_admin, usuario_mozo):
    r = client.put(f"/api/usuarios/{usuario_mozo.id}", headers=auth_admin, json={
        "nombre": "Mozo", "email": "mozo@test.com", "pin": "2222", "rol_id": usuario_mozo.rol_id, "activo": True})
    assert r.status_code == 200


def test_respuestas_no_exponen_pin_ni_hash(client, auth_admin, rol_mozo, usuario_mozo):
    crear = client.post("/api/usuarios", headers=auth_admin, json={
        "nombre": "N", "email": "n2@t.com", "pin": "6161", "rol_id": rol_mozo.id, "activo": True})
    listado = client.get("/api/usuarios", headers=auth_admin)
    login = client.post("/api/login", json={"pin": "2222"})
    for resp in (crear, listado, login):
        cuerpo = resp.text
        assert "pin" not in cuerpo.lower() and "scrypt" not in cuerpo


def _cargar_script():
    ruta = Path(__file__).resolve().parent.parent / "scripts" / "migrations" / "002_hashear_pins.py"
    spec = importlib.util.spec_from_file_location("hashear_pins", ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_script_migracion_hashea_y_es_idempotente(db, rol_mozo, usuario_mozo):
    from tests.conftest import engine_test
    db.execute(text("INSERT INTO orbezo.usuario (rol_id,nombre,email,pin,activo) "
                    "VALUES (:r,'Legacy','l@t.com','7777',true)"), {"r": rol_mozo.id})
    db.execute(text("INSERT INTO orbezo.usuario (rol_id,nombre,email,pin,activo) "
                    "VALUES (:r,'SinPin','s@t.com',NULL,true)"), {"r": rol_mozo.id})
    db.commit()
    mod = _cargar_script()
    assert mod.convertir(engine_test) == {"convertidos": 1, "ya_hasheados": 1, "sin_pin": 1}
    db.expire_all()
    legacy = db.execute(text("SELECT pin FROM orbezo.usuario WHERE email='l@t.com'")).scalar()
    assert verify_pin("7777", legacy)
    assert mod.convertir(engine_test)["convertidos"] == 0  # idempotente


def test_script_exige_confirmar(capsys):
    mod = _cargar_script()
    assert mod.main([]) != 0
    assert "pg_dump" in capsys.readouterr().out
