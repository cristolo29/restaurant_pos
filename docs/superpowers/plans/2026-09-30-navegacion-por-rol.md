# Navegación por rol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada rol (mozo, cajero, cocinero, admin) aterrice en su pantalla de trabajo y navegue con una barra consistente (lateral en tablet, inferior en móvil), con vistas nuevas "Por cobrar" y "Mis pedidos" y un indicador de conexión global.

**Architecture:** Una configuración única (`src/config/navegacion.js`) alimenta `Login`, `PrivateRoute` y un nuevo `AppShell` que envuelve todas las rutas privadas. Un store Zustand con un único polling de mesas (10 s) alimenta el shell (badges) y las vistas de Mesas, Por cobrar y Mis pedidos. El backend amplía `GET /api/mesas` de forma aditiva con el resumen de ítems por pedido abierto.

**Tech Stack:** FastAPI + SQLAlchemy + PostgreSQL + pytest (backend); React 19 + Vite + Tailwind 4 + Zustand + Axios + react-router-dom 7 (frontend, sin framework de tests).

**Spec:** `docs/superpowers/specs/2026-09-30-navegacion-por-rol-design.md`

## Global Constraints

- Breakpoint del shell: 768 px (`md` de Tailwind). Barra lateral ~80 px (`w-20`) en ≥ 768 px; barra inferior (`h-16`) más franja superior delgada (`h-10`, no sticky) en < 768 px.
- Objetivos táctiles de al menos 44 px en la navegación.
- Polling de mesas cada 10 s, un único intervalo (en el shell). Comanda conserva su refresco propio de 15 s.
- Estilo actual: fondo `bg-[#18181b]`, superficies `bg-[#27272a]`, bordes `border-[#3f3f46]`, texto secundario `text-[#71717a]`, acento ámbar `#f59e0b`, peligro `#ef4444`, éxito `#22c55e`. Iconos emoji, como el resto de la app.
- Nunca usar `alert()`/`confirm()` nativos: usar `ModalConfirm` (`src/components/ModalConfirm.jsx`, props `titulo`, `mensaje`, `labelConfirm`, `colorConfirm`, `onConfirm`, `onCancel`).
- Textos de interfaz en español, exactos: "No hay mesas por cobrar", "No tienes pedidos abiertos", "Sin conexión — los cambios pueden no guardarse", "Listas para cobrar", "En cocina", "N ítems en cocina", "N listos".
- Los badges se muestran solo si el valor es mayor que 0.
- Cambio de backend estrictamente aditivo: los campos actuales de `GET /api/mesas` no cambian.
- Estados de ítem: `pendiente`, `en_preparacion`, `listo`, `entregado`, `cancelado`. Los conteos son de filas de `PedidoItem` (no suman `cantidad`).
- Rutas y roles: `/mesas`, `/comanda` (mozo, cajero, admin); `/cobro`, `/por-cobrar` (cajero, admin); `/mis-pedidos` (mozo); `/cocina` (cocinero, admin); `/admin`, `/dashboard` (admin).
- Aterrizaje: mozo `/mesas`, cajero `/por-cobrar`, cocinero `/cocina`, admin `/dashboard`; rol desconocido `/mesas`.
- Convención de commits del repo: `feat:`/`fix:`/`refactor:`/`test:` en español, terminando con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Mesa `ocupada` sin pedido abierto (pedido huérfano): campos nuevos `null` y no aparece en Por cobrar ni Mis pedidos (Task 1, Task 3).
- Pedido abierto sin ítems vigentes (vacío o solo cancelados): no es cobrable, para no cobrar S/ 0 (Task 1, Task 3).
- Pedido con todos los ítems `entregado`: es cobrable y `items_listos` es 0 (Task 1, Task 3).
- Usuario con rol desconocido o sin destinos: cae en `/mesas` y el shell no falla ni muestra barra rota (Task 2, Task 7).
- Cerrar sesión o perder la red durante el polling: el intervalo se detiene al cerrar sesión y, sin red, se conserva la última lista de mesas (Task 4, Task 7).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/schemas.py`, `app/routers/mesas.py` | Campos nuevos de `MesaResponse` y su cálculo |
| `tests/test_mesas.py` (nuevo) | Pruebas del resumen de ítems |
| `frontend_react/src/config/navegacion.js` (nuevo) | Destinos, home por rol y regla de barra visible |
| `frontend_react/src/utils/mesasDerivadas.js` (nuevo) | Funciones puras sobre la lista de mesas |
| `frontend_react/src/store/useMesas.js`, `useConexion.js` (nuevos) | Polling único y estado de conexión |
| `frontend_react/src/api/client.js` | Interceptor que alimenta `useConexion` |
| `frontend_react/src/components/AppShell.jsx` (nuevo) | Layout con barra, badges, banner de conexión |
| `frontend_react/src/pages/PorCobrar.jsx`, `MisPedidos.jsx` (nuevos) | Vistas nuevas |
| `frontend_react/src/App.jsx` | Rutas anidadas bajo el shell |
| `Login.jsx`, `PrivateRoute.jsx`, `Mesas.jsx`, `Admin.jsx`, `Dashboard.jsx`, `Cobro.jsx` | Ajustes (Comanda no cambia: su "←" ya va a `/mesas`) |

Comandos de frontend se ejecutan desde `frontend_react/`; los de backend desde la raíz con `source venv/bin/activate` (`pytest` requiere la BD `orbezo_test`).

---

### Task 1: Backend — resumen de ítems en `GET /api/mesas`

**Files:**
- Modify: `app/schemas.py:45-52` (`MesaResponse`)
- Modify: `app/routers/mesas.py:11-34` (`obtener_mesas`)
- Test: `tests/test_mesas.py` (nuevo)

**Interfaces:**
- Consumes: fixtures de `tests/conftest.py` (`client`, `auth_mozo`, `usuario_mozo`, `mesa`, `salon`, `producto`, `db`).
- Produces: cada elemento de `GET /api/mesas` incluye `pedido_id: int|null`, `mozo_id: int|null`, `items_total: int|null`, `items_pendientes: int|null`, `items_listos: int|null`. `null` cuando la mesa no tiene pedido `abierto`. Con pedido abierto son enteros (≥ 0). `items_total` excluye `cancelado`; `items_pendientes` cuenta `pendiente` + `en_preparacion`; `items_listos` cuenta `listo`.

- [ ] **Step 1: Escribir las pruebas que fallan** en `tests/test_mesas.py`. Helper del archivo: `_pedido_con_items(db, mesa, usuario, producto, estados: list[str], estado_pedido="abierto") -> models.Pedido`, que crea el `Pedido` (mesa, usuario, estado) y un `PedidoItem` por cada estado (cantidad 1, `precio_unit` y `subtotal` = 28). Pruebas (todas con `client.get("/api/mesas", headers=auth_mozo)` y buscando la mesa por `id`):
  - `test_mesa_sin_pedido_tiene_campos_nulos`: los cinco campos son `None`.
  - `test_mesa_ocupada_sin_pedido_abierto_tiene_campos_nulos`: `mesa.estado = "ocupada"` sin pedido → cinco campos `None`.
  - `test_pedido_cerrado_no_cuenta_como_abierto`: pedido `estado_pedido="cerrado"` → cinco campos `None`.
  - `test_conteos_por_estado_excluyen_cancelados`: estados `["pendiente","en_preparacion","listo","entregado","cancelado"]` → `items_total == 4`, `items_pendientes == 2`, `items_listos == 1`, `pedido_id == pedido.id`, `mozo_id == usuario_mozo.id`.
  - `test_pedido_solo_con_cancelados_tiene_total_cero`: estados `["cancelado","cancelado"]` → `items_total == 0`, `items_pendientes == 0`, `items_listos == 0`.
  - `test_pedido_solo_entregados`: estados `["entregado","entregado"]` → `items_total == 2`, `items_pendientes == 0`, `items_listos == 0`.
  - `test_conteos_independientes_por_mesa`: segunda `Mesa` en el mismo salón; mesa 1 con `["listo"]`, mesa 2 con `["pendiente","pendiente"]` → cada mesa devuelve sus propios conteos.

- [ ] **Step 2: Verificar que fallan**

Run: `pytest tests/test_mesas.py -v`
Expected: FAIL (`KeyError: 'pedido_id'` o `assert None == ...`) en las pruebas con pedido; las de "campos nulos" también fallan por `KeyError`.

- [ ] **Step 3: Implementar.** En `app/schemas.py`, agregar a `MesaResponse` los cinco campos `Optional[int] = None`. En `obtener_mesas` (`app/routers/mesas.py`), tras cargar `pedidos_abiertos`, hacer **una** consulta agrupada sobre `PedidoItem` filtrando `pedido_id` en los ids de pedidos abiertos y `estado != "cancelado"`, agrupando por `pedido_id` con `func.count()` (total) y `func.count(case(...))` para pendientes (`pendiente`,`en_preparacion`) y listos (`listo`); armar un dict `pedido_id → (total, pendientes, listos)`. Para una mesa con pedido abierto sin filas, usar `(0, 0, 0)`. No hacer consultas por mesa.

- [ ] **Step 4: Verificar que pasan y no hay regresiones**

Run: `pytest -v`
Expected: PASS de `tests/test_mesas.py` y del resto de la suite.

- [ ] **Step 5: Commit**

```bash
git add app/schemas.py app/routers/mesas.py tests/test_mesas.py
git commit -m "feat: resumen de ítems por pedido abierto en GET /api/mesas

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Configuración de navegación y home por rol

