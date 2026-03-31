from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import require_roles

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])

_admin = Depends(require_roles("admin"))


@router.get("", response_model=list[schemas.UsuarioResponse])
def obtener_usuarios(db: Session = Depends(get_db), _=_admin):
    usuarios = db.query(models.Usuario).order_by(models.Usuario.nombre).all()
    result = []
    for u in usuarios:
        r = schemas.UsuarioResponse.model_validate(u)
        r.rol_nombre = u.rol.nombre if u.rol else None
        result.append(r)
    return result


@router.post("", response_model=schemas.UsuarioResponse)
def crear_usuario(datos: schemas.UsuarioCreate, db: Session = Depends(get_db), _=_admin):
    existente = db.query(models.Usuario).filter(models.Usuario.email == datos.email).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese email")
    if datos.pin:
        pin_en_uso = db.query(models.Usuario).filter(models.Usuario.pin == datos.pin).first()
        if pin_en_uso:
            raise HTTPException(status_code=400, detail=f"El PIN ya está asignado a '{pin_en_uso.nombre}'")
    nuevo = models.Usuario(
        rol_id        = datos.rol_id,
        nombre        = datos.nombre,
        email         = datos.email,
        password_hash = "sin_password",
        pin           = datos.pin,
        activo        = datos.activo,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    r = schemas.UsuarioResponse.model_validate(nuevo)
    r.rol_nombre = nuevo.rol.nombre if nuevo.rol else None
    return r


@router.put("/{usuario_id}", response_model=schemas.UsuarioResponse)
def actualizar_usuario(usuario_id: int, datos: schemas.UsuarioUpdate, db: Session = Depends(get_db), _=_admin):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    email_en_uso = db.query(models.Usuario).filter(
        models.Usuario.email == datos.email,
        models.Usuario.id != usuario_id,
    ).first()
    if email_en_uso:
        raise HTTPException(status_code=400, detail="El email ya está en uso por otro usuario")
    if datos.pin:
        pin_en_uso = db.query(models.Usuario).filter(
            models.Usuario.pin == datos.pin,
            models.Usuario.id != usuario_id,
        ).first()
        if pin_en_uso:
            raise HTTPException(status_code=400, detail=f"El PIN ya está asignado a '{pin_en_uso.nombre}'")
    usuario.rol_id = datos.rol_id
    usuario.nombre = datos.nombre
    usuario.email  = datos.email
    usuario.activo = datos.activo
    if datos.pin:
        usuario.pin = datos.pin
    db.commit()
    db.refresh(usuario)
    r = schemas.UsuarioResponse.model_validate(usuario)
    r.rol_nombre = usuario.rol.nombre if usuario.rol else None
    return r


@router.delete("/{usuario_id}")
def eliminar_usuario(usuario_id: int, db: Session = Depends(get_db), _=_admin):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(usuario)
    db.commit()
    return {"mensaje": f"Usuario '{usuario.nombre}' eliminado"}
