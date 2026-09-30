# Navegación por rol — Diseño

Fecha: 2026-09-30
Etapa 1 de la mejora de fluidez de la interfaz (etapas siguientes: comanda, estados de Mesas).

## Contexto y objetivo

Orbezo Resto Bar se llevará a un **piloto controlado**: el personal usa el sistema en paralelo al método actual y da feedback. Dispositivos previstos:

- Mozos: **tablet**.
- Caja: PC o tablet.
- Cocina: pantalla o tablet grande.

Objetivo de esta etapa: que cada rol llegue en un toque a lo que necesita y vea solo lo que le corresponde, con un patrón de navegación consistente, como en los POS profesionales de restaurante.

Criterio de éxito:

- Cada rol aterriza en su pantalla de trabajo tras el login.
- Ningún rol necesita más de un toque para pasar entre sus pantallas.
- El cajero ve de inmediato qué mesas puede cobrar; el mozo ve qué platos están listos para recoger.
- El estado de conexión es visible en todas las pantallas.
- La navegación de cada rol se define en un solo lugar.

## Situación actual (problemas)

- Cada página implementa su propio header (Mesas, Cocina, Cobro, Admin, Dashboard). Solo Admin y Dashboard tienen accesos a otras pantallas.
- El "home" por rol está duplicado y es inconsistente: `RUTAS` en `Login.jsx` (cajero → `/mesas`, mozo por defecto) y `RUTA_POR_ROL` en `PrivateRoute.jsx`.
- El cajero solo llega a Cobro entrando a la Comanda de una mesa; no existe vista de mesas por cobrar.
- Cobro vuelve con `navigate(-1)`, que depende del historial.
- `GET /api/mesas` no informa el estado de los ítems ni el mozo dueño del pedido.

## Fuera de alcance

- Cambios internos de Comanda (barra fija de pedido, modificadores, cursos, aviso de "listo").
- Estados de color adicionales en Mesas, mover o unir mesas.
- Destino "Caja" (aparecerá con el cierre de caja; no se muestra un enlace muerto).
- Cambios en Cocina más allá de su integración con el shell, y en las secciones internas de Admin y Dashboard.
- WebSockets (se mantiene polling).

## Diseño

### 1. Configuración única de navegación

Nuevo `src/config/navegacion.js`, fuente única de verdad:

```js
NAVEGACION = {
  mozo:     { home: '/mesas',      destinos: [Mesas, Mis pedidos] },
  cajero:   { home: '/por-cobrar', destinos: [Por cobrar, Mesas] },
  cocinero: { home: '/cocina',     destinos: [] },
  admin:    { home: '/dashboard',  destinos: [Dashboard, Mesas, Por cobrar, Cocina, Administración] },
}
```

Cada destino: `{ id, label, icono, path }`. Exporta `homeParaRol(rol)`. `Login.jsx` y `PrivateRoute.jsx` dejan de tener mapas propios y usan `homeParaRol` (fallback `/mesas`).

Cambio de comportamiento: el cajero ahora aterriza en `/por-cobrar` (antes `/mesas`).

### 2. AppShell

Nuevo `src/components/AppShell.jsx`, layout de ruta con `<Outlet />`. Envuelve todas las rutas privadas en `App.jsx`.

- **≥ 768 px (tablet/PC):** barra lateral fija a la izquierda (~80 px), icono sobre etiqueta corta. Al pie: avatar con iniciales, indicador de conexión, botón Salir.
- **< 768 px:** barra inferior con los destinos; franja superior delgada con nombre de usuario, indicador de conexión y Salir.
- Destino activo resaltado en ámbar (`#f59e0b`), consistente con el estilo actual.
- Objetivos táctiles de al menos 44 px.
- Los destinos salen de `NAVEGACION[rol]`.
- Modo sin barra: no se muestra navegación en las rutas de flujo (`/comanda`, `/cobro`) ni para el rol `cocinero`. En esos casos el contenido ocupa toda la pantalla.

### 3. Rutas y acceso

| Ruta | Roles | Nota |
|---|---|---|
| `/mesas` | mozo, cajero, admin | existente |
| `/comanda` | mozo, cajero, admin | existente, sin barra |
| `/cobro` | cajero, admin | existente, sin barra |
| `/por-cobrar` | cajero, admin | **nueva** |
| `/mis-pedidos` | mozo | **nueva** |
| `/cocina` | cocinero, admin | existente; con barra solo para admin |
| `/admin`, `/dashboard` | admin | existentes |

### 4. Pantallas nuevas

**Por cobrar (`/por-cobrar`)**

- Lista las mesas con pedido abierto, en dos grupos: *Listas para cobrar* (`items_total > 0` y `items_pendientes === 0`) y *En cocina* (resto, atenuadas, con el conteo de ítems pendientes).
- Cada tarjeta: número de mesa, tiempo transcurrido, total.
- Grupo *Listas*: ordenado por antigüedad (más espera primero). Un toque obtiene el pedido y navega a `/cobro` con `{ pedido, mesa }`.
- Grupo *En cocina*: no navega; muestra "N ítems en cocina", consistente con el bloqueo que ya aplica `irACobro` en Comanda.
- Estado vacío: "No hay mesas por cobrar".

