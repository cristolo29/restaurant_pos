from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import date, timedelta
from app.database import get_db
from app import models
from app.security import require_roles

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
def obtener_dashboard(
    db: Session = Depends(get_db),
    _=Depends(require_roles("admin")),
):
    hoy = date.today()

    # ── KPIs del día ──────────────────────────────────────────────
    ventas_hoy = db.query(func.coalesce(func.sum(models.Comprobante.total), 0)).filter(
        cast(models.Comprobante.created_at, Date) == hoy
    ).scalar()

    comprobantes_hoy = db.query(func.count(models.Comprobante.id)).filter(
        cast(models.Comprobante.created_at, Date) == hoy
    ).scalar()

    pedidos_abiertos = db.query(func.count(models.Pedido.id)).filter(
        models.Pedido.estado == "abierto"
    ).scalar()

    mesas = db.query(models.Mesa).all()
    mesas_total    = len(mesas)
    mesas_ocupadas = sum(1 for m in mesas if m.estado == "ocupada")

    # ── Ventas últimos 7 días ─────────────────────────────────────
    semana = []
    DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    for i in range(6, -1, -1):
        dia = hoy - timedelta(days=i)
        total = db.query(func.coalesce(func.sum(models.Comprobante.total), 0)).filter(
            cast(models.Comprobante.created_at, Date) == dia
        ).scalar()
        semana.append({
            "fecha": dia.strftime("%d/%m"),
            "dia":   DIAS[dia.weekday() + 1 if dia.weekday() < 6 else 0],
            "total": float(total),
        })

    # ── Top 5 productos del día ───────────────────────────────────
    top = (
        db.query(
            models.ComprobanteItem.descripcion,
            func.sum(models.ComprobanteItem.cantidad).label("cantidad"),
            func.sum(models.ComprobanteItem.subtotal).label("total"),
        )
        .join(models.Comprobante, models.Comprobante.id == models.ComprobanteItem.comprobante_id)
        .filter(cast(models.Comprobante.created_at, Date) == hoy)
        .group_by(models.ComprobanteItem.descripcion)
        .order_by(func.sum(models.ComprobanteItem.cantidad).desc())
        .limit(5)
        .all()
    )
    top_productos = [
        {"nombre": r.descripcion, "cantidad": int(r.cantidad), "total": float(r.total)}
        for r in top
    ]

    # ── Últimos 8 comprobantes ────────────────────────────────────
    recientes = (
        db.query(models.Comprobante)
        .order_by(models.Comprobante.id.desc())
        .limit(8)
        .all()
    )
    comprobantes_recientes = []
    for c in recientes:
        mesa_num = "—"
        pedido = db.query(models.Pedido).filter(models.Pedido.id == c.pedido_id).first()
        if pedido:
            mesa = db.query(models.Mesa).filter(models.Mesa.id == pedido.mesa_id).first()
            if mesa:
                mesa_num = mesa.numero
        comprobantes_recientes.append({
            "numero": c.numero,
            "tipo":   c.tipo,
            "total":  float(c.total),
            "mesa":   mesa_num,
            "hora":   c.created_at.strftime("%H:%M") if c.created_at else "—",
        })

    return {
        "ventas_hoy":            float(ventas_hoy),
        "comprobantes_hoy":      comprobantes_hoy,
        "pedidos_abiertos":      pedidos_abiertos,
        "mesas_ocupadas":        mesas_ocupadas,
        "mesas_total":           mesas_total,
        "ventas_semana":         semana,
        "top_productos":         top_productos,
        "comprobantes_recientes": comprobantes_recientes,
    }
