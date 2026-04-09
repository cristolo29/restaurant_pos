from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app import models
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/salones", tags=["Salones"])

_admin = Depends(require_roles("admin"))


@router.get("")
def obtener_salones(db: Session = Depends(get_db), _=Depends(get_current_user)):
    salones = db.query(models.Salon).filter(models.Salon.activo == True).order_by(models.Salon.id).all()
    return [{"id": s.id, "nombre": s.nombre, "descripcion": s.descripcion, "activo": s.activo} for s in salones]


@router.get("/todos")
def obtener_salones_todos(db: Session = Depends(get_db), _=_admin):
    """Incluye salones inactivos. Solo admin."""
    salones = db.query(models.Salon).order_by(models.Salon.id).all()
    return [{"id": s.id, "nombre": s.nombre, "descripcion": s.descripcion, "activo": s.activo} for s in salones]


@router.post("")
def crear_salon(datos: dict, db: Session = Depends(get_db), _=_admin):
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    salon = models.Salon(
        nombre      = nombre,
        descripcion = (datos.get("descripcion") or "").strip() or None,
        activo      = datos.get("activo", True),
    )
    db.add(salon)
    db.commit()
    db.refresh(salon)
    return {"id": salon.id, "nombre": salon.nombre, "descripcion": salon.descripcion, "activo": salon.activo}


@router.put("/{salon_id}")
def actualizar_salon(salon_id: int, datos: dict, db: Session = Depends(get_db), _=_admin):
    salon = db.query(models.Salon).filter(models.Salon.id == salon_id).first()
    if not salon:
        raise HTTPException(status_code=404, detail="Salón no encontrado")
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    salon.nombre      = nombre
    salon.descripcion = (datos.get("descripcion") or "").strip() or None
    salon.activo      = datos.get("activo", salon.activo)
    db.commit()
    db.refresh(salon)
    return {"id": salon.id, "nombre": salon.nombre, "descripcion": salon.descripcion, "activo": salon.activo}


@router.delete("/{salon_id}")
def eliminar_salon(salon_id: int, db: Session = Depends(get_db), _=_admin):
    salon = db.query(models.Salon).filter(models.Salon.id == salon_id).first()
    if not salon:
        raise HTTPException(status_code=404, detail="Salón no encontrado")
    try:
        db.delete(salon)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar: hay mesas asignadas a este salón. Elimina o reasigna las mesas primero."
        )
    return {"ok": True}
