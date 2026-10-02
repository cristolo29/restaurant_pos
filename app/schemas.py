from pydantic import BaseModel, Field
from typing import Optional, List, Literal


# --- Categorias ---

class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    activo: bool = True


class CategoriaResponse(CategoriaCreate):
    id: int

    class Config:
        from_attributes = True


# --- Productos ---

class ProductoCreate(BaseModel):
    categoria_id: int
    nombre: str
    precio: float = Field(ge=0)
    disponible: bool = True
    afecto_igv: bool = True


class ProductoResponse(ProductoCreate):
    id: int

    class Config:
        from_attributes = True


# --- Mesas ---

class MesaCreate(BaseModel):
    salon_id: int
    numero: str
    capacidad: int = Field(default=4, gt=0)


class MesaResponse(MesaCreate):
    id: int
    estado: str
    pedido_total: Optional[float] = None
    pedido_inicio: Optional[str] = None
    pedido_id: Optional[int] = None
    mozo_id: Optional[int] = None
    items_total: Optional[int] = None
    items_pendientes: Optional[int] = None
    items_listos: Optional[int] = None

    class Config:
        from_attributes = True


# --- Usuarios ---

class UsuarioCreate(BaseModel):
    rol_id: int
    nombre: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=150)
    pin: Optional[str] = Field(default=None, pattern=r"^\d{4,6}$")
    activo: bool = True


class UsuarioUpdate(BaseModel):
    rol_id: int
    nombre: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=150)
    pin: Optional[str] = Field(default=None, pattern=r"^\d{4,6}$")
    activo: bool = True


class UsuarioResponse(BaseModel):
    id: int
    rol_id: int
    nombre: str
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=150)
    activo: bool
    rol_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# --- Pedido Items ---

class ItemEstadoUpdate(BaseModel):
    estado: Literal["pendiente", "en_preparacion", "listo", "entregado", "cancelado"]


class PedidoItemCreate(BaseModel):
    producto_id: int
    cantidad: int = Field(default=1, gt=0)
    nota: Optional[str] = None


class PedidoItemResponse(PedidoItemCreate):
    id: int
    pedido_id: int
    precio_unit: float
    subtotal: float
    estado: str
    nombre: Optional[str] = None

    class Config:
        from_attributes = True


# --- Pedidos ---

class PedidoCreate(BaseModel):
    mesa_id: int
    usuario_id: int
    tipo: Literal["en_mesa", "para_llevar", "delivery"] = "en_mesa"


class PedidoResponse(PedidoCreate):
    id: int
    estado: str
    total: float

    class Config:
        from_attributes = True


class PedidoDetalleResponse(PedidoResponse):
    """Pedido completo con sus items. Usado en GET /api/pedidos/{id}"""
    items: List[PedidoItemResponse] = []

    class Config:
        from_attributes = True


# --- Comprobantes ---

class ComprobanteCreate(BaseModel):
    pedido_id:          int
    tipo:               Literal["boleta", "factura"]
    metodo_pago:        Literal["efectivo", "tarjeta", "yape", "plin"] = "efectivo"
    monto_pagado:       float = Field(default=0, ge=0)
    vuelto:             float = Field(default=0, ge=0)
    nro_doc_cliente:    Optional[str] = None
    razon_social:       Optional[str] = None
    direccion_cliente:  Optional[str] = None


class ComprobanteItemResponse(BaseModel):
    descripcion: str
    cantidad:    float
    precio_unit: float
    subtotal:    float
    igv_item:    float

    class Config:
        from_attributes = True


class ComprobanteResponse(BaseModel):
    id:                int
    tipo:              str
    serie:             str
    correlativo:       int
    numero:            str
    metodo_pago:       Optional[str]
    monto_pagado:      Optional[float]
    vuelto:            Optional[float]
    nro_doc_cliente:   Optional[str]
    razon_social:      Optional[str]
    direccion_cliente: Optional[str]
    subtotal:          float
    igv:               float
    total:             float
    estado_sunat:      str
    created_at:        Optional[str] = None
    items:             List[ComprobanteItemResponse] = []

    class Config:
        from_attributes = True


# --- Auth ---

class LoginPIN(BaseModel):
    pin: str


class LoginResponse(BaseModel):
    id: int
    nombre: str
    rol_nombre: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: LoginResponse
