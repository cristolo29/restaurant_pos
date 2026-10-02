"""Tarea 1.4: tolerancia de diferencia y autorización con PIN de administrador."""
import logging
from decimal import Decimal
import pytest
from app import caja_config, models
from app.pinhash import hash_pin
from tests.test_caja import caja_con_ventas  # noqa: F401  (fondo 100 + 56 efectivo: esperado 156)
from tests.test_cobro import serie_boleta, serie_factura  # noqa: F401

MENSAJE = "Diferencia fuera de tolerancia: requiere autorización de un administrador"


def _cerrar(client, headers, contado, **extra):
    return client.post("/api/caja/cerrar", json={"monto_contado": contado, **extra}, headers=headers)


def _estado(db, caja):
    db.expire_all()
    return db.get(models.Caja, caja.id).estado


@pytest.fixture
def otro_admin(db, rol_admin):
    u = models.Usuario(rol_id=rol_admin.id, nombre="Segundo Admin", email="admin2@test.com", pin=hash_pin("4444"), activo=True)
    db.add(u); db.commit(); db.refresh(u)
    return u


# ── Configuración de la tolerancia ────────────────────────────────────────────

def test_tolerancia_por_defecto_es_dos_soles():
    assert caja_config.leer_tolerancia(None) == Decimal("2.00")
    assert caja_config.leer_tolerancia("") == Decimal("2.00")


def test_tolerancia_se_lee_del_entorno_con_dos_decimales():
    assert caja_config.leer_tolerancia("5") == Decimal("5.00")
    assert caja_config.leer_tolerancia("0") == Decimal("0.00")
    assert caja_config.leer_tolerancia(" 1.5 ") == Decimal("1.50")


@pytest.mark.parametrize("valor", ["abc", "-1", "NaN", "Infinity", "1,5", "1.234"])
def test_tolerancia_invalida_falla_con_mensaje_claro(valor):
    with pytest.raises(RuntimeError) as exc:
        caja_config.leer_tolerancia(valor)
    assert "CAJA_TOLERANCIA" in str(exc.value)


# ── Dentro y fuera de tolerancia ──────────────────────────────────────────────

def test_dentro_de_tolerancia_cierra_sin_pin_ni_autorizador(client, auth_cajero, caja_con_ventas):
    r = _cerrar(client, auth_cajero, 154.0, observaciones="Faltó un sencillo")  # -2.00 exacto
    assert r.status_code == 200, r.text
    assert r.json()["diferencia"] == -2.0 and r.json()["autorizado_por"] is None


def test_un_centimo_fuera_de_tolerancia_exige_autorizacion(client, auth_cajero, caja_con_ventas, db):
    r = _cerrar(client, auth_cajero, 153.99, observaciones="Faltó un sencillo")  # -2.01
    assert r.status_code == 403 and r.json()["detail"] == MENSAJE
    assert _estado(db, caja_con_ventas) == "abierta"


def test_sin_diferencia_no_pide_pin(client, auth_cajero, caja_con_ventas):
    assert _cerrar(client, auth_cajero, 156.0).status_code == 200


def test_tolerancia_configurable(client, auth_cajero, caja_con_ventas, monkeypatch):
    monkeypatch.setattr(caja_config, "TOLERANCIA", Decimal("10.00"))
    assert _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio").status_code == 200  # -6 < 10


def test_tolerancia_cero_exige_autorizacion_por_cualquier_diferencia(client, auth_cajero, caja_con_ventas, monkeypatch):
    monkeypatch.setattr(caja_config, "TOLERANCIA", Decimal("0.00"))
    assert _cerrar(client, auth_cajero, 155.99, observaciones="Un centavo").status_code == 403


def test_diferencia_con_decimales_usa_aritmetica_exacta(client, auth_cajero, caja_cajero, db, monkeypatch):
    monkeypatch.setattr(caja_config, "TOLERANCIA", Decimal("0.30"))
    caja_cajero.monto_inicial = Decimal("0.00"); db.commit()
    # 0.1 + 0.2 = 0.3 exacto: diferencia 0.30 == tolerancia, cierra sin PIN (en float 0.1+0.2 > 0.3)
    r = _cerrar(client, auth_cajero, 0.3, observaciones="Monedas sueltas")
    assert r.status_code == 200 and r.json()["diferencia"] == 0.3


