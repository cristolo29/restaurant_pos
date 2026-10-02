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
