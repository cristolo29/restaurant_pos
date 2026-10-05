---
name: pos-ui-ux
description: Use when designing, building or reviewing UI/UX for the restaurant POS frontend (mesas, comanda, cobro, cocina, admin, dashboard) — touch targets, speed of operation, role-based screens, status colors, order/payment flows, error prevention, accessibility in noisy, hurried environments.
---

# Diseño UI/UX para POS profesional (restaurante)

Un POS no es una app de consumo: se usa de pie, con prisa, con manos mojadas, en pantallas táctiles, miles de veces por turno. **Velocidad, claridad y cero errores** pesan más que la estética.

## Principios

1. **Pocos toques por tarea.** Meta: agregar un producto = 1 toque; abrir mesa → enviar comanda ≤ 5 toques. Cuenta los toques antes de dar por bueno un flujo.
2. **Reconocer, no recordar.** Todo visible (categorías, mesas, estados). Evita menús ocultos y gestos no evidentes.
3. **Prevenir errores > confirmar errores.** Deshabilitar acciones inválidas, mostrar por qué, y confirmar solo lo destructivo o irreversible.
4. **Estado siempre visible.** Mesa, pedido, total y usuario actual a la vista sin hacer scroll.
5. **Consistencia absoluta.** Mismo color = mismo significado en todas las pantallas. Mismo botón primario en la misma posición.
6. **Perdonar.** Deshacer/quitar ítems fácil antes de enviar; no perder el pedido al navegar o ante un error de red.

## Táctil

- Objetivo mínimo **48×48 px** (ideal 56–64 px para acciones frecuentes: productos, +/−, cobrar). Separación ≥ 8 px entre objetivos.
- Acciones primarias abajo/derecha (alcance del pulgar en tablet); destructivas lejos de las primarias.
- Sin hover como único feedback: usar `active:` con cambio visible inmediato (< 100 ms).
- Sin doble clic, sin clic derecho, sin tooltips imprescindibles. Texto de botón ≥ 16 px; precios y totales ≥ 20 px.
- Deshabilitar el botón mientras la petición está en vuelo (evita doble envío de comandas/cobros).

## Estados de mesa y pedido (colores semánticos)

Define **una sola** tabla de tokens (Tailwind theme) y reutilízala. Nunca solo color: añade icono o texto.

| Estado | Color sugerido | Refuerzo |
|---|---|---|
| Libre | verde | texto "Libre" |
| Ocupada | rojo/ámbar | tiempo transcurrido |
| Por cobrar | azul/violeta | icono de cuenta |
| Reservada | gris/azul claro | hora |
| Pedido pendiente / en preparación / listo | ámbar / azul / verde | etiqueta + contador |

- Contraste texto/fondo ≥ 4.5:1 (WCAG AA); ≥ 3:1 en componentes grandes. Verifica en brillo bajo y alto.
- Los estados cambian por polling (Mesas cada 10 s): anima sutilmente el cambio y no muevas el layout bajo el dedo.

## Pantallas por rol

- **Mozo (`/mesas`, `/comanda`)**: mapa de mesas por salón; comanda con categorías en barra fija, grilla de productos grande, resumen del pedido siempre visible (panel lateral en tablet, hoja inferior en móvil). Notas por ítem (sin cebolla, término) con atajos rápidos.
- **Cajero (`/cobro`)**: total enorme, desglose subtotal/IGV 18 %, métodos de pago como botones grandes, boleta vs factura claro (la factura exige RUC: validar al instante), división de cuenta, vuelto calculado automáticamente, teclado numérico propio.
- **Cocina (`/cocina`)**: pantalla tipo KDS — tarjetas grandes legibles a 1–2 m, ordenadas por antigüedad, temporizador con color que escala (verde → ámbar → rojo), un toque para avanzar estado, modo oscuro por defecto, sin scroll horizontal.
- **Admin / Dashboard**: aquí sí caben tablas densas y gráficos; resumen de KPIs arriba (ventas, ticket promedio, mesas activas), filtros de fecha persistentes.

## Flujos críticos

- **Login por PIN**: teclado numérico grande, puntos enmascarados, feedback de error sin borrar la pantalla, bloqueo tras intentos fallidos. Mostrar el rol/usuario tras entrar.
- **Enviar comanda**: confirmar visualmente (toast + mesa cambia de estado); si falla la red, conservar el borrador y ofrecer reintento.
- **Cancelar/anular**: siempre con `ModalConfirm` (nunca `alert()`/`confirm()` nativos — regla del proyecto) que nombre lo que se pierde ("¿Anular 3 ítems de Mesa 5?"), botón destructivo diferenciado, motivo cuando afecta caja.
- **Cobro**: resumen final antes de confirmar; tras cobrar, mostrar comprobante (imprimir/enviar) y liberar la mesa; evitar cobrar dos veces el mismo pedido.

## Feedback y errores

- Toasts no bloqueantes para éxito; modal solo para decisiones. Errores en lenguaje llano y accionable ("Sin conexión. Tu pedido está guardado, reintenta"), nunca códigos HTTP crudos.
- Estados de carga con skeletons, no spinners a pantalla completa; estados vacíos con una acción clara.
- Indicador de conexión visible (el POS depende de la red/polling).

## Layout y visual

- Diseño **tablet-first (landscape 1024×768 y 768×1024)**, con soporte móvil para el mozo. Sin dependencia de scroll de página en comanda y cobro: scroll solo dentro de listas.
- Jerarquía: 1 acción primaria por pantalla; el resto secundarias/fantasma. Espaciado en escala de 4/8 px.
- Tipografía sans legible (Inter o similar), números tabulares (`tabular-nums`) en precios y totales; moneda siempre con formato local (`S/ 12.50`).
- Modo oscuro opcional pero cuidado en cocina y salones con poca luz; evitar blanco puro a pantalla completa.
- Animaciones ≤ 150–200 ms, respetar `prefers-reduced-motion`.

## Accesibilidad

- Navegable por teclado con foco visible (cajas con lector de código/teclado), `aria-label` en botones solo-icono, roles y `aria-live` para cambios de estado de mesas/pedidos.
- No transmitir información solo con color. Textos de error asociados al campo.

## Implementación en este repo

- Componentes reutilizables en `frontend_react/src/` (botón táctil, tarjeta de mesa, `ModalConfirm`, teclado numérico, badge de estado) con tokens de Tailwind compartidos; no repetir clases sueltas por pantalla.
- Rutas y permisos viven en `App.jsx` (`PrivateRoute` con roles): una pantalla nueva debe respetar la matriz de roles de `CLAUDE.md`.
- Totales con IGV 18 % se calculan según las reglas del backend; la UI solo presenta, no redefine.

## Checklist antes de dar una pantalla por terminada

- [ ] ¿Se puede hacer la tarea principal en el mínimo de toques?
- [ ] ¿Todos los objetivos táctiles ≥ 48 px y separados?
- [ ] ¿Colores de estado consistentes, con texto/icono y contraste AA?
- [ ] ¿Acciones destructivas pasan por `ModalConfirm` y nombran el impacto?
- [ ] ¿Doble envío imposible (botón deshabilitado en vuelo)?
- [ ] ¿Funciona en tablet horizontal y vertical sin scroll de página?
- [ ] ¿Estados de carga, vacío y error cubiertos?
- [ ] ¿Probada con el rol correcto y rechazando los roles no autorizados?
