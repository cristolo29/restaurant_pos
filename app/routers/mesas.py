from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/mesas", tags=["Mesas"])


@router.get("", response_model=list[schemas.MesaResponse])
def obtener_mesas(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return db.query(models.Mesa).order_by(models.Mesa.numero).all()


@router.post("", response_model=schemas.MesaResponse)
def crear_mesa(
    mesa: schemas.MesaCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    nueva = models.Mesa(salon_id=mesa.salon_id, numero=mesa.numero, capacidad=mesa.capacidad, estado="disponible")
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{mesa_id}", response_model=schemas.MesaResponse)
def actualizar_mesa(
    mesa_id: int,
    datos: schemas.MesaCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    mesa = db.query(models.Mesa).filter(models.Mesa.id == mesa_id).first()
    if not mesa:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    mesa.salon_id  = datos.salon_id
    mesa.numero    = datos.numero
    mesa.capacidad = datos.capacidad
    db.commit()
    db.refresh(mesa)
    return mesa


@router.delete("/{mesa_id}")
def eliminar_mesa(
    mesa_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    mesa = db.query(models.Mesa).filter(models.Mesa.id == mesa_id).first()
    if not mesa:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    if mesa.estado == "ocupada":
        raise HTTPException(status_code=400, detail="No se puede eliminar una mesa ocupada")
    db.delete(mesa)
    db.commit()
    return {"mensaje": f"Mesa {mesa.numero} eliminada"}
