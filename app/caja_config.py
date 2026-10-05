"""Configuración de la caja, leída en un solo lugar.

CAJA_TOLERANCIA: diferencia máxima (en soles, valor absoluto) entre lo contado y lo esperado con la que la
caja se cierra sin autorización de un administrador. Por defecto 2.00. Si el valor no es un número válido
(>= 0, máximo 2 decimales) la API NO arranca, con un mensaje claro.
"""
import os
from decimal import Decimal, InvalidOperation

TOLERANCIA_POR_DEFECTO = Decimal("2.00")


def leer_tolerancia(valor) -> Decimal:
    texto = (valor or "").strip()
    if not texto:
        return TOLERANCIA_POR_DEFECTO
    try:
        tolerancia = Decimal(texto)
        valida = tolerancia.is_finite() and tolerancia >= 0 and tolerancia == tolerancia.quantize(Decimal("0.01"))
    except InvalidOperation:
        valida = False
    if not valida:
        raise RuntimeError(
            f"CAJA_TOLERANCIA inválida ({texto[:20]!r}): debe ser un número mayor o igual a 0 con "
            "máximo 2 decimales, por ejemplo 2.00 (la variable se lee al arrancar la API)."
        )
    return tolerancia.quantize(Decimal("0.01"))


TOLERANCIA = leer_tolerancia(os.getenv("CAJA_TOLERANCIA"))
