from pydantic import BaseModel
from typing import Optional, List


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
    precio: float
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
    capacidad: int = 4


class MesaResponse(MesaCreate):
    id: int
    estado: str

    class Config:
        from_attributes = True


# --- Usuarios ---

class UsuarioCreate(BaseModel):
    rol_id: int
    nombre: str
    email: str
    pin: Optional[str] = None
    activo: bool = True


class UsuarioUpdate(BaseModel):
    rol_id: int
    nombre: str
    email: str
    pin: Optional[str] = None
    activo: bool = True


class UsuarioResponse(BaseModel):
    id: int
    rol_id: int
    nombre: str
    email: str
    pin: Optional[str]
    activo: bool
    rol_nombre: Optional[str] = None

    class Config:
        from_attributes = True


# --- Pedido Items ---

class PedidoItemCreate(BaseModel):
    producto_id: int
    cantidad: int = 1
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
    tipo: str = "en_mesa"


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
    tipo:               str  # "boleta" | "factura"
    metodo_pago:        str = "efectivo"
    monto_pagado:       float = 0
    vuelto:             float = 0
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