**Mis pedidos (`/mis-pedidos`)**

- Lista las mesas con pedido abierto cuyo `mozo_id` es el usuario actual.
- Las que tienen platos listos para recoger (`items_listos > 0`) van primero, con badge "N listos".
- Un toque abre `/comanda` con `{ pedido, mesa }`, igual que Mesas.
- Estado vacío: "No tienes pedidos abiertos".

### 5. Datos compartidos y badges

- Un store Zustand `useMesas` (`src/store/useMesas.js`) contiene `mesas`, `cargando` y `recargar`. El shell inicia **un único** polling cada 10 s (mismo intervalo que hoy) para los roles distintos de cocinero. Mesas, Por cobrar y Mis pedidos leen del store; se elimina el `setInterval` propio de `Mesas.jsx`.
- Badges en la navegación, calculados desde el store:
  - *Por cobrar*: número de mesas listas para cobrar.
  - *Mis pedidos*: número total de platos listos para recoger.
- Se muestra un badge solo si el valor es mayor que 0.

### 6. Indicador de conexión

- Store `useConexion` (`src/store/useConexion.js`) con `enLinea`.
- Se actualiza con los eventos `online`/`offline` de `window` y con el interceptor de Axios en `api/client.js`: un error sin `response` (fallo de red) marca `enLinea = false`; cualquier respuesta recibida lo restablece.
- El shell muestra el punto verde/rojo y, cuando no hay conexión, un banner "Sin conexión — los cambios pueden no guardarse".
- Cocina conserva su propio indicador y botón Salir (no usa barra); puede leer `useConexion` para unificarse, sin cambiar su layout.

### 7. Cambios en páginas existentes

- **Mesas, Admin, Dashboard:** se elimina de su header la navegación duplicada, la hamburguesa y el Salir (ahora en el shell). Conservan título y controles propios de la pantalla.
- **Comanda:** su header mantiene "←" con destino fijo `/mesas` para todos los roles (ruta permitida para mozo, cajero y admin).
- **Cobro:** "← Comanda" navega a `/comanda` con `{ pedido, mesa }` en vez de `navigate(-1)`; si se llega desde Por cobrar, este botón lleva igualmente a la Comanda de esa mesa.

### 8. Cambio de backend (aditivo)

`GET /api/mesas` (`app/routers/mesas.py`, `MesaResponse` en `schemas.py`) agrega campos opcionales, `null` cuando la mesa no tiene pedido abierto:

- `pedido_id: int`
- `mozo_id: int` (`Pedido.usuario_id`)
- `items_total: int` (ítems no cancelados)
- `items_pendientes: int` (estado `pendiente` o `en_preparacion`)
- `items_listos: int` (estado `listo`)

Se calculan con **una sola consulta agrupada** sobre `PedidoItem` de los pedidos abiertos (evita N+1). Es retrocompatible: los campos actuales no cambian. Estados de ítem existentes: pendiente, en_preparacion, listo, entregado, cancelado.

## Manejo de errores

- Fallo del polling de mesas: se conserva la última lista y `useConexion` refleja el estado; no se vacía la pantalla.
- Al tocar una mesa de Por cobrar o Mis pedidos, si la petición del pedido falla se muestra `ModalConfirm` (nunca `alert`/`confirm` nativos).
- Rol sin acceso a una ruta: `PrivateRoute` redirige a `homeParaRol(rol)`.

## Pruebas y verificación

- Backend: nuevo `tests/test_mesas.py` que verifica los campos nuevos (mesa sin pedido → `null`; pedido con ítems en distintos estados y uno cancelado → conteos correctos; `mozo_id` correcto). Se ejecuta con `pytest`.
- Frontend (sin framework de tests en el proyecto; no se agrega uno en esta etapa): `npm run lint` y `npm run build` sin errores, más verificación manual por rol:
  - mozo: aterriza en Mesas, ve Mis pedidos con badge de platos listos, no puede abrir `/cobro`.
  - cajero: aterriza en Por cobrar, toque en mesa lista abre Cobro, mesa en cocina no navega.
  - cocinero: aterriza en Cocina, sin barra.
  - admin: ve los cinco destinos y llega a cualquiera en un toque.
  - Tablet ≥ 768 px muestra la barra lateral; móvil muestra la barra inferior.
  - Desconectar la red muestra el banner y lo quita al reconectar.

## Decisiones y supuestos

- Breakpoint del shell: 768 px (`md` de Tailwind).
- Se conserva el estilo visual actual (oscuro con ámbar).
- "Por cobrar" reutiliza la regla ya existente de Comanda: no se cobra con ítems `pendiente` o `en_preparacion`.
- Un único polling en el shell reemplaza los intervalos por pantalla; la Comanda mantiene su propio refresco de pedido (15 s).
