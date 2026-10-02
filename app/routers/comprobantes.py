from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas, cobro
from app.security import require_roles

router = APIRouter(prefix="/api/comprobantes", tags=["Comprobantes"])

_operador = Depends(require_roles("cajero", "admin"))
_admin    = Depends(require_roles("admin"))


def _serializar(comp: models.Comprobante) -> dict:
    return {
        "id":                comp.id,
        "tipo":              comp.tipo,
        "serie":             comp.serie,
        "correlativo":       comp.correlativo,
        "numero":            comp.numero,
        "metodo_pago":       comp.metodo_pago,
        "monto_pagado":      float(comp.monto_pagado or 0),
        "vuelto":            float(comp.vuelto or 0),
        "nro_doc_cliente":   comp.nro_doc_cliente,
        "razon_social":      comp.razon_social,
        "direccion_cliente": comp.direccion_cliente,
        "subtotal":          float(comp.subtotal),
        "igv":               float(comp.igv),
        "descuento":         float(comp.descuento or 0),
        "total":             float(comp.total),
        "estado_sunat":      comp.estado_sunat,
        "created_at":        comp.created_at.strftime("%d/%m/%Y %H:%M") if comp.created_at else None,
        "items": [
            {
                "descripcion": i.descripcion,
                "cantidad":    float(i.cantidad),
                "precio_unit": float(i.precio_unit),
                "subtotal":    float(i.subtotal),
                "igv_item":    float(i.igv_item),
            }
            for i in comp.items
        ],
    }


@router.get("")
def listar_comprobantes(db: Session = Depends(get_db), _=_admin):
    """Lista todos los comprobantes ordenados por más reciente. Solo admin."""
    comprobantes = (
        db.query(models.Comprobante)
        .order_by(models.Comprobante.id.desc())
        .all()
    )
    return [_serializar(c) for c in comprobantes]


@router.post("", response_model=schemas.ComprobanteResponse)
def emitir_comprobante(
    datos: schemas.ComprobanteCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_roles("cajero", "admin")),
):
    """OBSOLETO: usa `POST /api/pedidos/{id}/cobrar`, que cierra el pedido y emite el comprobante
    en una sola transacción. Se mantiene por compatibilidad (pedido ya cerrado con `cerrar`);
    valida el pago contra el total recalculado igual que `/cobrar`."""
    pedido = db.query(models.Pedido).filter(models.Pedido.id == datos.pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="El pedido no existe")
    if pedido.estado != "cerrado":
        raise HTTPException(status_code=400, detail="Solo se puede emitir comprobante de un pedido cerrado")

    caja = cobro.caja_abierta_de(db, current_user.id, bloquear=True)  # sin caja abierta queda NULL (compat.)
    comprobante = cobro.emitir_comprobante_de_pedido(
        db, pedido, datos, current_user, cobro.items_cobrables(db, pedido.id), caja.id if caja else None,
    )
    db.commit()
    db.refresh(comprobante)
    return _serializar(comprobante)


@router.get("/{comprobante_id}", response_model=schemas.ComprobanteResponse)
def obtener_comprobante(comprobante_id: int, db: Session = Depends(get_db), _=_operador):
    comp = db.query(models.Comprobante).filter(models.Comprobante.id == comprobante_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return _serializar(comp)
