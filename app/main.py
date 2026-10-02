import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from app.integridad import manejar_integrity_error
from app.routers import auth, categorias, productos, mesas, pedidos, comprobantes, usuarios, salones, dashboard

app = FastAPI(
    title="Orbezo Resto Bar API",
    description="Backend para el sistema POS del restaurante",
    version="1.0.0"
)

_origenes = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origenes,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.add_exception_handler(IntegrityError, manejar_integrity_error)

app.include_router(auth.router)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(mesas.router)
app.include_router(pedidos.router)
app.include_router(comprobantes.router)
app.include_router(usuarios.router)
app.include_router(salones.router)
app.include_router(dashboard.router)


@app.get("/")
def ruta_principal():
    return {"mensaje": "Orbezo Resto Bar API corriendo"}


@app.middleware("http")
async def cabeceras_seguridad(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response
