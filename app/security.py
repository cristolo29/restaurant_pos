from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

import os
SECRET_KEY = os.getenv("SECRET_KEY", "orbezo-secret-key-local-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

_bearer = HTTPBearer()


def create_access_token(usuario_id: int, rol: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(usuario_id), "rol": rol, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.Usuario:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        usuario_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    usuario = db.query(models.Usuario).filter(
        models.Usuario.id == usuario_id,
        models.Usuario.activo == True,
    ).first()
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    return usuario


def require_roles(*roles: str):
    """Devuelve una dependencia que exige que el usuario tenga uno de los roles indicados."""
    def dependency(current_user: models.Usuario = Depends(get_current_user)):
        if current_user.rol.nombre not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Acceso denegado. Roles permitidos: {', '.join(roles)}",
            )
        return current_user
    return dependency
