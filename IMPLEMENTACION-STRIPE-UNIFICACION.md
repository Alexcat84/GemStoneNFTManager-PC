# Plan de implementación: Stripe + Unificación (detalle)

Documento de trabajo que detalla tareas concretas, referencias y mejores prácticas para ejecutar el [PLAN-UNIFICACION-STRIPE.md](./PLAN-UNIFICACION-STRIPE.md), alineado con la [biblioteca-web-starters](file:///C:/Users/AlexDesk/Documents/biblioteca-web-starters).

---

## 1. Referencias y mejores prácticas

### 1.1 Biblioteca Web Starters

| Recurso | Uso en este proyecto |
|--------|------------------------|
| **pasarelas-pago.md** | Stripe: checkout, webhooks, no tocar datos de tarjeta en servidor. |
| **e-commerce.md** | Carrito, checkout, órdenes, inventario. |
| **datos/biblioteca.json** → `stripe-next` | [Stripe + Next.js (oficial)](https://github.com/stripe-samples/nextjs-template): lógica de Create Checkout Session, fulfillment vía webhook, idempotencia; aplicable a Express. |
| **admin.md** | Un solo panel admin con secciones (Productos, QR, Reportes). |

### 1.2 Principios aplicados

- **PCI:** Nunca almacenar ni procesar tarjeta en nuestro backend; Stripe Checkout o Payment Element.
- **Fulfillment:** Orden confirmada y stock actualizado solo tras webhook `checkout.session.completed` (no en redirect del usuario).
- **Idempotencia:** Webhook verificado por firma y procesado una sola vez por `stripe_session_id`.
- **Incremental:** No romper carrito ni checkout actual hasta que Stripe esté probado; convivir `/api/checkout` (legacy) con `/api/checkout/create-session` y webhook.

---

## 2. Estado actual vs objetivo

### 2.1 Checkout y pagos (04-main-website)

| Aspecto | Actual | Objetivo |
|---------|--------|----------|
| Flujo | `proceedToCheckout()` → `POST /api/checkout` → backend actualiza stock y devuelve `orderId` | `proceedToCheckout()` → `POST /api/checkout/create-session` → redirect a Stripe → usuario paga → webhook actualiza orden y stock → success page vacía carrito |
| Órdenes | No hay tabla `orders` | Tabla `orders` con `stripe_session_id`, `status` (pending/paid/cancelled), total, ítems, shipping |
| Pagos | Comentarios "Stripe/PayPal"; no hay integración | Stripe Checkout Session; webhook `POST /api/stripe/webhook` |
| Success | Solo notificación en la misma página | Página `/order-success?session_id=...` que vacía carrito y muestra agradecimiento |

### 2.2 Unificación (futuro)

| Aspecto | Actual | Objetivo |
|---------|--------|----------|
| Backend | 04, 05, 06 son tres apps Express separadas | Un solo backend en 04 (o en `shared/` + 04) |
| Admin | Login y dashboard separados en 04, 05, 06 | Un solo login y un dashboard con pestañas: Productos, QR, Reportes |
| DB | Tres copias de lógica PostgreSQL | Un módulo compartido o una sola app que expone tienda + QR + reportes |

---

## 3. Orden de implementación recomendado

1. **Fase A – Stripe en 04 (sin unificar)**  
   - Tabla `orders`.  
   - `POST /api/checkout/create-session` y `POST /api/stripe/webhook`.  
   - Frontend: redirigir a Stripe desde el carrito; página `order-success` y vaciar carrito.  
   - Mantener `POST /api/checkout` como legacy (opcional: marcar deprecado o usarlo solo para “draft” sin cobro).

2. **Fase B – Unificación**  
   - Mover rutas y lógica de 05 y 06 a 04.  
   - Unificar admin-panel en un solo dashboard con secciones.  
   - Ajustar despliegue y redirecciones.

Este documento y los cambios de código siguientes se centran en **Fase A (Stripe)**.

---

## 4. Tareas detalladas – Fase A (Stripe)

### 4.1 Base de datos

- **Archivo:** `04-main-website/database/postgres-database.js`
- **Acción:** En `initializeTables()`, crear tabla `orders`:
  - `id` SERIAL PRIMARY KEY  
  - `stripe_session_id` VARCHAR(255) UNIQUE  
  - `status` VARCHAR(20) DEFAULT 'pending' ('pending' | 'paid' | 'cancelled')  
  - `total` DECIMAL(10,2)  
  - `shipping_cost` DECIMAL(10,2) DEFAULT 0  
  - `tax` DECIMAL(10,2) DEFAULT 0  
  - `items` JSONB (array de { productId, variantId, name, price, quantity })  
  - `shipping_address` JSONB (opcional)  
  - `created_at`, `paid_at` TIMESTAMP WITH TIME ZONE  
- Añadir métodos: `createOrder(data)`, `getOrderByStripeSessionId(sessionId)`, `updateOrderPaid(id, paidAt)`.

### 4.2 Backend – Stripe

- **Dependencia:** `npm install stripe` en `04-main-website`.
- **Variables de entorno:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (y en front si se usa Stripe.js: `STRIPE_PUBLISHABLE_KEY` vía config o env público).
- **Archivo:** `04-main-website/index.js`
  - **Importante:** El webhook debe recibir el body **raw** para verificar la firma. En Express, usar `express.raw({ type: 'application/json' })` solo para la ruta `/api/stripe/webhook` (registrarla antes de `express.json()` para esa ruta o usar un router con raw body).
  - **POST /api/checkout/create-session**  
    - Recibe `{ items, shippingInfo }`.  
    - Valida ítems y stock (reutilizar lógica actual de checkout).  
    - Crea orden en DB con `status: 'pending'` y `stripe_session_id` vacío aún.  
    - Crea Stripe Checkout Session (mode: 'payment') con `line_items` derivados de `items`, `success_url`, `cancel_url`, `metadata.orderId` (o `metadata.order_id`).  
    - Actualiza la orden con `stripe_session_id` devuelto por Stripe.  
    - Responde `{ sessionId, url }` para que el front redirija.
  - **POST /api/stripe/webhook**  
    - Lee body raw y firma `Stripe-Signature`.  
    - `stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)`.  
    - Si evento es `checkout.session.completed`: obtener `session_id`, buscar orden por `stripe_session_id`, si no está ya `paid`: marcar `paid`, `paid_at`, llamar a `stockManager.updateStockAfterPurchase` con los ítems de la orden, responder 200.  
    - Idempotencia: si la orden ya está `paid`, solo responder 200.

### 4.3 Frontend – Carrito

- **Archivo:** `04-main-website/public/js/cart.js`
  - En `proceedToCheckout()`: en lugar de `fetch('/api/checkout', ...)` y vaciar carrito al éxito, llamar a `POST /api/checkout/create-session` con `{ items, shippingInfo }`.  
  - Si la respuesta tiene `url`, hacer `window.location.href = result.url` (redirección a Stripe).  
  - No vaciar el carrito aquí; se vacía en la página de éxito al volver de Stripe.
- **Archivo:** `04-main-website/public/js/cart-config.js`  
  - Añadir en `endpoints`: `createCheckoutSession: '/api/checkout/create-session'`.

### 4.4 Página de éxito

- **Archivo nuevo:** `04-main-website/public/order-success.html`  
  - Leer `session_id` de query string (Stripe redirige a `success_url` con `?session_id={CHECKOUT_SESSION_ID}`).  
  - Mostrar mensaje "Thank you for your purchase".  
  - Llamar a `cart.clearCart()` (o equivalente) y `updateCartDisplay()` si el carrito está en la misma página.  
  - Opcional: llamar a `GET /api/orders/by-session?session_id=...` para mostrar resumen (solo si se implementa ese endpoint).
- **Backend:** Ruta `GET /order-success` que sirva `order-success.html` (o ya cubierto por `/(.*)` → index.js que sirve estáticos; si no, añadir sendFile para `/order-success`).

### 4.5 URLs de Stripe

- `success_url`: por ejemplo `https://TU_DOMINIO/order-success?session_id={CHECKOUT_SESSION_ID}`.  
- `cancel_url`: por ejemplo `https://TU_DOMINIO/` o `/gallery`.  
- En local: usar `http://localhost:4000/order-success?session_id={CHECKOUT_SESSION_ID}` y equivalente para cancel.

### 4.6 Webhook en desarrollo

- Stripe CLI: `stripe listen --forward-to localhost:4000/api/stripe/webhook`.  
- Usar el signing secret que muestra el CLI como `STRIPE_WEBHOOK_SECRET` en `.env` local.

---

## 5. Checklist Fase A (Stripe)

- [x] Tabla `orders` en `postgres-database.js` y métodos asociados.
- [x] `npm install stripe` en 04-main-website.
- [ ] Variables de entorno: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BASE_URL`.
- [x] Ruta raw body para webhook (solo esa ruta).
- [x] `POST /api/checkout/create-session`: validar ítems/stock, crear orden pending, crear Checkout Session, devolver url.
- [x] `POST /api/stripe/webhook`: verificar firma, procesar `checkout.session.completed`, marcar orden paid y actualizar stock.
- [x] Frontend: `proceedToCheckout()` llama create-session y redirige a `result.url`; fallback a legacy `/api/checkout` si Stripe no configurado.
- [x] Página `order-success.html`: limpiar carrito en localStorage y mostrar agradecimiento.
- [x] Ruta GET `/order-success` que sirve order-success.html.
- [ ] Probar con tarjetas de test Stripe y `stripe listen` en local.

---

## 6. Próximos pasos (Fase B – Unificación)

- [ ] Decidir si se usa `shared/` para DB o todo en 04.
- [ ] Migrar rutas de 05 (QR, codes, `/qr/:qrId`) a 04.
- [ ] Migrar rutas de 06 (reportes) a 04.
- [ ] Unificar admin-panel: un login, un dashboard con Productos + QR + Reportes.
- [ ] Despliegue único y redirecciones desde 05 y 06 si se desea mantener URLs antiguas.

---

*Referencias: [PLAN-UNIFICACION-STRIPE.md](./PLAN-UNIFICACION-STRIPE.md), [biblioteca-web-starters](file:///C:/Users/AlexDesk/Documents/biblioteca-web-starters), [Stripe Checkout Quickstart](https://stripe.com/docs/checkout/quickstart), [Stripe Webhooks](https://stripe.com/docs/webhooks), [Stripe + Next.js sample](https://github.com/stripe-samples/nextjs-template).*
