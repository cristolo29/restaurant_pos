from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.pinhash import verify_pin
from app.ratelimit import login_limiter
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
def login_con_pin(request: Request, login_data: schemas.LoginPIN, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "desconocida"
    espera = login_limiter.segundos_bloqueado(ip)
    if espera:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Intenta de nuevo más tarde.",
            headers={"Retry-After": str(espera)},
        )
    # El login no envía usuario: se verifica contra todos los activos con PIN, sin cortar
    # al primer acierto, para que el tiempo no revele cuántos usuarios hay ni cuál coincidió.
    candidatos = db.query(models.Usuario).filter(
        models.Usuario.activo == True,
        models.Usuario.pin.isnot(None),
    ).all()
    usuario = None
    for c in candidatos:
        if verify_pin(login_data.pin, c.pin) and usuario is None:
            usuario = c

    if not usuario:
        login_limiter.registrar_fallo(ip)
        raise HTTPException(status_code=401, detail="PIN incorrecto o usuario inactivo")

    login_limiter.reiniciar(ip)

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
