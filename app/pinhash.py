"""Hash de PIN con scrypt (stdlib), sal aleatoria y comparación en tiempo constante.

Formato: scrypt$N$r$p$sal_hex$hash_hex. El PIN no es reversible: para generar un hash
a mano (p. ej. el admin semilla): python -m app.pinhash 1234
"""
import hashlib
import hmac
import secrets
import sys

PREFIJO = "scrypt$"
_N, _R, _P = 2**14, 8, 1
_LONG = 32


def _derivar(pin: str, sal: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(pin.encode(), salt=sal, n=n, r=r, p=p, dklen=_LONG, maxmem=128 * n * r * 2 + 1024 * 1024)


def hash_pin(pin: str) -> str:
    sal = secrets.token_bytes(16)
    return f"{PREFIJO}{_N}${_R}${_P}${sal.hex()}${_derivar(pin, sal, _N, _R, _P).hex()}"


def es_hash(valor) -> bool:
    return isinstance(valor, str) and valor.startswith(PREFIJO)


def verify_pin(pin: str, almacenado) -> bool:
    if not es_hash(almacenado):
        return False
    try:
        _, n, r, p, sal, esperado = almacenado.split("$")
        calculado = _derivar(pin, bytes.fromhex(sal), int(n), int(r), int(p))
        return hmac.compare_digest(calculado, bytes.fromhex(esperado))
    except (ValueError, TypeError):
        return False


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python -m app.pinhash <PIN>")
    print(hash_pin(sys.argv[1]))
