from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/api/categorias", tags=["Categorias"])


@router.get("", response_model=list[schemas.CategoriaResponse])
def obtener_categorias(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return db.query(models.Categoria).filter(models.Categoria.activo == True).all()


@router.post("", response_model=schemas.CategoriaResponse)
def crear_categoria(
    categoria: schemas.CategoriaCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    nueva = models.Categoria(
        nombre=categoria.nombre,
        descripcion=categoria.descripcion,
        activo=categoria.activo,
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


@router.put("/{cat_id}", response_model=schemas.CategoriaResponse)
def actualizar_categoria(
    cat_id: int,
    datos: schemas.CategoriaCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    cat = db.query(models.Categoria).filter(models.Categoria.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.nombre      = datos.nombre
    cat.descripcion = datos.descripcion
    cat.activo      = datos.activo
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}")
def eliminar_categoria(
    cat_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    cat = db.query(models.Categoria).filter(models.Categoria.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    tiene_productos = db.query(models.Producto).filter(models.Producto.categoria_id == cat_id).first()
    if tiene_productos:
        raise HTTPException(status_code=400, detail="No se puede eliminar: tiene productos asociados")
    db.delete(cat)
    db.commit()
    return {"mensaje": f"Categoría '{cat.nombre}' eliminada"}
