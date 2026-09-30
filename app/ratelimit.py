import time
from threading import Lock


class LimitadorIntentos:
    """Bloquea una clave (IP) tras N fallos dentro de una ventana. En memoria: válido para una sola instancia."""

    def __init__(self, max_fallos: int = 5, ventana: int = 900):
        self.max_fallos = max_fallos
        self.ventana = ventana
        self._fallos: dict[str, list[float]] = {}
        self._lock = Lock()

    def _vigentes(self, clave: str, ahora: float) -> list[float]:
        vigentes = [t for t in self._fallos.get(clave, []) if ahora - t < self.ventana]
        if vigentes:
            self._fallos[clave] = vigentes
        else:
            self._fallos.pop(clave, None)
        return vigentes

    def segundos_bloqueado(self, clave: str) -> int:
        ahora = time.monotonic()
        with self._lock:
            vigentes = self._vigentes(clave, ahora)
            if len(vigentes) < self.max_fallos:
                return 0
            return max(1, int(self.ventana - (ahora - vigentes[0])))

    def registrar_fallo(self, clave: str) -> None:
        with self._lock:
            self._vigentes(clave, time.monotonic())
            self._fallos.setdefault(clave, []).append(time.monotonic())

    def reiniciar(self, clave: str) -> None:
        with self._lock:
            self._fallos.pop(clave, None)

    def limpiar(self) -> None:
        with self._lock:
            self._fallos.clear()


login_limiter = LimitadorIntentos()
