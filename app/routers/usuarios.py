from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.pinhash import hash_pin, verify_pin
from app.security import require_roles

router = APIRouter(prefix="/api/usuarios", tags=["Usuarios"])

_admin = Depends(require_roles("admin"))


def _admins_activos_restantes(db: Session, excluir_id: int) -> int:
    return db.query(models.Usuario).join(models.Rol).filter(
        models.Rol.nombre == "admin",
        models.Usuario.activo == True,
        models.Usuario.id != excluir_id,
    ).count()


def _usuario_con_pin(db: Session, pin: str, excluir_id: int | None = None):
    """Busca quién usa ese PIN comparando contra los hashes (sal distinta por usuario)."""
    q = db.query(models.Usuario).filter(models.Usuario.pin.isnot(None))
    if excluir_id is not None:
        q = q.filter(models.Usuario.id != excluir_id)
    encontrado = None
    for u in q.all():
        if verify_pin(pin, u.pin) and encontrado is None:
            encontrado = u
    return encontrado


def _es_admin_activo(u: models.Usuario) -> bool:
    return bool(u.activo and u.rol and u.rol.nombre == "admin")


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
        pin_en_uso = _usuario_con_pin(db, datos.pin)
        if pin_en_uso:
            raise HTTPException(status_code=400, detail=f"El PIN ya está asignado a '{pin_en_uso.nombre}'")
    nuevo = models.Usuario(
        rol_id = datos.rol_id,
        nombre = datos.nombre,
        email  = datos.email,
        pin    = hash_pin(datos.pin) if datos.pin else None,
        activo = datos.activo,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    r = schemas.UsuarioResponse.model_validate(nuevo)
    r.rol_nombre = nuevo.rol.nombre if nuevo.rol else None
    return r


@router.put("/{usuario_id}", response_model=schemas.UsuarioResponse)
def actualizar_usuario(
    usuario_id: int,
    datos: schemas.UsuarioUpdate,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_roles("admin")),
):
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
        pin_en_uso = _usuario_con_pin(db, datos.pin, excluir_id=usuario_id)
        if pin_en_uso:
            raise HTTPException(status_code=400, detail=f"El PIN ya está asignado a '{pin_en_uso.nombre}'")
    nuevo_rol = db.query(models.Rol).filter(models.Rol.id == datos.rol_id).first()
    if not nuevo_rol:
        raise HTTPException(status_code=400, detail="El rol indicado no existe")
    seguira_admin = datos.activo and nuevo_rol.nombre == "admin"
    if _es_admin_activo(usuario) and not seguira_admin:
        if usuario.id == admin.id:
            raise HTTPException(status_code=400, detail="No puedes quitarte el rol de admin ni desactivarte a ti mismo")
        if _admins_activos_restantes(db, usuario.id) == 0:
            raise HTTPException(status_code=400, detail="Debe quedar al menos un administrador activo")
    usuario.rol_id = datos.rol_id
    usuario.nombre = datos.nombre
    usuario.email  = datos.email
    usuario.activo = datos.activo
    if datos.pin:
        usuario.pin = hash_pin(datos.pin)
    db.commit()
    db.refresh(usuario)
    r = schemas.UsuarioResponse.model_validate(usuario)
    r.rol_nombre = usuario.rol.nombre if usuario.rol else None
    return r


@router.delete("/{usuario_id}")
def eliminar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    admin: models.Usuario = Depends(require_roles("admin")),
):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if usuario.id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    if _es_admin_activo(usuario) and _admins_activos_restantes(db, usuario.id) == 0:
        raise HTTPException(status_code=400, detail="Debe quedar al menos un administrador activo")
    tiene_historial = (
        db.query(models.Pedido).filter(models.Pedido.usuario_id == usuario.id).first()
        or db.query(models.Comprobante).filter(models.Comprobante.usuario_id == usuario.id).first()
        or db.query(models.Pedido).filter(models.Pedido.anulado_por == usuario.id).first()
        or db.query(models.PedidoItem).filter(models.PedidoItem.cancelado_por == usuario.id).first()
    )
    if tiene_historial:
        raise HTTPException(status_code=409, detail="El usuario tiene pedidos o comprobantes; desactívalo en vez de eliminarlo")
    nombre = usuario.nombre
    db.delete(usuario)
    db.commit()
    return {"mensaje": f"Usuario '{nombre}' eliminado"}
