"""Tests de integridad: PostgreSQL debe rechazar por sí mismo los datos inválidos."""
import pytest
from sqlalchemy.exc import IntegrityError
from app import models


def nombre_violacion(db, objeto):
    """Intenta persistir `objeto`; devuelve el nombre de la restricción violada."""
    db.add(objeto)
    with pytest.raises(IntegrityError) as exc:
        db.commit()
    db.rollback()
    return exc.value.orig.diag.constraint_name


# ── Mesas, salones y semillas únicas ──────────────────────────────────────────

def test_mesa_con_salon_inexistente(db):
    assert nombre_violacion(db, models.Mesa(salon_id=9999, numero="01", estado="disponible")) == "fk_mesa_salon"


def test_mesa_sin_numero_o_sin_salon_falla(db, salon):
    for mesa in (models.Mesa(salon_id=salon.id, numero=None),
                 models.Mesa(salon_id=None, numero="1")):
        db.add(mesa)
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()


def test_numero_repetido_en_mismo_salon(db, salon, mesa):
    assert nombre_violacion(db, models.Mesa(salon_id=salon.id, numero="01")) == "uq_mesa_salon_numero"


def test_mismo_numero_en_otro_salon_es_valido(db, mesa):
    otro = models.Salon(nombre="Terraza")
    db.add(otro)
    db.commit()
    db.add(models.Mesa(salon_id=otro.id, numero="01"))
    db.commit()


def test_nombre_repetido_salon_categoria_serie(db, salon, categoria):
    assert nombre_violacion(db, models.Salon(nombre="Salón Principal")) == "uq_salon_nombre"
    assert nombre_violacion(db, models.Categoria(nombre="Platos")) == "uq_categoria_nombre"
    db.add(models.SerieComprobante(tipo="boleta", serie="B001"))
    db.commit()
    assert nombre_violacion(db, models.SerieComprobante(tipo="boleta", serie="B001")) == "uq_serie_tipo_serie"


def test_eliminar_salon_con_mesas_devuelve_409(client, auth_admin, salon, mesa):
    r = client.delete(f"/api/salones/{salon.id}", headers=auth_admin)
    assert r.status_code == 409


# ── Datos base para construir objetos inválidos ───────────────────────────────

class Base:
    """Agrupa filas válidas (mesa, pedido, serie, producto) para armar casos."""
    def __init__(self, db, mesa, usuario, producto):
        self.mesa, self.usuario, self.producto = mesa, usuario, producto
        self.serie = models.SerieComprobante(tipo="boleta", serie="B001")
        self.pedido = models.Pedido(mesa_id=mesa.id, usuario_id=usuario.id, estado="cerrado")
        db.add_all([self.serie, self.pedido])
        db.commit()

    def comprobante(self, **kw):
        datos = dict(pedido_id=self.pedido.id, usuario_id=self.usuario.id,
                     serie_id=self.serie.id, tipo="boleta", serie="B001",
                     correlativo=1, subtotal=10, igv=1.8, total=11.8)
        datos.update(kw)
        return models.Comprobante(**datos)

    def item(self, **kw):
        datos = dict(pedido_id=self.pedido.id, producto_id=self.producto.id,
                     cantidad=1, precio_unit=10, subtotal=10)
        datos.update(kw)
        return models.PedidoItem(**datos)


@pytest.fixture
def base(db, mesa, usuario_mozo, producto):
    return Base(db, mesa, usuario_mozo, producto)


# ── Estados y tipos cerrados ──────────────────────────────────────────────────

CASOS_ESTADOS = [
    (lambda b: models.Mesa(salon_id=b.mesa.salon_id, numero="99", estado="ocupda"), "ck_mesa_estado"),
    (lambda b: models.Pedido(mesa_id=b.mesa.id, usuario_id=b.usuario.id, estado="x"), "ck_pedido_estado"),
    (lambda b: models.Pedido(mesa_id=b.mesa.id, usuario_id=b.usuario.id, tipo="x"), "ck_pedido_tipo"),
    (lambda b: b.item(estado="x"), "ck_pedido_item_estado"),
    (lambda b: models.SerieComprobante(tipo="x", serie="Z001"), "ck_serie_tipo"),
    (lambda b: b.comprobante(tipo="x"), "ck_comprobante_tipo"),
    (lambda b: b.comprobante(metodo_pago="bitcoin"), "ck_comprobante_metodo_pago"),
]


