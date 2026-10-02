"""Caja y arqueo: apertura con monto inicial, resumen en vivo y cierre con diferencia."""
from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.cobro import CENTAVO, DENOMINACIONES, caja_abierta_de, clave_denominacion, redondear
from app.database import get_db
from app import caja_config, models, schemas
from app.pinhash import verify_pin
from app.ratelimit import autorizacion_limiter
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


TIPOS_MOVIMIENTO = ("ingreso", "egreso", "retiro")


def _totales_movimientos(db: Session, caja_id: int) -> dict:
    filas = db.query(models.CajaMovimiento.tipo, func.coalesce(func.sum(models.CajaMovimiento.monto), 0)).filter(
        models.CajaMovimiento.caja_id == caja_id,
    ).group_by(models.CajaMovimiento.tipo).all()
    totales = {t: Decimal("0.00") for t in TIPOS_MOVIMIENTO}
    for tipo, total in filas:
        totales[tipo] = redondear(total)
    return totales


def _esperado(caja: models.Caja, por_metodo, movs) -> Decimal:
    """Efectivo que debe haber en la gaveta, calculado SOLO en el servidor:
    fondo + efectivo cobrado (total, ya sin vuelto) + ingresos - egresos - retiros."""
    return redondear(
        Decimal(caja.monto_inicial) + por_metodo["efectivo"] + movs["ingreso"] - movs["egreso"] - movs["retiro"]
    )


def _normalizar_conteo(conteo: dict, contado: Decimal) -> dict:
    """Valida denominaciones y cantidades; la suma (Decimal) debe ser igual al monto contado. Devuelve el
    conteo con claves canónicas ('0.50', no '0.5')."""
    normal: dict = {}
    total = Decimal("0.00")
    for clave, cantidad in conteo.items():
        try:
            valor = Decimal(clave.strip())
            valida = valor in DENOMINACIONES
        except Exception:  # 'abc', 'sNaN', etc.
            valida = False
        if not valida:
            raise HTTPException(status_code=422, detail=f"Denominación no válida en el conteo: {clave[:12]!r}")
        canon = clave_denominacion(valor)
        if canon in normal:
            raise HTTPException(status_code=422, detail=f"La denominación {canon} está repetida en el conteo")
        normal[canon] = cantidad
        total += valor * cantidad
    if total != contado:
        raise HTTPException(
            status_code=422,
            detail=f"El conteo por denominaciones (S/ {total}) no coincide con el monto contado (S/ {contado})",
        )
    return normal


MENSAJE_AUTORIZACION = "Diferencia fuera de tolerancia: requiere autorización de un administrador"
OBSERVACIONES_AUTOAUTORIZACION = 10


def _autorizador(db: Session, user: models.Usuario, pin) -> models.Usuario:
    """Admin activo que autoriza una diferencia fuera de tolerancia, verificado con `verify_pin`.

    Con más de un admin activo, el PIN debe ser de OTRO distinto de quien cierra; con uno solo se acepta el suyo.
    El PIN no se registra ni se devuelve, los fallos cuentan para el limitador y el mensaje es siempre el mismo
    (no revela qué administradores existen)."""
    clave = f"caja:{user.id}"
    espera = autorizacion_limiter.segundos_bloqueado(clave)
    if espera:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos de autorización. Intenta de nuevo más tarde.",
            headers={"Retry-After": str(espera)},
        )
    if not pin:  # no es un intento de adivinar: simplemente falta
        raise HTTPException(status_code=403, detail=MENSAJE_AUTORIZACION)
    admins = db.query(models.Usuario).join(models.Rol, models.Usuario.rol_id == models.Rol.id).filter(
        models.Rol.nombre == "admin", models.Usuario.activo == True, models.Usuario.pin.isnot(None),  # noqa: E712
    ).all()
    elegibles = [a for a in admins if a.id != user.id] if len(admins) > 1 else admins
    autorizador = None
    for a in elegibles:  # sin cortar al primer acierto: el tiempo no revela cuántos admins hay
        if verify_pin(pin, a.pin) and autorizador is None:
            autorizador = a
    if autorizador is None:
        autorizacion_limiter.registrar_fallo(clave)
        raise HTTPException(status_code=403, detail=MENSAJE_AUTORIZACION)
    autorizacion_limiter.reiniciar(clave)
    return autorizador


