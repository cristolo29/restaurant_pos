from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, text, Numeric, func,
    UniqueConstraint, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class Rol(Base):
    __tablename__ = "rol"
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    permisos = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    activo = Column(Boolean, nullable=False, default=True)

    usuarios = relationship("Usuario", back_populates="rol")


class Usuario(Base):
    __tablename__ = "usuario"
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    rol_id = Column(Integer, ForeignKey("orbezo.rol.id"), nullable=False)
    nombre = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    pin = Column(String(255))  # hash scrypt (app/pinhash.py), nunca el PIN en claro
    activo = Column(Boolean, nullable=False, default=True)

    rol = relationship("Rol", back_populates="usuarios")


class Categoria(Base):
    __tablename__ = "categoria"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_categoria_nombre"),
        {"schema": "orbezo"},
    )

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    descripcion = Column(String)
    activo = Column(Boolean, nullable=False, default=True)

    productos = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "producto"
    __table_args__ = (
        CheckConstraint("precio >= 0", name="ck_producto_precio"),
        {"schema": "orbezo"},
    )

    id = Column(Integer, primary_key=True, index=True)
    categoria_id = Column(Integer, ForeignKey("orbezo.categoria.id"), nullable=False)
    nombre = Column(String(120), nullable=False)
    precio = Column(Numeric(10, 2), nullable=False)
    disponible = Column(Boolean, nullable=False, default=True)
    afecto_igv = Column(Boolean, nullable=False, default=True)

    categoria = relationship("Categoria", back_populates="productos")


class Salon(Base):
    __tablename__ = "salon"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_salon_nombre"),
        {"schema": "orbezo"},
    )

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String(80), nullable=False)
    descripcion = Column(String, nullable=True)
    activo      = Column(Boolean, default=True)


class Mesa(Base):
    __tablename__ = "mesa"
    __table_args__ = (
        UniqueConstraint("salon_id", "numero", name="uq_mesa_salon_numero"),
        CheckConstraint("estado IN ('disponible','ocupada','reservada')", name="ck_mesa_estado"),
        CheckConstraint("capacidad > 0", name="ck_mesa_capacidad"),
        {"schema": "orbezo"},
    )

    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, ForeignKey("orbezo.salon.id", ondelete="RESTRICT", name="fk_mesa_salon"), nullable=False)
    numero = Column(String(10), nullable=False)
    capacidad = Column(Integer, default=4)
    estado = Column(String(20), nullable=False, default="disponible")

    pedidos = relationship("Pedido", back_populates="mesa")