**Files:**
- Create: `frontend_react/src/config/navegacion.js`
- Modify: `frontend_react/src/pages/Login.jsx:7,20,32`
- Modify: `frontend_react/src/components/PrivateRoute.jsx:4-9,23`

**Interfaces:**
- Produces (todos exports nombrados de `config/navegacion.js`):
  - `Destino = { id: string, label: string, icono: string, path: string }`
  - `homeParaRol(rol: string | undefined): string` — home del rol; `'/mesas'` si el rol es desconocido o `undefined`.
  - `destinosParaRol(rol: string | undefined): Destino[]` — `[]` si el rol es desconocido.
  - `mostrarBarra(rol: string | undefined, pathname: string): boolean` — `false` si `pathname` es `/comanda` o `/cobro`, o si `rol === 'cocinero'`; `true` en otro caso.
  - Ids de destino usados por otras tareas: `mesas`, `mis-pedidos`, `por-cobrar`, `cocina`, `dashboard`, `admin`. Iconos: 🪑 Mesas, 📋 Mis pedidos, 💵 Por cobrar, 👨‍🍳 Cocina, 📊 Dashboard, ⚙️ Administración (labels: "Mesas", "Mis pedidos", "Por cobrar", "Cocina", "Dashboard", "Administración").
  - Destinos por rol, en orden: mozo `[mesas, mis-pedidos]`; cajero `[por-cobrar, mesas]`; cocinero `[]`; admin `[dashboard, mesas, por-cobrar, cocina, admin]`.