def _serializar_movimiento(m: models.CajaMovimiento) -> dict:
    return {
        "id": m.id,
        "tipo": m.tipo,
        "monto": _num(m.monto),
        "motivo": m.motivo,
        "usuario_id": m.usuario_id,
        "usuario_nombre": m.usuario.nombre if m.usuario else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def serializar_caja(db: Session, caja: models.Caja, user: models.Usuario) -> dict:
    """Cierre a ciegas: mientras la caja está abierta, solo el admin recibe `monto_esperado`
    (el campo ni se envía al cajero: ocultarlo solo en la interfaz no bastaría)."""
    datos = _serializar_caja(db, caja)
    if caja.estado == "abierta" and user.rol.nombre != "admin":
        datos.pop("monto_esperado", None)
    return datos


def _serializar_caja(db: Session, caja: models.Caja) -> dict:
    cantidad, por_metodo, total = _totales(db, caja.id)
    abierta = caja.estado == "abierta"
    movs = _totales_movimientos(db, caja.id)
    esperado = _esperado(caja, por_metodo, movs) if abierta else redondear(caja.monto_esperado)
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
        "efectivo_cobrado": _num(por_metodo["efectivo"]),
        "totales_movimientos": {t: _num(v) for t, v in movs.items()},
        "movimientos": [_serializar_movimiento(m) for m in caja.movimientos],
        "monto_esperado": _num(esperado),
        "monto_contado": _num(caja.monto_contado),
        "diferencia": _num(caja.diferencia),
        "observaciones": caja.observaciones,
        "conteo": caja.conteo,
        "cerrada_por": caja.cerrada_por,
        "autorizado_por": caja.autorizado_por,
        "autorizado_por_nombre": caja.autorizador.nombre if caja.autorizador else None,
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
    return serializar_caja(db, caja, user)


@router.get("/actual")
def caja_actual(db: Session = Depends(get_db), user: models.Usuario = _cajero):
    """Caja abierta del usuario con resumen en vivo, o `null` si no tiene."""
    caja = caja_abierta_de(db, user.id)
    return serializar_caja(db, caja, user) if caja else None


@router.post("/cerrar")
def cerrar_caja(datos: schemas.CajaCerrar, db: Session = Depends(get_db), user: models.Usuario = _cajero):
    # FOR UPDATE: espera a los cobros en curso (que toman FOR SHARE) y bloquea los siguientes.
    caja = db.query(models.Caja).filter(
        models.Caja.usuario_id == user.id, models.Caja.estado == "abierta",
    ).with_for_update().first()
    if not caja:
        raise HTTPException(status_code=409, detail="No tienes una caja abierta para cerrar")

    _, por_metodo, _ = _totales(db, caja.id)
    esperado = _esperado(caja, por_metodo, _totales_movimientos(db, caja.id))
    contado = redondear(datos.monto_contado)
    conteo = _normalizar_conteo(datos.conteo, contado) if datos.conteo is not None else None
    diferencia = (contado - esperado).quantize(CENTAVO)
    observaciones = (datos.observaciones or "").strip()
    if diferencia != 0 and len(observaciones) < 3:
        raise HTTPException(
            status_code=422,
            detail="Hay diferencia entre lo contado y lo esperado: explica el motivo (mínimo 3 caracteres)",
        )
    autorizador = None
    if abs(diferencia) > caja_config.TOLERANCIA:
        autorizador = _autorizador(db, user, datos.pin_autorizacion)
        if autorizador.id == user.id and len(observaciones) < OBSERVACIONES_AUTOAUTORIZACION:
            raise HTTPException(
                status_code=422,
                detail=f"Al autorizarte a ti mismo, las observaciones deben tener al menos {OBSERVACIONES_AUTOAUTORIZACION} caracteres",
            )

    caja.estado = "cerrada"
    caja.cerrada_at = datetime.now(timezone.utc)
    caja.cerrada_por = user.id
    caja.monto_contado = contado
    caja.conteo = conteo
    caja.autorizado_por = autorizador.id if autorizador else None
    caja.monto_esperado = esperado
    caja.diferencia = diferencia
    caja.observaciones = observaciones or None
    db.commit()
    db.refresh(caja)
    return serializar_caja(db, caja, user)


@router.post("/movimientos")
def registrar_movimiento(
    datos: schemas.CajaMovimientoCrear, db: Session = Depends(get_db), user: models.Usuario = _cajero,
):
    """Ingreso, egreso o retiro sobre la caja abierta del usuario. Inmutable: no hay PUT ni DELETE."""
    # FOR UPDATE: serializa con otros movimientos y con el cierre, y espera a los cobros en curso.
    caja = db.query(models.Caja).filter(
        models.Caja.usuario_id == user.id, models.Caja.estado == "abierta",
    ).with_for_update().first()
    if not caja:
        raise HTTPException(status_code=409, detail="Abre la caja antes de registrar un movimiento")
    monto = redondear(datos.monto)
    if datos.tipo in ("egreso", "retiro"):
        _, por_metodo, _ = _totales(db, caja.id)
        disponible = _esperado(caja, por_metodo, _totales_movimientos(db, caja.id))
        if monto > disponible:
            # El disponible es el efectivo esperado: al cajero no se le muestra la cifra (cierre a ciegas).
            cifra = f" (S/ {disponible})" if user.rol.nombre == "admin" else ""
            raise HTTPException(
                status_code=409,
                detail=f"El {datos.tipo} supera el efectivo disponible en caja{cifra}",
            )
    db.add(models.CajaMovimiento(
        caja_id=caja.id, tipo=datos.tipo, monto=monto, motivo=datos.motivo, usuario_id=user.id,
    ))
    db.commit()
    db.refresh(caja)
    return serializar_caja(db, caja, user)


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
    return [serializar_caja(db, c, user) for c in cajas]


@router.get("/{caja_id}")
def obtener_caja(caja_id: int, db: Session = Depends(get_db), user: models.Usuario = _cajero):
    caja = db.query(models.Caja).filter(models.Caja.id == caja_id).first()
    if not caja:
        raise HTTPException(status_code=404, detail="La caja no existe")
    if user.rol.nombre != "admin" and caja.usuario_id != user.id:
        raise HTTPException(status_code=403, detail="Solo puedes ver tus propias cajas")
    return serializar_caja(db, caja, user)
