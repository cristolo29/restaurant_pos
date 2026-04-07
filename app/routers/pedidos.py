from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/pedidos", tags=["Pedidos"])

_auth     = Depends(get_current_user)
_cocina   = Depends(require_roles("cocinero", "admin"))
_operador = Depends(require_roles("mozo", "cajero", "admin"))
_cajero   = Depends(require_roles("cajero", "admin"))


def _recalcular_totales(pedido: models.Pedido, db: Session):
    """Recalcula subtotal, IGV y total del pedido a partir de sus ítems activos.

    Productos con afecto_igv=True  → precio incluye IGV (se descompone).
    Productos con afecto_igv=False → precio sin IGV (no aporta IGV).
    """
    items = db.query(models.PedidoItem).filter(
        models.PedidoItem.pedido_id == pedido.id,
        models.PedidoItem.estado    != "cancelado",
    ).all()

    total_gravado   = sum(float(i.subtotal) for i in items if i.producto and i.producto.afecto_igv)
    total_inafecto  = sum(float(i.subtotal) for i in items if not i.producto or not i.producto.afecto_igv)

    igv             = round(total_gravado * 0.18 / 1.18, 2)
    pedido.subtotal = round((total_gravado - igv) + total_inafecto, 2)
    pedido.igv      = igv
    pedido.total    = round(total_gravado + total_inafecto, 2)


@router.post("", response_model=schemas.PedidoResponse)
def abrir_pedido(pedido: schemas.PedidoCreate, db: Session = Depends(get_db), _=_operador):
    mesa = db.query(models.Mesa).filter(models.Mesa.id == pedido.mesa_id).first()

    if not mesa:
        raise HTTPException(status_code=404, detail="La mesa no existe")
    if mesa.estado not in ("disponible", "ocupada"):
        raise HTTPException(status_code=400, detail=f"La mesa ya está {mesa.estado}")

    # Protección: si quedó un pedido abierto huérfano, lo anula antes de continuar
    huerfano = db.query(models.Pedido).filter(
        models.Pedido.mesa_id == pedido.mesa_id,
        models.Pedido.estado  == "abierto",
    ).first()
    if huerfano:
        huerfano.estado = "anulado"
        db.flush()

    nuevo_pedido = models.Pedido(
        mesa_id    = pedido.mesa_id,
        usuario_id = pedido.usuario_id,
        tipo       = pedido.tipo,
        estado     = "abierto",
    )
    if mesa.estado == "disponible":
        mesa.estado = "ocupada"

    db.add(nuevo_pedido)
    db.commit()
    db.refresh(nuevo_pedido)
    return nuevo_pedido


@router.get("/mesa/{mesa_id}/abierto", response_model=schemas.PedidoDetalleResponse)
def obtener_pedido_abierto(mesa_id: int, db: Session = Depends(get_db), _=_auth):
    pedido = db.query(models.Pedido).filter(
        models.Pedido.mesa_id == mesa_id,
        models.Pedido.estado  == "abierto",
    ).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="No hay pedido abierto para esta mesa")
    return pedido


@router.get("/{pedido_id}", response_model=schemas.PedidoDetalleResponse)
def obtener_pedido(pedido_id: int, db: Session = Depends(get_db), _=_auth):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="El pedido no existe")
    return pedido


@router.post("/{pedido_id}/items", response_model=schemas.PedidoItemResponse)
def agregar_item(pedido_id: int, item: schemas.PedidoItemCreate, db: Session = Depends(get_db), _=_operador):
    producto = db.query(models.Producto).filter(models.Producto.id == item.producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="El producto no existe en la carta")

    # Si ya hay un ítem pendiente del mismo producto, sumar cantidad
    existente = db.query(models.PedidoItem).filter(
        models.PedidoItem.pedido_id   == pedido_id,
        models.PedidoItem.producto_id == item.producto_id,
        models.PedidoItem.estado      == "pendiente",
    ).first()

    if existente:
        existente.cantidad += item.cantidad
        existente.subtotal  = float(existente.precio_unit) * existente.cantidad
        db.flush()
        pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
        if pedido:
            _recalcular_totales(pedido, db)
        db.commit()
        db.refresh(existente)
        return existente

    nuevo_item = models.PedidoItem(
        pedido_id   = pedido_id,
        producto_id = item.producto_id,
        cantidad    = item.cantidad,
        precio_unit = producto.precio,
        subtotal    = float(producto.precio) * item.cantidad,
        nota        = item.nota,
    )
    db.add(nuevo_item)
    db.flush()

    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    if pedido:
        _recalcular_totales(pedido, db)

    db.commit()
    db.refresh(nuevo_item)
    return nuevo_item


