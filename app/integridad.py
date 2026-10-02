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
    "ck_pedido_anulacion": "Anular un pedido exige indicar el motivo",
    "ck_pedido_item_cancelacion": "Cancelar un ítem exige indicar el motivo",
    "fk_pedido_anulado_por": "El usuario que anula no existe",
    "fk_pedido_item_cancelado_por": "El usuario que cancela no existe",
    "uq_caja_abierta_por_usuario": "El usuario ya tiene una caja abierta",
    "ck_caja_estado": "El estado de la caja no es válido",
    "ck_caja_montos": "Los montos de la caja no pueden ser negativos",
    "ck_caja_cierre": "Cerrar la caja exige el efectivo contado, la fecha y quién la cierra",
    "fk_caja_usuario": "El usuario que abre la caja no existe",
    "fk_caja_cerrada_por": "El usuario que cierra la caja no existe",
    "ck_caja_mov_tipo": "El tipo de movimiento debe ser ingreso, egreso o retiro",
    "ck_caja_mov_monto": "El monto del movimiento debe ser mayor a cero",
    "ck_caja_mov_motivo": "El motivo del movimiento debe tener entre 3 y 200 caracteres",
    "fk_caja_mov_caja": "La caja del movimiento no existe",
    "fk_caja_mov_usuario": "El usuario del movimiento no existe",
    "fk_comprobante_caja": "La caja indicada no existe",
    "uq_comprobante_pedido": "El pedido ya tiene comprobante",
    "uq_comprobante_serie_correlativo": "El correlativo ya fue emitido; reintenta",
}

# Bases migradas conservan las restricciones sin nombre explícito y Postgres puede reportar esas primero.
MENSAJES["mesa_salon_id_numero_key"] = MENSAJES["uq_mesa_salon_numero"]
MENSAJES["mesa_salon_id_fkey"] = MENSAJES["fk_mesa_salon"]
MENSAJES["comprobante_serie_correlativo_key"] = MENSAJES["uq_comprobante_serie_correlativo"]


async def manejar_integrity_error(request: Request, exc: IntegrityError) -> JSONResponse:
    nombre = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    return JSONResponse(status_code=409, content={"detail": MENSAJES.get(nombre, MENSAJE_GENERICO)})