- [ ] **Step 1: Línea base.** En un árbol limpio, ejecutar `npm run lint` y `npm run build` y anotar los errores/avisos existentes. Ninguna tarea posterior debe agregar nuevos.

- [ ] **Step 2: Implementar `config/navegacion.js`** con las firmas de arriba (objeto `DESTINOS` por id y objeto `NAVEGACION` por rol con `home` y `destinos`).

- [ ] **Step 3: Verificar las funciones puras con un smoke de Node** (no se commitea):

Run: `node --input-type=module -e "import a from 'node:assert/strict'; import {homeParaRol,destinosParaRol,mostrarBarra} from './src/config/navegacion.js'; a.equal(homeParaRol('mozo'),'/mesas'); a.equal(homeParaRol('cajero'),'/por-cobrar'); a.equal(homeParaRol('cocinero'),'/cocina'); a.equal(homeParaRol('admin'),'/dashboard'); a.equal(homeParaRol('otro'),'/mesas'); a.equal(homeParaRol(undefined),'/mesas'); const p=r=>destinosParaRol(r).map(d=>d.path); a.deepEqual(p('mozo'),['/mesas','/mis-pedidos']); a.deepEqual(p('cajero'),['/por-cobrar','/mesas']); a.deepEqual(p('cocinero'),[]); a.deepEqual(p('admin'),['/dashboard','/mesas','/por-cobrar','/cocina','/admin']); a.deepEqual(p('otro'),[]); a.equal(mostrarBarra('mozo','/mesas'),true); a.equal(mostrarBarra('mozo','/comanda'),false); a.equal(mostrarBarra('cajero','/cobro'),false); a.equal(mostrarBarra('cocinero','/cocina'),false); a.equal(mostrarBarra('admin','/cocina'),true); console.log('ok')"`
Expected: imprime `ok`.

