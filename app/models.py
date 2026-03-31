from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, text, Numeric, func
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
    password_hash = Column(String(255), nullable=False)
    pin = Column(String(6))
    activo = Column(Boolean, nullable=False, default=True)

    rol = relationship("Rol", back_populates="usuarios")


class Categoria(Base):
    __tablename__ = "categoria"
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), nullable=False)
    descripcion = Column(String)
    activo = Column(Boolean, nullable=False, default=True)

    productos = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "producto"
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    categoria_id = Column(Integer, ForeignKey("orbezo.categoria.id"), nullable=False)
    nombre = Column(String(120), nullable=False)
    precio = Column(Numeric(10, 2), nullable=False)
    disponible = Column(Boolean, nullable=False, default=True)
    afecto_igv = Column(Boolean, nullable=False, default=True)

    categoria = relationship("Categoria", back_populates="productos")


class Salon(Base):
    __tablename__ = "salon"
    __table_args__ = {"schema": "orbezo"}

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String(80), nullable=False)
    descripcion = Column(String, nullable=True)
    activo      = Column(Boolean, default=True)


class Mesa(Base):
    __tablename__ = "mesa"
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    salon_id = Column(Integer, nullable=True)
    numero = Column(String(10), nullable=True)
    capacidad = Column(Integer, default=4)
    estado = Column(String(20), default="disponible")

    pedidos = relationship("Pedido", back_populates="mesa")


class Pedido(Base):
    __tablename__ = "pedido"
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    mesa_id = Column(Integer, ForeignKey("orbezo.mesa.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("orbezo.usuario.id"), nullable=False)
    estado      = Column(String(20), default="abierto")
    tipo        = Column(String(20), default="en_mesa")
    subtotal    = Column(Numeric(10, 2), default=0)
    igv         = Column(Numeric(10, 2), default=0)
    total       = Column(Numeric(10, 2), default=0)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    mesa = relationship("Mesa", back_populates="pedidos")
    items = relationship("PedidoItem", back_populates="pedido")


class SerieComprobante(Base):
    __tablename__ = "serie_comprobante"
    __table_args__ = {"schema": "orbezo"}

    id          = Column(Integer, primary_key=True, index=True)
    tipo        = Column(String(10), nullable=False)
    serie       = Column(String(4), nullable=False)
    correlativo = Column(Integer, nullable=False, default=1)
    activo      = Column(Boolean, nullable=False, default=True)


class Comprobante(Base):
    __tablename__ = "comprobante"
    __table_args__ = {"schema": "orbezo"}

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
    __table_args__ = {"schema": "orbezo"}

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
    __table_args__ = {"schema": "orbezo"}

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("orbezo.pedido.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("orbezo.producto.id"), nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    precio_unit = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), default="pendiente")  # pendiente, en_preparacion, listo, cancelado
    nota = Column(String)

    pedido   = relationship("Pedido", back_populates="items")
    producto = relationship("Producto")

    @property
    def nombre(self):
        return self.producto.nombre if self.producto else None
