from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import create_access_token, require_roles

router = APIRouter(prefix="/api", tags=["Auth"])


@router.get("/roles")
def obtener_roles(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    roles = db.query(models.Rol).filter(models.Rol.activo == True).all()
    return [{"id": r.id, "nombre": r.nombre} for r in roles]


@router.post("/login", response_model=schemas.TokenResponse)
def login_con_pin(login_data: schemas.LoginPIN, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(
        models.Usuario.pin == login_data.pin,
        models.Usuario.activo == True,
    ).first()

    if not usuario:
        raise HTTPException(status_code=401, detail="PIN incorrecto o usuario inactivo")

    token = create_access_token(usuario.id, usuario.rol.nombre)
    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id":        usuario.id,
            "nombre":    usuario.nombre,
            "rol_nombre": usuario.rol.nombre,
        },
    }