- [ ] **Step 4: Usar `homeParaRol` en `Login.jsx` y `PrivateRoute.jsx`.** En `Login.jsx` eliminar la constante `RUTAS` (línea 7) y reemplazar sus dos usos (líneas 20 y 32) por `homeParaRol(usuario.rol_nombre)`. En `PrivateRoute.jsx` eliminar `RUTA_POR_ROL` y `HOME_POR_ROL` y usar `homeParaRol` en la redirección de rol no permitido.

- [ ] **Step 5: Verificar.** `npm run lint` y `npm run build` sin errores nuevos respecto a la línea base.

- [ ] **Step 6: Commit**

```bash
git add frontend_react/src/config/navegacion.js frontend_react/src/pages/Login.jsx frontend_react/src/components/PrivateRoute.jsx
git commit -m "refactor: configuración única de navegación y home por rol

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Funciones derivadas de mesas

**Files:**
- Create: `frontend_react/src/utils/mesasDerivadas.js`

**Interfaces:**
- Consumes: forma de mesa de `GET /api/mesas` (Task 1): `{ id, numero, estado, pedido_total, pedido_inicio, pedido_id, mozo_id, items_total, items_pendientes, items_listos }`.
- Produces (exports nombrados, todos puros):
  - `esCobrable(mesa): boolean` — `pedido_id != null && items_total > 0 && items_pendientes === 0`.
  - `mesasPorCobrar(mesas): { listas: Mesa[], enCocina: Mesa[] }` — `listas`: cobrables, más antigua primero por `pedido_inicio`; `enCocina`: con `pedido_id`, `items_pendientes > 0`, más antigua primero. Mesas sin pedido o sin ítems vigentes no aparecen en ninguno.
  - `mesasDelMozo(mesas, usuarioId): Mesa[]` — con `pedido_id != null` y `mozo_id === usuarioId`; primero las de mayor `items_listos`, desempate por `pedido_inicio` ascendente.
  - `totalPlatosListos(mesas, usuarioId): number` — suma de `items_listos` de `mesasDelMozo`.
  - `tiempoTranscurrido(iso: string | null | undefined): string | null` — `null` sin fecha; `"Xm"` si < 60 min; `"Xh Ym"` en otro caso (misma lógica que hoy en `Mesas.jsx`).

- [ ] **Step 1: Implementar** `utils/mesasDerivadas.js` con las firmas de arriba.

- [ ] **Step 2: Verificar con un smoke de Node** (no se commitea):

Run: `node --input-type=module -e "import a from 'node:assert/strict'; import {esCobrable,mesasPorCobrar,mesasDelMozo,totalPlatosListos,tiempoTranscurrido} from './src/utils/mesasDerivadas.js'; const m=o=>({id:1,pedido_id:1,mozo_id:7,items_total:2,items_pendientes:0,items_listos:0,pedido_inicio:'2026-01-01T10:00:00Z',...o}); a.equal(esCobrable(m({})),true); a.equal(esCobrable(m({items_pendientes:1})),false); a.equal(esCobrable(m({items_total:0})),false); a.equal(esCobrable(m({pedido_id:null,items_total:null,items_pendientes:null})),false); const r=mesasPorCobrar([m({id:1,pedido_inicio:'2026-01-01T11:00:00Z'}),m({id:2,pedido_inicio:'2026-01-01T09:00:00Z'}),m({id:3,items_pendientes:2}),m({id:4,items_total:0}),m({id:5,pedido_id:null,items_total:null,items_pendientes:null})]); a.deepEqual(r.listas.map(x=>x.id),[2,1]); a.deepEqual(r.enCocina.map(x=>x.id),[3]); const z=[m({id:1,mozo_id:7,items_listos:0}),m({id:2,mozo_id:7,items_listos:3}),m({id:3,mozo_id:9,items_listos:5}),m({id:4,mozo_id:7,pedido_id:null})]; a.deepEqual(mesasDelMozo(z,7).map(x=>x.id),[2,1]); a.equal(totalPlatosListos(z,7),3); a.equal(tiempoTranscurrido(null),null); a.equal(tiempoTranscurrido(new Date(Date.now()-5*60000).toISOString()),'5m'); a.equal(tiempoTranscurrido(new Date(Date.now()-90*60000).toISOString()),'1h 30m'); console.log('ok')"`
Expected: imprime `ok`.

- [ ] **Step 3: Verificar** `npm run lint` sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add frontend_react/src/utils/mesasDerivadas.js
git commit -m "feat: funciones derivadas de mesas (cobrables, del mozo, tiempo)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Stores de mesas y conexión

**Files:**
- Create: `frontend_react/src/store/useMesas.js`
- Create: `frontend_react/src/store/useConexion.js`
- Modify: `frontend_react/src/api/client.js:16-27` (interceptor de respuesta)

**Interfaces:**
- Consumes: `getMesas(): Promise<Mesa[]>` de `src/api/mesas.js`.
- Produces:
  - `useMesas` (default export, store Zustand): estado `{ mesas: Mesa[] (inicial []), cargando: boolean (inicial true) }`; acciones `cargar(): Promise<void>` (si falla, conserva `mesas` y pone `cargando: false`) e `iniciarPolling(): () => void` (llama `cargar()` de inmediato, crea `setInterval(cargar, 10000)` y devuelve la función que lo limpia).
  - `useConexion` (default export): estado `{ enLinea: boolean (inicial navigator.onLine) }`; acciones `setEnLinea(v: boolean): void` e `iniciarEscucha(): () => void` (registra `online`/`offline` de `window` y devuelve la función que los quita).
  - `api/client.js`: toda respuesta recibida (éxito o error con `response`) llama `useConexion.getState().setEnLinea(true)`; un error sin `response` llama `setEnLinea(false)`. El manejo actual del 401 no cambia.

- [ ] **Step 1: Implementar** los dos stores y el interceptor según las firmas.

- [ ] **Step 2: Verificar** `npm run lint` y `npm run build` sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend_react/src/store/useMesas.js frontend_react/src/store/useConexion.js frontend_react/src/api/client.js
git commit -m "feat: stores de mesas (polling único) y estado de conexión

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pantalla Por cobrar

**Files:**
- Create: `frontend_react/src/pages/PorCobrar.jsx`

**Interfaces:**
- Consumes: `useMesas` (Task 4), `mesasPorCobrar` y `tiempoTranscurrido` (Task 3), `getPedido(id)` de `src/api/pedidos.js`, `ModalConfirm`.
- Produces: componente default `PorCobrar` (sin props), para la ruta `/por-cobrar`.

- [ ] **Step 1: Implementar `PorCobrar`.** Lee `mesas` y `cargando` de `useMesas`. Dos secciones tituladas "Listas para cobrar" y "En cocina" (se omite la sección vacía). Tarjeta: número de mesa, `tiempoTranscurrido(pedido_inicio)` y `S/ pedido_total` con 2 decimales. Tarjeta de *listas*: al tocar hace `getPedido(mesa.pedido_id)` y `navigate('/cobro', { state: { pedido, mesa } })`; mientras carga deshabilita la tarjeta; si falla abre `ModalConfirm` (titulo "Error al abrir el cobro", `colorConfirm: 'danger'`). Tarjeta de *en cocina*: atenuada, no navega, muestra "N ítems en cocina" con `items_pendientes`. Si `listas` y `enCocina` están vacíos: texto "No hay mesas por cobrar". Mostrar "Cargando..." solo mientras `cargando` sea `true` y no haya mesas; en los refrescos posteriores no se vuelve a mostrar.

- [ ] **Step 2: Verificar** `npm run lint` y `npm run build` sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend_react/src/pages/PorCobrar.jsx
git commit -m "feat: pantalla Por cobrar para cajero y admin

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pantalla Mis pedidos

**Files:**
- Create: `frontend_react/src/pages/MisPedidos.jsx`

**Interfaces:**
- Consumes: `useMesas` (Task 4), `useAuth` (`usuario.id`), `mesasDelMozo` y `tiempoTranscurrido` (Task 3), `getPedido(id)`, `ModalConfirm`.
- Produces: componente default `MisPedidos` (sin props), para la ruta `/mis-pedidos`.

- [ ] **Step 1: Implementar `MisPedidos`.** `mesasDelMozo(mesas, usuario.id)`. Tarjeta: número de mesa, tiempo transcurrido, total; badge ámbar "N listos" si `items_listos > 0`. Al tocar: `getPedido(mesa.pedido_id)` y `navigate('/comanda', { state: { pedido, mesa } })`; error con `ModalConfirm` (titulo "Error al abrir la mesa"). Vacío: "No tienes pedidos abiertos".

- [ ] **Step 2: Verificar** `npm run lint` y `npm run build` sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add frontend_react/src/pages/MisPedidos.jsx
git commit -m "feat: pantalla Mis pedidos para el mozo

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: AppShell y rutas

**Files:**
- Create: `frontend_react/src/components/AppShell.jsx`
- Modify: `frontend_react/src/App.jsx`

**Interfaces:**
- Consumes: `destinosParaRol`, `mostrarBarra` (Task 2); `useMesas`, `useConexion` (Task 4); `mesasPorCobrar`, `totalPlatosListos` (Task 3); `useAuth`; `PorCobrar`, `MisPedidos` (Tasks 5–6).
- Produces: `AppShell` (default, sin props) como layout de ruta con `<Outlet />`. En `App.jsx`, todas las rutas privadas son hijas de una ruta layout `<Route element={<PrivateRoute><AppShell /></PrivateRoute>}>`; cada hija conserva su propio `PrivateRoute roles={[...]}` según la tabla de rutas de Global Constraints; se agregan `/por-cobrar` y `/mis-pedidos`. `/login` y el catch-all quedan fuera del layout.

- [ ] **Step 1: Implementar `AppShell`.**
  - Efecto: si hay `usuario` y su rol no es `cocinero`, `useMesas.getState().iniciarPolling()` y devolver su limpieza (dependencias: id y rol del usuario, para que cerrar sesión detenga el intervalo). Otro efecto: `useConexion.getState().iniciarEscucha()` con su limpieza.
  - Barra: `destinosParaRol(rol)` y `mostrarBarra(rol, pathname)` de `useLocation`. Si `mostrarBarra` es `false` o no hay destinos, se renderiza solo `<Outlet />` sin padding de barra.
  - ≥ 768 px: `<nav>` fijo a la izquierda (`w-20`), cada destino icono sobre etiqueta corta, activo en ámbar (`NavLink`), pie con avatar de iniciales, punto de conexión (verde/rojo) y botón "Salir" (`cerrarSesion()` + `navigate('/login')`). El contenido lleva `md:pl-20`.
  - < 768 px: barra inferior fija (`h-16`) con los destinos y franja superior (`h-10`, no sticky) con nombre, punto de conexión y "Salir". El contenido lleva `pb-16` cuando hay barra.
  - Badges (solo si > 0): `por-cobrar` = `mesasPorCobrar(mesas).listas.length`; `mis-pedidos` = `totalPlatosListos(mesas, usuario.id)`.
  - Banner de conexión: si `!enLinea`, franja fija arriba (`fixed top-0 inset-x-0`, `#ef4444`) con "Sin conexión — los cambios pueden no guardarse", visible también sin barra.

