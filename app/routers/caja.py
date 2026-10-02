"""Caja y arqueo: apertura con monto inicial, resumen en vivo y cierre con diferencia."""
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.cobro import CENTAVO, caja_abierta_de, redondear
from app.database import get_db
from app import models, schemas
from app.security import require_roles

router = APIRouter(prefix="/api/caja", tags=["Caja"])

_cajero = Depends(require_roles("cajero", "admin"))
METODOS = ("efectivo", "tarjeta", "yape", "plin")


def _num(valor):
    return float(valor) if valor is not None else None


def _totales(db: Session, caja_id: int):
    """(cantidad de comprobantes, total por método, total cobrado) de la caja, en Decimal."""
    filas = db.query(
        models.Comprobante.metodo_pago, func.count(models.Comprobante.id), func.coalesce(func.sum(models.Comprobante.total), 0),
    ).filter(models.Comprobante.caja_id == caja_id).group_by(models.Comprobante.metodo_pago).all()
    por_metodo = {m: Decimal("0.00") for m in METODOS}
    cantidad = 0
    for metodo, n, total in filas:
        por_metodo[metodo] = redondear(total)
        cantidad += n
    return cantidad, por_metodo, sum(por_metodo.values(), Decimal("0.00"))


def _esperado(caja: models.Caja, por_metodo) -> Decimal:
    """Efectivo que debe haber en la gaveta: fondo inicial + lo cobrado en efectivo (total, ya sin vuelto)."""
    return redondear(Decimal(caja.monto_inicial) + por_metodo["efectivo"])


def serializar_caja(db: Session, caja: models.Caja) -> dict:
    cantidad, por_metodo, total = _totales(db, caja.id)
    abierta = caja.estado == "abierta"
    esperado = _esperado(caja, por_metodo) if abierta else redondear(caja.monto_esperado)
    pedidos_abiertos = db.query(models.Pedido).filter(models.Pedido.estado == "abierto").count() if abierta else None
    return {
        "id": caja.id,
        "usuario_id": caja.usuario_id,
        "usuario_nombre": caja.usuario.nombre if caja.usuario else None,
        "estado": caja.estado,
        "abierta_at": caja.abierta_at.isoformat() if caja.abierta_at else None,
        "cerrada_at": caja.cerrada_at.isoformat() if caja.cerrada_at else None,
        "monto_inicial": _num(caja.monto_inicial),
        "comprobantes": cantidad,
        "por_metodo": {m: _num(v) for m, v in por_metodo.items()},
        "total_cobrado": _num(total),
        "monto_esperado": _num(esperado),
        "monto_contado": _num(caja.monto_contado),
        "diferencia": _num(caja.diferencia),
        "observaciones": caja.observaciones,
        "cerrada_por": caja.cerrada_por,
        "pedidos_abiertos": pedidos_abiertos,
        "advertencia": (
            f"Hay {pedidos_abiertos} pedido(s) abierto(s) sin cobrar" if pedidos_abiertos else None
        ),
    }


@router.post("/abrir")
def abrir_caja(datos: schemas.CajaAbrir, db: Session = Depends(get_db), user: models.Usuario = _cajero):
    if caja_abierta_de(db, user.id):
        raise HTTPException(status_code=409, detail="Ya tienes una caja abierta")
    caja = models.Caja(usuario_id=user.id, monto_inicial=redondear(datos.monto_inicial), estado="abierta")
    db.add(caja)
    db.commit()  # el índice único parcial cubre la carrera de dos aperturas simultáneas (409 por integridad)
    db.refresh(caja)
    return serializar_caja(db, caja)


@router.get("/actual")
def caja_actual(db: Session = Depends(get_db), user: models.Usuario = _cajero):
    """Caja abierta del usuario con resumen en vivo, o `null` si no tiene."""
    caja = caja_abierta_de(db, user.id)
    return serializar_caja(db, caja) if caja else None


@router.post("/cerrar")
def cerrar_caja(datos: schemas.CajaCerrar, db: Session = Depends(get_db), user: models.Usuario = _cajero):
    # FOR UPDATE: espera a los cobros en curso (que toman FOR SHARE) y bloquea los siguientes.
    caja = db.query(models.Caja).filter(
        models.Caja.usuario_id == user.id, models.Caja.estado == "abierta",
    ).with_for_update().first()
    if not caja:
        raise HTTPException(status_code=409, detail="No tienes una caja abierta para cerrar")

    _, por_metodo, _ = _totales(db, caja.id)
    esperado = _esperado(caja, por_metodo)
    contado = redondear(datos.monto_contado)
    diferencia = (contado - esperado).quantize(CENTAVO)
    observaciones = (datos.observaciones or "").strip()
    if diferencia != 0 and len(observaciones) < 3:
        raise HTTPException(
            status_code=422,
            detail="Hay diferencia entre lo contado y lo esperado: explica el motivo (mínimo 3 caracteres)",
        )

    caja.estado = "cerrada"
    caja.cerrada_at = datetime.now(timezone.utc)
    caja.cerrada_por = user.id
    caja.monto_contado = contado
    caja.monto_esperado = esperado
    caja.diferencia = diferencia
    caja.observaciones = observaciones or None
    db.commit()
    db.refresh(caja)
    return serializar_caja(db, caja)


@router.get("")
def listar_cajas(
    db: Session = Depends(get_db),
    user: models.Usuario = _cajero,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Historial, más reciente primero. El admin ve todas; el cajero solo las suyas."""
    q = db.query(models.Caja)
    if user.rol.nombre != "admin":
        q = q.filter(models.Caja.usuario_id == user.id)
    cajas = q.order_by(models.Caja.id.desc()).offset(offset).limit(limit).all()
    return [serializar_caja(db, c) for c in cajas]


@router.get("/{caja_id}")
def obtener_caja(caja_id: int, db: Session = Depends(get_db), user: models.Usuario = _cajero):
    caja = db.query(models.Caja).filter(models.Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(status_code=404, detail="La caja no existe")
    if user.rol.nombre != "admin" and caja.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="Solo puedes ver tus propias cajas")
    return serializar_caja(db, caja)