# ── Fuera de tolerancia con PIN ───────────────────────────────────────────────

def test_fuera_de_tolerancia_sin_pin_403(client, auth_cajero, caja_con_ventas, db, usuario_admin):
    r = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio")
    assert r.status_code == 403 and r.json()["detail"] == MENSAJE
    assert _estado(db, caja_con_ventas) == "abierta"


def test_pin_incorrecto_403_y_no_cierra(client, auth_cajero, caja_con_ventas, db, usuario_admin):
    r = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="9999")
    assert r.status_code == 403 and r.json()["detail"] == MENSAJE
    assert _estado(db, caja_con_ventas) == "abierta"


def test_pin_de_un_no_admin_no_autoriza(client, auth_cajero, caja_con_ventas, usuario_admin, usuario_mozo, db):
    for pin in ("3333", "2222"):  # el del propio cajero y el del mozo
        r = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion=pin)
        assert r.status_code == 403
    assert _estado(db, caja_con_ventas) == "abierta"


def test_pin_de_admin_inactivo_no_autoriza(client, auth_cajero, caja_con_ventas, usuario_admin, db):
    usuario_admin.activo = False; db.commit()
    assert _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="1111").status_code == 403


def test_pin_valido_de_admin_cierra_y_registra_quien_autorizo(client, auth_cajero, caja_con_ventas, usuario_admin, db):
    r = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="1111")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["estado"] == "cerrada" and d["diferencia"] == -6.0
    assert d["autorizado_por"] == usuario_admin.id and d["autorizado_por_nombre"] == "Admin Test"
    db.expire_all()
    assert db.get(models.Caja, caja_con_ventas.id).autorizado_por == usuario_admin.id


def test_pin_de_autorizacion_innecesario_dentro_de_tolerancia_no_se_registra(client, auth_cajero, caja_con_ventas, usuario_admin):
    r = _cerrar(client, auth_cajero, 155.0, observaciones="Faltó cambio", pin_autorizacion="1111")
    assert r.status_code == 200 and r.json()["autorizado_por"] is None


def test_observaciones_siguen_siendo_obligatorias_antes_de_pedir_pin(client, auth_cajero, caja_con_ventas, usuario_admin):
    assert _cerrar(client, auth_cajero, 150.0, pin_autorizacion="1111").status_code == 422


# ── Quién autoriza ────────────────────────────────────────────────────────────

@pytest.fixture
def caja_admin(db, usuario_admin):
    c = models.Caja(usuario_id=usuario_admin.id, monto_inicial=100); db.add(c); db.commit(); db.refresh(c)
    return c


def test_admin_con_otros_admins_no_puede_autorizarse_a_si_mismo(client, auth_admin, caja_admin, otro_admin, db):
    r = _cerrar(client, auth_admin, 90.0, observaciones="Se perdió un billete de diez", pin_autorizacion="1111")
    assert r.status_code == 403 and r.json()["detail"] == MENSAJE
    assert _estado(db, caja_admin) == "abierta"


def test_admin_con_otro_admin_cierra_con_el_pin_del_otro(client, auth_admin, caja_admin, otro_admin, db):
    r = _cerrar(client, auth_admin, 90.0, observaciones="Se perdió un billete de diez", pin_autorizacion="4444")
    assert r.status_code == 200, r.text
    assert r.json()["autorizado_por"] == otro_admin.id


def test_unico_admin_se_autoriza_a_si_mismo_con_observaciones_reforzadas(client, auth_admin, caja_admin, usuario_admin):
    corta = _cerrar(client, auth_admin, 90.0, observaciones="Billete", pin_autorizacion="1111")  # 7 caracteres
    assert corta.status_code == 422 and "10 caracteres" in corta.json()["detail"]
    r = _cerrar(client, auth_admin, 90.0, observaciones="Se perdió un billete", pin_autorizacion="1111")
    assert r.status_code == 200, r.text
    assert r.json()["autorizado_por"] == usuario_admin.id


def test_admin_inactivo_adicional_no_cuenta_como_otro_admin(client, auth_admin, caja_admin, otro_admin, db):
    otro_admin.activo = False; db.commit()
    r = _cerrar(client, auth_admin, 90.0, observaciones="Se perdió un billete", pin_autorizacion="1111")
    assert r.status_code == 200, r.text