- [ ] **Step 2: Reestructurar `App.jsx`** como se indica y agregar las dos rutas nuevas con sus roles.

- [ ] **Step 3: Verificar compilación.** `npm run lint` y `npm run build` sin errores nuevos.

- [ ] **Step 4: Verificación manual por rol** (backend: `uvicorn app.main:app --reload`; frontend: `npm run dev`; crear usuarios de cada rol desde `/admin` si no existen):
  - mozo: aterriza en `/mesas`; la barra muestra Mesas y Mis pedidos; abrir `/cobro` o `/por-cobrar` a mano redirige a `/mesas`.
  - cajero: aterriza en `/por-cobrar`; barra Por cobrar y Mesas; abrir `/mis-pedidos` a mano redirige a `/por-cobrar`.
  - cocinero: aterriza en `/cocina` sin barra del shell.
  - admin: barra con los cinco destinos; `/cocina` muestra la barra.
  - Ancho ≥ 768 px muestra barra lateral; ancho < 768 px muestra barra inferior y franja superior.
  - En `/comanda` y `/cobro` no hay barra.
  - Apagar el backend: aparece el banner y la lista de mesas se mantiene; al reactivarlo el banner desaparece.
  - Cerrar sesión: en la pestaña Network no se siguen enviando `GET /api/mesas`.
  - Rol desconocido (editar `auth` en localStorage a `rol_nombre: "x"`): `PrivateRoute` redirige a `/mesas` y el shell no lanza errores en consola.