@pytest.mark.parametrize("construir,esperado", CASOS_ESTADOS, ids=[c[1] for c in CASOS_ESTADOS])
def test_estado_o_tipo_invalido(db, base, construir, esperado):
    assert nombre_violacion(db, construir(base)) == esperado


def test_mesa_estado_reservada_es_valido(db, mesa):
    db.add(models.Mesa(salon_id=mesa.salon_id, numero="77", estado="reservada"))
    db.commit()


# ── Numeración fiscal y un pedido abierto por mesa ────────────────────────────

def test_correlativo_repetido(db, base):
    db.add(base.comprobante())
    db.commit()
    otro = models.Pedido(mesa_id=base.mesa.id, usuario_id=base.usuario.id, estado="cerrado")
    db.add(otro)
    db.commit()
    assert nombre_violacion(db, base.comprobante(pedido_id=otro.id)) == "uq_comprobante_serie_correlativo"


def test_dos_comprobantes_mismo_pedido(db, base):
    db.add(base.comprobante())
    db.commit()
    assert nombre_violacion(db, base.comprobante(correlativo=2)) == "uq_comprobante_pedido"


def test_segundo_pedido_abierto_en_la_misma_mesa(db, mesa, usuario_mozo):
    db.add(models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="abierto"))
    db.commit()
    otro = models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="abierto")
    assert nombre_violacion(db, otro) == "uq_pedido_abierto_por_mesa"


def test_pedido_nuevo_tras_cerrar_o_anular(db, mesa, usuario_mozo):
    for estado in ("cerrado", "anulado"):
        db.add(models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado=estado,
                             motivo_anulacion="prueba" if estado == "anulado" else None))  # ck_pedido_anulacion
    db.commit()
    db.add(models.Pedido(mesa_id=mesa.id, usuario_id=usuario_mozo.id, estado="abierto"))
    db.commit()


def test_segundo_comprobante_via_api_sigue_siendo_400(client, auth_cajero, db, base):
    """La validación de la app va antes que la restricción: 400, no 409 ni 500."""
    db.add(base.item(estado="entregado"))  # total S/ 10: el pago se valida contra los ítems
    db.commit()
    payload = {"pedido_id": base.pedido.id, "tipo": "boleta", "metodo_pago": "efectivo",
               "monto_pagado": 20.0, "vuelto": 10.0}
    r1 = client.post("/api/comprobantes", json=payload, headers=auth_cajero)
    assert r1.status_code == 200, r1.text
    r2 = client.post("/api/comprobantes", json=payload, headers=auth_cajero)
    assert r2.status_code == 400
    assert "Ya existe el comprobante" in r2.json()["detail"]


# ── Rangos numéricos ──────────────────────────────────────────────────────────

CASOS_RANGOS = [
    (lambda b: models.Producto(categoria_id=b.producto.categoria_id, nombre="X", precio=-1), "ck_producto_precio"),
    (lambda b: models.Mesa(salon_id=b.mesa.salon_id, numero="98", capacidad=0), "ck_mesa_capacidad"),
    (lambda b: b.item(cantidad=0), "ck_pedido_item_cantidad"),
    (lambda b: b.item(cantidad=-3), "ck_pedido_item_cantidad"),
    (lambda b: b.item(precio_unit=-1), "ck_pedido_item_montos"),
    (lambda b: models.Pedido(mesa_id=b.mesa.id, usuario_id=b.usuario.id, estado="cerrado", total=-1), "ck_pedido_montos"),
    (lambda b: b.comprobante(vuelto=-1), "ck_comprobante_montos"),
]


@pytest.mark.parametrize("construir,esperado", CASOS_RANGOS,
                         ids=[f"{c[1]}-{i}" for i, c in enumerate(CASOS_RANGOS)])
def test_rango_invalido(db, base, construir, esperado):
    assert nombre_violacion(db, construir(base)) == esperado


def test_comprobante_item_cantidad_cero(db, base):
    comp = base.comprobante()
    db.add(comp)
    db.commit()
    item = models.ComprobanteItem(comprobante_id=comp.id, descripcion="x", cantidad=0,
                                  precio_unit=1, subtotal=0)
    assert nombre_violacion(db, item) == "ck_comprobante_item_cantidad"


def test_precio_cero_es_valido(db, base):
    db.add(models.Producto(categoria_id=base.producto.categoria_id, nombre="Cortesía", precio=0))
    db.commit()