def test_cajero_con_un_solo_admin_usa_el_pin_del_admin_con_observaciones_normales(client, auth_cajero, caja_con_ventas, usuario_admin):
    assert _cerrar(client, auth_cajero, 150.0, observaciones="Faltó", pin_autorizacion="1111").status_code == 200


# ── Intentos repetidos y confidencialidad del PIN ─────────────────────────────

def test_intentos_fallidos_repetidos_se_bloquean_con_429(client, auth_cajero, caja_con_ventas, usuario_admin, db):
    for _ in range(5):
        r = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="0000")
        assert r.status_code == 403
    r = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="1111")  # correcto, pero bloqueado
    assert r.status_code == 429 and int(r.headers["Retry-After"]) > 0
    assert _estado(db, caja_con_ventas) == "abierta"


def test_pin_correcto_reinicia_el_contador(client, auth_cajero, caja_con_ventas, usuario_admin, db, caja_cajero):
    for _ in range(4):
        _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="0000")
    assert _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="1111").status_code == 200
    from app.ratelimit import autorizacion_limiter
    assert autorizacion_limiter.segundos_bloqueado(f"caja:{caja_cajero.usuario_id}") == 0


def test_el_bloqueo_es_por_usuario(client, auth_cajero, caja_con_ventas, usuario_admin, otro_admin, caja_admin, auth_admin):
    for _ in range(5):
        _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="0000")
    # otro usuario no queda bloqueado por los fallos del cajero
    r = _cerrar(client, auth_admin, 90.0, observaciones="Se perdió un billete", pin_autorizacion="4444")
    assert r.status_code == 200


def test_sin_pin_no_cuenta_como_intento(client, auth_cajero, caja_con_ventas, usuario_admin):
    for _ in range(8):
        assert _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio").status_code == 403
    assert _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="1111").status_code == 200


def test_el_pin_nunca_aparece_en_logs_ni_respuestas(client, auth_cajero, caja_con_ventas, usuario_admin, caplog):
    caplog.set_level(logging.DEBUG)
    mala = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="918273")
    buena = _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion="1111")
    for r in (mala, buena):
        assert "918273" not in r.text and "1111" not in r.text and "pin_autorizacion" not in r.text
    assert "918273" not in caplog.text and "1111" not in caplog.text
    assert "pin" not in {k.lower() for k in buena.json()}  # ningún campo de la respuesta devuelve el PIN
    assert "hash" not in buena.text.lower() and "scrypt" not in buena.text


def test_el_mensaje_no_revela_que_admins_existen(client, auth_cajero, caja_con_ventas, usuario_admin, otro_admin):
    mensajes = {
        _cerrar(client, auth_cajero, 150.0, observaciones="Faltó cambio", pin_autorizacion=pin).json()["detail"]
        for pin in ("0000", "3333", "9999")
    }
    assert mensajes == {MENSAJE}


def test_error_de_validacion_del_pin_no_lo_repite(client, auth_cajero, caja_con_ventas):
    r = client.post("/api/caja/cerrar", json={"monto_contado": 1, "pin_autorizacion": ["secreto-1234"]}, headers=auth_cajero)
    assert r.status_code == 422 and "secreto-1234" not in r.text


def test_bd_fk_autorizado_por(db, usuario_cajero):
    from sqlalchemy.exc import IntegrityError
    db.add(models.Caja(usuario_id=usuario_cajero.id, monto_inicial=0, estado="cerrada", monto_contado=0,
                       cerrada_at=models.func.now(), cerrada_por=usuario_cajero.id, autorizado_por=9999))
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    db.rollback()
    assert exc.value.orig.diag.constraint_name == "fk_caja_autorizado_por"


def test_la_api_no_arranca_con_tolerancia_invalida():
    import os, subprocess, sys
    env = {**os.environ, "CAJA_TOLERANCIA": "mucho", "SECRET_KEY": "x" * 40}
    r = subprocess.run([sys.executable, "-c", "import app.main"], env=env, capture_output=True, text=True)
    assert r.returncode != 0 and "CAJA_TOLERANCIA inválida" in r.stderr
    env["CAJA_TOLERANCIA"] = "3.50"
    assert subprocess.run([sys.executable, "-c", "import app.main"], env=env, capture_output=True).returncode == 0
