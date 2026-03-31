from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, categorias, productos, mesas, pedidos, comprobantes, usuarios, salones, dashboard

app = FastAPI(
    title="Orbezo Resto Bar API",
    description="Backend para el sistema POS del restaurante",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