@router.put("/items/{item_id}/estado")
def actualizar_estado_item(
    item_id: int,
    datos: dict,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    """
    Avanza el estado de un ítem (todos los roles) o lo cancela (solo mozo/cajero/admin).
    El cocinero solo puede avanzar estados, no cancelar.
    """
    estados_validos = ["pendiente", "en_preparacion", "listo", "entregado", "cancelado"]
    nuevo_estado = datos.get("estado")
    if nuevo_estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {nuevo_estado}")

    rol = current_user.rol.nombre
    if nuevo_estado == "cancelado" and rol not in ("mozo", "cajero", "admin"):
        raise HTTPException(status_code=403, detail="Solo mozo, cajero o admin pueden cancelar ítems")
    if nuevo_estado != "cancelado" and rol not in ("cocinero", "mozo", "cajero", "admin"):
        raise HTTPException(status_code=403, detail="No tienes permiso para cambiar este estado")

    item = db.query(models.PedidoItem).filter(models.PedidoItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    item.estado = nuevo_estado

    if nuevo_estado == "cancelado":
        pedido = db.query(models.Pedido).filter(models.Pedido.id == item.pedido_id).first()
        if pedido:
            _recalcular_totales(pedido, db)

    db.commit()
    return {"id": item.id, "estado": item.estado}


@router.put("/{pedido_id}/cancelar")
def cancelar_pedido(pedido_id: int, db: Session = Depends(get_db), _=_operador):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="El pedido no existe")
    if pedido.estado != "abierto":
        raise HTTPException(status_code=400, detail=f"No se puede anular un pedido {pedido.estado}")

    mesa  = db.query(models.Mesa).filter(models.Mesa.id == pedido.mesa_id).first()
    items = db.query(models.PedidoItem).filter(models.PedidoItem.pedido_id == pedido_id).all()

    pedido.estado = "anulado"
    if mesa:
        mesa.estado = "disponible"
    for item in items:
        item.estado = "cancelado"

    db.commit()
    return {
        "mensaje":       "Pedido cancelado. Mesa liberada.",
        "pedido_id":     pedido.id,
        "mesa_liberada": mesa.numero if mesa else "Desconocida",
    }


@router.put("/{pedido_id}/cerrar")
def cerrar_pedido(pedido_id: int, db: Session = Depends(get_db), _=_cajero):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="El pedido no existe")
    if pedido.estado == "cerrado":
        raise HTTPException(status_code=400, detail="Este pedido ya fue cerrado")

    items_pendientes = db.query(models.PedidoItem).filter(
        models.PedidoItem.pedido_id == pedido_id,
        models.PedidoItem.estado.in_(["pendiente", "en_preparacion"]),
    ).count()
    if items_pendientes > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Hay {items_pendientes} ítem(s) aún en cocina. Espera a que estén listos antes de cobrar.",
        )

    mesa  = db.query(models.Mesa).filter(models.Mesa.id == pedido.mesa_id).first()
    items = db.query(models.PedidoItem).filter(models.PedidoItem.pedido_id == pedido_id).all()

    pedido.estado = "cerrado"
    if mesa:
        mesa.estado = "disponible"
    for item in items:
        if item.estado != "cancelado":
            item.estado = "entregado"

    db.commit()
    db.refresh(pedido)
    return {
        "mensaje":           "¡Cobro exitoso!",
        "pedido_id":         pedido.id,
        "mesa_liberada":     mesa.numero if mesa else "Desconocida",
        "platos_entregados": len(items),
        "estado_actual":     pedido.estado,
    }