- [ ] **Step 5: Commit**

```bash
git add frontend_react/src/components/AppShell.jsx frontend_react/src/App.jsx
git commit -m "feat: AppShell con navegación por rol, badges y aviso de conexión

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Mesas usa el store compartido y pierde su header

**Files:**
- Modify: `frontend_react/src/pages/Mesas.jsx` (header líneas 77-101, efecto de polling líneas 26-30, estado `mesas`/`cargando` líneas 9-24, `tiempoTranscurrido` líneas 64-69, `iniciales` líneas 71-72)

**Interfaces:**
- Consumes: `useMesas` (`mesas`, `cargando`, `cargar`), `tiempoTranscurrido` (Task 3).

- [ ] **Step 1: Ajustar `Mesas.jsx`.** Quitar el `<header>` completo (marca, avatar, Salir), el `setInterval` y el estado local de `mesas`/`cargando`; leer `mesas`, `cargando` y `cargar` de `useMesas`; el botón ↻ llama `cargar`. Reemplazar la función local `tiempoTranscurrido` por la de `utils/mesasDerivadas.js`. Eliminar `iniciales`, `usuario`, `cerrarSesion` e imports que queden sin uso. Conservar título, contadores, grid y `seleccionar` sin cambios.

- [ ] **Step 2: Verificar.** `npm run lint` y `npm run build` sin errores nuevos. Manual: Mesas se refresca sola cada 10 s (una única petición por ciclo en Network, aun con Mesas abierta) y ocupar una mesa sigue abriendo la Comanda.

- [ ] **Step 3: Commit**

```bash
git add frontend_react/src/pages/Mesas.jsx
git commit -m "refactor: Mesas usa el polling compartido y delega la navegación al shell

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Admin y Dashboard sin navegación duplicada

