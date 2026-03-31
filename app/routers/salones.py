from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.security import get_current_user

router = APIRouter(prefix="/api/salones", tags=["Salones"])


@router.get("")
def obtener_salones(db: Session = Depends(get_db), _=Depends(get_current_user)):
    salones = db.query(models.Salon).filter(models.Salon.activo == True).all()
    return [{"id": s.id, "nombre": s.nombre} for s in salones]
