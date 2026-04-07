from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
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
def emitir_comprobante(datos: schemas.ComprobanteCreate, db: Session = Depends(get_db), _=_operador):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == datos.pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="El pedido no existe")
    if pedido.estado != "cerrado":
        raise HTTPException(status_code=400, detail="Solo se puede emitir comprobante de un pedido cerrado")

    existente = db.query(models.Comprobante).filter(
        models.Comprobante.pedido_id == datos.pedido_id
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail=f"Ya existe el comprobante {existente.numero}")

    if datos.tipo == "factura" and not datos.nro_doc_cliente:
        raise HTTPException(status_code=400, detail="La factura requiere RUC del cliente")

    serie = db.query(models.SerieComprobante).filter(
        models.SerieComprobante.tipo   == datos.tipo,
        models.SerieComprobante.activo == True,
    ).with_for_update().first()
    if not serie:
        raise HTTPException(status_code=400, detail=f"No hay serie activa para {datos.tipo}")

    items_pedido = db.query(models.PedidoItem).filter(
        models.PedidoItem.pedido_id == datos.pedido_id,
        models.PedidoItem.estado    != "cancelado",
    ).all()

    bruto    = sum(float(i.subtotal) for i in items_pedido)
    igv      = bruto * 0.18 / 1.18
    subtotal = bruto - igv

    tipo_doc = "6" if datos.tipo == "factura" else "1"
    comprobante = models.Comprobante(
        pedido_id         = datos.pedido_id,
        usuario_id        = pedido.usuario_id,
        serie_id          = serie.id,
        tipo              = datos.tipo,
        serie             = serie.serie,
        correlativo       = serie.correlativo,
        tipo_doc_cliente  = tipo_doc,
        metodo_pago       = datos.metodo_pago,
        monto_pagado      = round(datos.monto_pagado, 2),
        vuelto            = round(datos.vuelto, 2),
        nro_doc_cliente   = datos.nro_doc_cliente,
        razon_social      = datos.razon_social,
        direccion_cliente = datos.direccion_cliente,
        subtotal          = round(subtotal, 2),
        igv               = round(igv, 2),
        total             = round(bruto, 2),
    )
    db.add(comprobante)
    db.flush()

    # Agrupar por producto antes de guardar en ComprobanteItem
    grupos: dict = {}
    for item in items_pedido:
        pid = item.producto_id
        if pid in grupos:
            grupos[pid]["cantidad"] += float(item.cantidad)
            grupos[pid]["subtotal"] += float(item.subtotal)
        else:
            grupos[pid] = {
                "descripcion": item.producto.nombre if item.producto else "Producto",
                "cantidad":    float(item.cantidad),
                "precio_unit": float(item.precio_unit),
                "subtotal":    float(item.subtotal),
            }

    for g in grupos.values():
        igv_item = g["subtotal"] * 0.18 / 1.18
        db.add(models.ComprobanteItem(
            comprobante_id = comprobante.id,
            descripcion    = g["descripcion"],
            cantidad       = g["cantidad"],
            precio_unit    = g["precio_unit"],
            subtotal       = round(g["subtotal"], 2),
            igv_item       = round(igv_item, 2),
        ))

    serie.correlativo += 1
    db.commit()
    db.refresh(comprobante)
    return _serializar(comprobante)


@router.get("/{comprobante_id}", response_model=schemas.ComprobanteResponse)
def obtener_comprobante(comprobante_id: int, db: Session = Depends(get_db), _=_operador):
    comp = db.query(models.Comprobante).filter(models.Comprobante.id == comprobante_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return _serializar(comp)