**Files:**
- Modify: `frontend_react/src/pages/Admin.jsx` (header ~líneas 640-695: accesos a Dashboard/Mesas/Cocina, hamburguesa `menuAbierto`, dropdown, Salir)
- Modify: `frontend_react/src/pages/Dashboard.jsx` (header ~líneas 60-125, mismo patrón)

- [ ] **Step 1: Ajustar ambos headers.** Quitar los botones de acceso a otras pantallas, la hamburguesa, el dropdown móvil, el estado `menuAbierto` y el botón Salir. Conservar el título/ícono de la pantalla y cualquier control propio (filtros, acciones). Eliminar imports y variables que queden sin uso (`useNavigate`, `cerrarSesion`, etc.). No tocar el resto de las secciones de ninguna de las dos páginas.

- [ ] **Step 2: Verificar.** `npm run lint` y `npm run build` sin errores nuevos. Manual como admin: `/admin` y `/dashboard` cargan, navegar entre ellas y a Mesas/Cocina se hace solo con el shell, y Salir funciona desde el shell.

- [ ] **Step 3: Commit**

```bash
git add frontend_react/src/pages/Admin.jsx frontend_react/src/pages/Dashboard.jsx
git commit -m "refactor: Admin y Dashboard delegan la navegación al shell

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Cobro con ruta de regreso fija y verificación final

**Files:**
- Modify: `frontend_react/src/pages/Cobro.jsx:169` (botón "← Comanda")

- [ ] **Step 1: Cambiar el botón "← Comanda"** de `navigate(-1)` a `navigate('/comanda', { state: { pedido, mesa } })`. Dejar sin cambios el `navigate('/mesas')` de la línea 142.

- [ ] **Step 2: Verificación completa.**

Run: `pytest`
Expected: toda la suite en PASS.

Run: `npm run lint && npm run build` (en `frontend_react/`)
Expected: sin errores nuevos respecto a la línea base de Task 2.

- [ ] **Step 3: Recorrido manual del flujo entre roles.** Como mozo: abrir mesa, enviar ítems a cocina. Como cocinero: marcar los ítems `listo`. Como mozo: Mis pedidos muestra el badge "N listos" (y la insignia en la barra). Como cajero: Por cobrar muestra la mesa en "Listas para cobrar" (el badge de la barra coincide); tocarla abre Cobro; "← Comanda" vuelve a la Comanda de esa mesa; cobrar y verificar que la mesa desaparece de Por cobrar tras el siguiente ciclo de polling. Una mesa con ítems `pendiente` aparece en "En cocina" con "N ítems en cocina" y no navega. Repetir la pasada en ancho de tablet (≥ 768 px) y de móvil (< 768 px).

- [ ] **Step 4: Commit**

```bash
git add frontend_react/src/pages/Cobro.jsx
git commit -m "fix: Cobro vuelve a la Comanda con ruta fija en vez de historial

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
