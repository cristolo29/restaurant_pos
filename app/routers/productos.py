from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app import models, schemas
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/productos", tags=["Productos"])


@router.get("", response_model=list[schemas.ProductoResponse])
def obtener_carta(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return db.query(models.Producto).filter(models.Producto.disponible == True).all()


@router.get("/todos", response_model=list[schemas.ProductoResponse])
def obtener_todos(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    """Para el panel admin: incluye productos no disponibles."""
    return db.query(models.Producto).order_by(models.Producto.categoria_id, models.Producto.nombre).all()


@router.post("", response_model=schemas.ProductoResponse)
def crear_producto(
    producto: schemas.ProductoCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    nuevo = models.Producto(
        categoria_id=producto.categoria_id,
        nombre=producto.nombre,
        precio=producto.precio,
        disponible=producto.disponible,
        afecto_igv=producto.afecto_igv,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/{prod_id}", response_model=schemas.ProductoResponse)
def actualizar_producto(
    prod_id: int,
    datos: schemas.ProductoCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    prod = db.query(models.Producto).filter(models.Producto.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    prod.categoria_id = datos.categoria_id
    prod.nombre       = datos.nombre
    prod.precio       = datos.precio
    prod.disponible   = datos.disponible
    prod.afecto_igv   = datos.afecto_igv
    db.commit()
    db.refresh(prod)
    return prod


@router.delete("/{prod_id}")
def eliminar_producto(
    prod_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    prod = db.query(models.Producto).filter(models.Producto.id == prod_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    try:
        db.delete(prod)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: el producto tiene pedidos asociados. Desactívalo en su lugar.",
        )
    return {"mensaje": f"Producto '{prod.nombre}' eliminado"}
