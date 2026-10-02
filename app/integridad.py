from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

MENSAJE_GENERICO = "La operación viola una regla de integridad de los datos"

MENSAJES = {
    "uq_mesa_salon_numero": "Ya existe una mesa con ese número en el salón",
    "fk_mesa_salon": "El salón indicado no existe",
    "uq_salon_nombre": "Ya existe un registro con ese nombre",
    "uq_categoria_nombre": "Ya existe un registro con ese nombre",
    "uq_pedido_abierto_por_mesa": "La mesa ya tiene un pedido abierto",
    "uq_comprobante_pedido": "El pedido ya tiene comprobante",
    "uq_comprobante_serie_correlativo": "El correlativo ya fue emitido; reintenta",
}


async def manejar_integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
    nombre = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    return JSONResponse(status_code=409, content={"detail": MENSAJES.get(nombre, MENSAJE_GENERICO)})
