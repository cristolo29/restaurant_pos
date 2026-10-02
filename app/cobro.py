"""Lógica compartida de cobro: validación de pago y emisión de comprobante.

Nada aquí hace commit: el llamador decide la transacción (cobro atómico en
`POST /api/pedidos/{id}/cobrar`, o el flujo antiguo `POST /api/comprobantes`).
Todo el dinero se maneja con Decimal y se redondea a 2 decimales (mitad hacia arriba).
"""
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app import models

CENTAVO = Decimal("0.01")
IGV_TASA = Decimal("0.18")
FACTOR_IGV = Decimal("1.18")
METODOS_EXACTOS = ("tarjeta", "yape", "plin")


def a_decimal(valor) -> Decimal:
    """Convierte a Decimal sin pasar por la imprecisión del float."""
    return valor if isinstance(valor, Decimal) else Decimal(str(valor))


def redondear(valor) -> Decimal:
    return a_decimal(valor).quantize(CENTAVO, rounding=ROUND_HALF_UP)


def _a_centavos_exactos(valor, nombre: str) -> Decimal:
    d = a_decimal(valor)
    if d != d.quantize(CENTAVO):
        raise HTTPException(status_code=422, detail=f"{nombre} admite como máximo 2 decimales")
    return d.quantize(CENTAVO)


def validar_pago(metodo_pago: str, monto_pagado, vuelto, total) -> None:
    """Valida en el servidor que el pago cubra el total recalculado. Lanza 422 en español."""
    total = redondear(total)
    pagado = _a_centavos_exactos(monto_pagado, "El monto pagado")
    vuelto = _a_centavos_exactos(vuelto, "El vuelto")

    if metodo_pago == "efectivo":
        if pagado < total:
            raise HTTPException(
                status_code=422,
                detail=f"El monto pagado (S/ {pagado}) es menor al total (S/ {total})",
            )
        esperado = (pagado - total).quantize(CENTAVO)
        if vuelto != esperado:
            raise HTTPException(
                status_code=422,
                detail=f"El vuelto es incorrecto: debe ser S/ {esperado}, se recibió S/ {vuelto}",
            )
    elif metodo_pago in METODOS_EXACTOS:
        if pagado != total:
            raise HTTPException(
                status_code=422,
                detail=f"Con {metodo_pago} el monto debe ser exactamente el total (S/ {total})",
            )
        if vuelto != 0:
            raise HTTPException(status_code=422, detail=f"Con {metodo_pago} no hay vuelto")
    else:
        raise HTTPException(status_code=422, detail="Método de pago no válido")


def items_cobrables(db: Session, pedido_id: int) -> list:
    return db.query(models.PedidoItem).filter(
        models.PedidoItem.pedido_id == pedido_id,
        models.PedidoItem.estado != "cancelado",
    ).all()


def calcular_totales(items) -> dict:
    """Subtotal, IGV y total recalculados desde los ítems (nunca los del cliente)."""
    gravado = sum((a_decimal(i.subtotal) for i in items if i.producto and i.producto.afecto_igv), Decimal("0"))
    inafecto = sum((a_decimal(i.subtotal) for i in items if not i.producto or not i.producto.afecto_igv), Decimal("0"))
    igv = redondear(gravado * IGV_TASA / FACTOR_IGV)
    return {
        "total": redondear(gravado + inafecto),
        "igv": igv,
        "subtotal": redondear((gravado - igv) + inafecto),
    }


def emitir_comprobante_de_pedido(db: Session, pedido: models.Pedido, datos, cobrador: models.Usuario, items):
    """Crea comprobante + ítems y avanza el correlativo, sin commit.

    `datos` expone tipo, metodo_pago, monto_pagado, vuelto, nro_doc_cliente, razon_social, direccion_cliente.
    El pago se valida contra el total recalculado desde `items`.
    """
    if datos.tipo == "factura":
        ruc = (datos.nro_doc_cliente or "").strip()
        if not (ruc.isdigit() and len(ruc) == 11):
            raise HTTPException(status_code=400, detail="La factura requiere RUC del cliente (11 dígitos)")

    existente = db.query(models.Comprobante).filter(models.Comprobante.pedido_id == pedido.id).first()
    if existente:
        raise HTTPException(status_code=400, detail=f"Ya existe el comprobante {existente.numero}")

    totales = calcular_totales(items)
    if totales["total"] <= 0:
        raise HTTPException(status_code=409, detail="El pedido no tiene ítems para cobrar")
    validar_pago(datos.metodo_pago, datos.monto_pagado, datos.vuelto, totales["total"])

    serie = db.query(models.SerieComprobante).filter(
        models.SerieComprobante.tipo == datos.tipo,
        models.SerieComprobante.activo == True,  # noqa: E712
    ).with_for_update().first()
    if not serie:
        raise HTTPException(status_code=400, detail=f"No hay serie activa para {datos.tipo}")

    comprobante = models.Comprobante(
        pedido_id=pedido.id,
        usuario_id=cobrador.id,
        serie_id=serie.id,
        tipo=datos.tipo,
        serie=serie.serie,
        correlativo=serie.correlativo,
        tipo_doc_cliente="6" if datos.tipo == "factura" else "1",
        metodo_pago=datos.metodo_pago,
        monto_pagado=redondear(datos.monto_pagado),
        vuelto=redondear(datos.vuelto),
        nro_doc_cliente=datos.nro_doc_cliente,
        razon_social=datos.razon_social,
        direccion_cliente=datos.direccion_cliente,
        subtotal=totales["subtotal"],
        igv=totales["igv"],
        total=totales["total"],
    )
    db.add(comprobante)
    db.flush()

    grupos: dict = {}
    for item in items:
        g = grupos.get(item.producto_id)
        if g:
            g["cantidad"] += a_decimal(item.cantidad)
            g["subtotal"] += a_decimal(item.subtotal)
        else:
            grupos[item.producto_id] = {
                "descripcion": item.producto.nombre if item.producto else "Producto",
                "cantidad": a_decimal(item.cantidad),
                "precio_unit": a_decimal(item.precio_unit),
                "subtotal": a_decimal(item.subtotal),
                "afecto_igv": item.producto.afecto_igv if item.producto else True,
            }
    for g in grupos.values():
        igv_item = g["subtotal"] * IGV_TASA / FACTOR_IGV if g["afecto_igv"] else Decimal("0")
        db.add(models.ComprobanteItem(
            comprobante_id=comprobante.id,
            descripcion=g["descripcion"],
            cantidad=g["cantidad"],
            precio_unit=g["precio_unit"],
            subtotal=redondear(g["subtotal"]),
            igv_item=redondear(igv_item),
        ))

    serie.correlativo += 1
    db.flush()
    return comprobante