class Pedido(Base):
    __tablename__ = "pedido"
    __table_args__ = (
        CheckConstraint("estado IN ('abierto','cerrado','anulado')", name="ck_pedido_estado"),
        CheckConstraint("tipo IN ('en_mesa','para_llevar','delivery')", name="ck_pedido_tipo"),
        Index("uq_pedido_abierto_por_mesa", "mesa_id", unique=True, postgresql_where=text("estado = 'abierto'")),
        CheckConstraint("subtotal >= 0 AND igv >= 0 AND total >= 0", name="ck_pedido_montos"),
        CheckConstraint("estado <> 'anulado' OR motivo_anulacion IS NOT NULL", name="ck_pedido_anulacion"),
        {"schema": "orbezo"},
    )

    id = Column(Integer, primary_key=True, index=True)
    mesa_id = Column(Integer, ForeignKey("orbezo.mesa.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("orbezo.usuario.id"), nullable=False)
    estado      = Column(String(20), default="abierto")
    tipo        = Column(String(20), default="en_mesa")
    subtotal    = Column(Numeric(10, 2), default=0)
    igv         = Column(Numeric(10, 2), default=0)
    total       = Column(Numeric(10, 2), default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    anulado_por      = Column(Integer, ForeignKey("orbezo.usuario.id", name="fk_pedido_anulado_por"))
    anulado_at       = Column(DateTime(timezone=True))
    motivo_anulacion = Column(String(200))

    mesa = relationship("Mesa", back_populates="pedidos")
    items = relationship("PedidoItem", back_populates="pedido")


class SerieComprobante(Base):
    __tablename__ = "serie_comprobante"
    __table_args__ = (
        UniqueConstraint("tipo", "serie", name="uq_serie_tipo_serie"),
        CheckConstraint("tipo IN ('boleta','factura')", name="ck_serie_tipo"),
        {"schema": "orbezo"},
    )

    id          = Column(Integer, primary_key=True, index=True)
    tipo        = Column(String(10), nullable=False)
    serie       = Column(String(4), nullable=False)
    correlativo = Column(Integer, nullable=False, default=1)
    activo      = Column(Boolean, nullable=False, default=True)


class Comprobante(Base):
    __tablename__ = "comprobante"
    __table_args__ = (
        CheckConstraint("tipo IN ('boleta','factura')", name="ck_comprobante_tipo"),
        CheckConstraint("metodo_pago IN ('efectivo','tarjeta','yape','plin')", name="ck_comprobante_metodo_pago"),
        UniqueConstraint("serie", "correlativo", name="uq_comprobante_serie_correlativo"),
        UniqueConstraint("pedido_id", name="uq_comprobante_pedido"),
        CheckConstraint("subtotal >= 0 AND igv >= 0 AND descuento >= 0 AND total >= 0 AND monto_pagado >= 0 AND vuelto >= 0", name="ck_comprobante_montos"),
        {"schema": "orbezo"},
    )

    id                  = Column(Integer, primary_key=True, index=True)
    pedido_id           = Column(Integer, ForeignKey("orbezo.pedido.id"), nullable=False)
    usuario_id          = Column(Integer, ForeignKey("orbezo.usuario.id"), nullable=False)
    serie_id            = Column(Integer, ForeignKey("orbezo.serie_comprobante.id"), nullable=False)
    tipo                = Column(String(20), nullable=False)
    serie               = Column(String(4), nullable=False)
    correlativo         = Column(Integer, nullable=False)
    tipo_doc_cliente    = Column(String(10), default="1")
    nro_doc_cliente     = Column(String(15))
    razon_social        = Column(String(200))
    direccion_cliente   = Column(String)
    subtotal            = Column(Numeric(10, 2), nullable=False)
    igv                 = Column(Numeric(10, 2), nullable=False)
    descuento           = Column(Numeric(10, 2), default=0)
    total               = Column(Numeric(10, 2), nullable=False)
    metodo_pago         = Column(String(20), default="efectivo")
    monto_pagado        = Column(Numeric(10, 2), default=0)
    vuelto              = Column(Numeric(10, 2), default=0)
    estado_sunat        = Column(String(20), default="pendiente")
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("ComprobanteItem", back_populates="comprobante")

    @property
    def numero(self):
        return f"{self.serie}-{str(self.correlativo).zfill(6)}"


class ComprobanteItem(Base):
    __tablename__ = "comprobante_item"
    __table_args__ = (
        CheckConstraint("cantidad > 0", name="ck_comprobante_item_cantidad"),
        {"schema": "orbezo"},
    )

    id              = Column(Integer, primary_key=True, index=True)
    comprobante_id  = Column(Integer, ForeignKey("orbezo.comprobante.id"), nullable=False)
    descripcion     = Column(String(250), nullable=False)
    cantidad        = Column(Numeric(10, 3), nullable=False)
    precio_unit     = Column(Numeric(10, 4), nullable=False)
    subtotal        = Column(Numeric(10, 2), nullable=False)
    igv_item        = Column(Numeric(10, 2), nullable=False, default=0)

    comprobante = relationship("Comprobante", back_populates="items")


class PedidoItem(Base):
    __tablename__ = "pedido_item"
    __table_args__ = (
        CheckConstraint("estado IN ('pendiente','en_preparacion','listo','entregado','cancelado')", name="ck_pedido_item_estado"),
        CheckConstraint("cantidad > 0", name="ck_pedido_item_cantidad"),
        CheckConstraint("precio_unit >= 0 AND subtotal >= 0", name="ck_pedido_item_montos"),
        CheckConstraint("estado <> 'cancelado' OR motivo_cancelacion IS NOT NULL", name="ck_pedido_item_cancelacion"),
        {"schema": "orbezo"},
    )

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("orbezo.pedido.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("orbezo.producto.id"), nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    precio_unit = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), default="pendiente")  # pendiente, en_preparacion, listo, cancelado
    nota = Column(String)
    cancelado_por      = Column(Integer, ForeignKey("orbezo.usuario.id", name="fk_pedido_item_cancelado_por"))
    cancelado_at       = Column(DateTime(timezone=True))
    motivo_cancelacion = Column(String(200))

    pedido   = relationship("Pedido", back_populates="items")
    producto = relationship("Producto")

    @property
    def nombre(self):
        return self.producto.nombre if self.producto else None
