# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Orbezo Resto Bar** — Restaurant POS system. FastAPI backend + React frontend.

## Commands

### Backend
```bash
# Activate venv first
source venv/bin/activate

# Run dev server (from repo root)
uvicorn app.main:app --reload

# Run all tests (requires orbezo_test DB to exist)
pytest

# Run a single test file
pytest tests/test_pedidos.py

# Run with coverage
pytest --cov=app
```

### Frontend
```bash
cd frontend_react
npm install
npm run dev        # dev server on :5173
npm run build
npm run lint
```

### Docker
```bash
docker-compose up --build
```

## Architecture

### Backend (`app/`)

- **`main.py`** — FastAPI app, CORS middleware, all routers registered
- **`models.py`** — All SQLAlchemy models in a single file (schema: `orbezo`)
- **`schemas.py`** — All Pydantic request/response schemas in a single file
- **`database.py`** — Engine, session factory, `get_db` dependency. DB URL from `DATABASE_URL` env var, defaults to `postgresql://admin:1234@localhost:5432/restaurant_pos`
- **`security.py`** — JWT creation/validation (`python-jose`, HS256, 12h expiry), `get_current_user` dependency, `require_roles(*roles)` factory
- **`routers/`** — One file per domain: `auth`, `categorias`, `productos`, `mesas`, `pedidos`, `comprobantes`, `usuarios`, `salones`, `dashboard`. All prefixed with `/api`

**Auth flow**: PIN-based login (`POST /api/login`) returns a JWT. No password hashing — authentication is PIN only.

**Roles**: `admin`, `mozo`, `cajero`, `cocinero`. Protected routes use `Depends(require_roles("admin", "cajero"))`.

**DB schema**: All tables live in the `orbezo` PostgreSQL schema (set via `__table_args__ = {"schema": "orbezo"}`). No Alembic — tables are managed with `Base.metadata.create_all`.

### Frontend (`frontend_react/src/`)

- **`api/client.js`** — Axios instance. Reads `VITE_API_URL` (default `http://localhost:8000`). Interceptors inject JWT from Zustand store and redirect to `/login` on 401.
- **`api/`** — Per-resource files (`mesas.js`, `pedidos.js`, etc.) that call `client.js`.
- **`store/useAuth.js`** — Zustand store with `persist` middleware. Stores `{ usuario, token }` in localStorage under key `auth`.
- **`pages/`** — Full-page components. Route access is gated by `PrivateRoute` with role arrays.
- **`App.jsx`** — All routes defined here. Role-based access: mozo/cajero/admin → `/mesas`, `/comanda`; cajero/admin → `/cobro`; cocinero/admin → `/cocina`; admin only → `/admin`, `/dashboard`.

**Mesas page** polls the server every 10 seconds to refresh table states.

**Comprobantes**: boleta or factura. `Comprobante.numero` is a computed property (`serie-XXXXXX`). IGV is 18%.

### Tests (`tests/`)

Tests hit a real PostgreSQL database (`orbezo_test`). `conftest.py` creates the `orbezo` schema, then each test creates all tables via `Base.metadata.create_all` and drops them on teardown. The `get_db` dependency is overridden for tests. Fixtures provide pre-built `usuario_admin`, `usuario_mozo`, `usuario_cajero`, `mesa`, `producto`, and matching auth header fixtures.
