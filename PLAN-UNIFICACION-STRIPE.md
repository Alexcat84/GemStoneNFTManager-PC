# Plan: Unificación en un solo backend + Implementación Stripe

Documento de referencia para unificar los proyectos GemStone NFT Manager en un solo backend con un único admin e integrar Stripe sin dañar lo ya implementado. Incluye estado actual, mejores prácticas y pasos concretos.

---

## 1. Estado actual del proyecto

### 1.1 Estructura del monorepo

| Carpeta | Rol | Stack | Puerto / Despliegue |
|---------|-----|--------|----------------------|
| **01-code-generator** | App de escritorio para generar códigos GemStone (correlativos, ubicaciones, checksum). No es web. | Electron, SQLite, `qrcode`, Chart.js | N/A (Electron) |
| **04-main-website** | Web pública (GemSpots): catálogo, carrito, checkout, admin de productos. | Express, PostgreSQL, JWT, bcrypt, multer | Vercel: gem-stone-nft-manager-pc-alexs-projects-e8bf95b4.vercel.app |
| **05-nft-qr-generator** | Generación y gestión de códigos QR de NFTs; panel admin; redirección `/qr/:qrId` por estado (ready/pending). | Express, PostgreSQL, SQLite (opcional), `qrcode`, JWT, multer | Vercel: qr-generator-nine-delta.vercel.app |
| **06-nft-reports** | Sistema de reportes/dashboard (QRs, códigos, productos). Login + APIs de reportes. | Express, PostgreSQL, JWT | Vercel: gemstone-reports.vercel.app |

- No hay `package.json` en la raíz ni workspaces; cada app se ejecuta por separado (`npm start` en cada carpeta).
- 04, 05 y 06 comparten conceptualmente el mismo esquema de PostgreSQL (products, admin_users, qr_codes, locations, generated_codes, etc.) pero **no comparten código**: cada uno tiene su copia de `database/postgres-database.js` (o equivalente).

### 1.2 Carrito de compras (04-main-website)

| Aspecto | Implementación actual |
|---------|------------------------|
| **Estado** | Clase `ShoppingCart` en `public/js/cart.js`; estado en memoria en `this.items`. |
| **Persistencia** | `localStorage` con clave `gemspots_cart` (definida en `public/js/cart-config.js`). `saveCart()` escribe el array de ítems. No hay backend para el carrito. |
| **Límites** | `maxItems: 50` en `CART_CONFIG`; cada ítem es único (cantidad 1 por variante). |
| **Reserva de stock** | `POST /api/stock/check`, `POST /api/stock/reserve` con `sessionId` (localStorage `cart_session_id`). |
| **Checkout** | Usuario hace "Proceed to Checkout" → `cart.proceedToCheckout()` envía `POST /api/checkout` con `{ items, shippingInfo, paymentInfo }`. Backend valida ítems, actualiza stock con `stockManager.updateStockAfterPurchase`, **no procesa pago**; responde `success`, `orderId: 'ORD-' + Date.now()`. Tras éxito, el frontend vacía el carrito. |

**Archivos clave del carrito:**

- `04-main-website/public/js/cart.js` — clase `ShoppingCart`, load/save, UI del modal, `proceedToCheckout()`.
- `04-main-website/public/js/cart-config.js` — `CART_CONFIG` (maxItems, currency, tax, shipping, storageKey, endpoints).
- `04-main-website/public/js/shipping.js` — cálculo de envío y total.
- `04-main-website/public/css/cart.css` — estilos del carrito.
- Modal de carrito en `04-main-website/public/index.html`, `gallery.html`, `nft-guide.html`.

### 1.3 Pagos (04-main-website)

- **No hay integración real de pagos.** En el backend (`04-main-website/index.js`, ~líneas 675–678) hay comentarios: "Process payment with Stripe/PayPal", "Send confirmation email", etc., pero **no hay código** que llame a Stripe, PayPal ni otro gateway.
- En `cart-config.js` está declarado `processPayment: '/api/payment/process'`, pero **no existe** la ruta `/api/payment/process` en el servidor.
- El checkout solo: valida ítems, actualiza stock y devuelve `orderId` ficticio; `paymentInfo` se envía con `method: 'credit_card'` desde el front pero no se usa en el servidor.
- Las menciones a "payment processor", "credit card, PayPal" en `terms-of-service.html`, `returns.html`, `privacy-policy.html` son solo texto legal.

### 1.4 Admins y autenticación

- **04-main-website:** `/admin/login`, `/admin/dashboard`; `admin-panel/`, `admin-panel/admin-auth.js`; rutas `/api/admin/*`.
- **05-nft-qr-generator:** `/`, `/dashboard`; `admin-panel/`; rutas `/api/login`, `/api/admin/products`, etc.
- **06-nft-reports:** `/`, `/dashboard`; `admin-panel/`; rutas `/api/login`, `/api/reports/*`.

Cada app tiene su propio login y su propia lógica de JWT; no hay SSO ni sesión compartida.

### 1.5 Rutas principales por proyecto

**04-main-website:** `/`, `/gallery`, `/about`, `/contact`, `/admin/login`, `/admin/dashboard`, `/api/gemspots`, `/api/gallery`, `/api/gemspots/:id`, `/api/checkout`, `/api/stock/*`, `/api/admin/*`.

**05-nft-qr-generator:** `/`, `/dashboard`, `/api/login`, `/api/qr/*`, `/api/locations`, `/api/codes/*`, `/api/admin/products`, `/qr/:qrId`.

**06-nft-reports:** `/`, `/dashboard`, `/api/login`, `/api/reports/qrs`, `/api/reports/codes`, `/api/reports/products`.

### 1.6 Base de datos

- **01:** SQLite local (Electron).
- **04, 05, 06:** cada uno con su propio módulo PostgreSQL (`database/postgres-database.js` o similar) y `process.env.DATABASE_URL`. Mismo esquema conceptual; sin paquete compartido.

### 1.7 Stock (solo 04)

- `04-main-website/database/stock-manager.js` — reservas en memoria, chequeo y actualización de stock (variantes y productos).

---

## 2. Mejores prácticas y referencias en las que se basa este plan

### 2.1 Pagos y PCI

- **Nunca almacenar ni procesar datos de tarjeta en tu servidor** salvo que tengas certificación PCI DSS. Usar una pasarela que maneje el cobro (Stripe, PayPal, etc.) y solo recibir en tu backend un identificador de pago (p. ej. `payment_intent_id`, `session_id`).
- **Stripe Checkout** (redirección a Stripe) o **Stripe Payment Element** (formulario en tu dominio): Stripe cumple PCI; el usuario introduce la tarjeta en su contexto.
- Referencia: [Stripe – Secure payment processing](https://stripe.com/docs/payments).

### 2.2 Flujo de pago recomendado (orden solo después de pago confirmado)

1. Usuario hace "Proceed to Checkout" → backend crea **Stripe Checkout Session** (o PaymentIntent) con total, ítems, envío.
2. Usuario paga en la página de Stripe (o en tu página con Stripe Elements).
3. Stripe envía **webhook** (p. ej. `checkout.session.completed`) a tu servidor → tú marcas la orden como pagada, actualizas stock y envías confirmación.
4. Solo entonces se confirma la orden al usuario y se vacía el carrito.

Así se evita confirmar órdenes y descontar stock sin cobro real. Referencia: [Stripe – Fulfillment and webhooks](https://stripe.com/docs/payments/checkout/fulfillment).

### 2.3 Idempotencia y webhooks

- Usar **webhooks** de Stripe para marcar la orden como pagada y actualizar stock, no solo el redirect del navegador (el usuario puede cerrar la pestaña antes de volver).
- Verificar la firma del webhook (`Stripe-Signature`) y procesar cada evento una sola vez (idempotencia por `payment_intent_id` o `session_id`). Referencia: [Stripe – Webhooks](https://stripe.com/docs/webhooks).

### 2.4 Plantillas y ejemplos de referencia

- **Stripe + Next.js (oficial):** [github.com/stripe-samples/nextjs-template](https://github.com/stripe-samples/nextjs-template) — Checkout, Suscripciones, webhooks. Aunque el proyecto actual es Express, la lógica de Stripe (Create Checkout Session, webhooks, fulfillment) es la misma en Node.
- **Biblioteca Web Starters (este repositorio):** entrada en `datos/biblioteca.json` para "Stripe + Next.js (oficial)" y categoría "pasarelas-pago"; uso como referencia de mejores prácticas para pagos.
- **Stripe Node.js:** [Stripe API – Node](https://stripe.com/docs/api?lang=node) y [Stripe Checkout – Quickstart](https://stripe.com/docs/checkout/quickstart).

### 2.5 Un solo backend y un solo admin

- Evitar duplicar lógica de negocio y de base de datos; un solo punto de verdad para órdenes, usuarios admin, productos, QR y reportes.
- Un solo login admin con JWT (o sesión) que dé acceso a: Productos, QR, Reportes, desde un único dashboard con menú o pestañas.

---

## 3. Plan de unificación (un solo backend, sin romper lo existente)

### 3.1 Objetivo

- Un **solo servidor Express** (o mantener 04 como base y absorber 05 y 06) que exponga:
  - Rutas de **tienda:** `/api/gemspots`, `/api/gallery`, `/api/checkout`, `/api/stock/*`, etc.
  - Rutas de **QR:** `/api/qr/*`, `/api/locations`, `/api/codes/*`, y la ruta de redirección `/qr/:qrId`.
  - Rutas de **reportes:** `/api/reports/qrs`, `/api/reports/codes`, `/api/reports/products`.
  - Rutas de **admin unificado:** `/admin/login`, `/admin/dashboard`, `/api/admin/*` (productos, QR, reportes según permisos si se desea).
- Un **único panel admin** con menú o secciones: Productos (actual 04), QR (actual 05), Reportes (actual 06). Un solo login para todo.
- **Frontends actuales:** la web pública (04) sigue sirviendo los mismos HTML/JS; los paneles de 05 y 06 se convierten en vistas o rutas del mismo backend (p. ej. `/admin/dashboard#qr`, `/admin/dashboard#reports`) o se migran a una SPA única bajo `/admin`.

### 3.2 Enfoque incremental (no romper lo ya logrado)

1. **Fase 1 – Código compartido de base de datos (opcional pero recomendado)**  
   - Crear en la raíz del monorepo una carpeta `shared/` o `packages/database/` con un único módulo de PostgreSQL (conexión, queries, esquema).  
   - Que 04-main-website sea el primero en usar ese módulo (refactor interno); luego 05 y 06 se migran al mismo backend y dejan de tener su propio servidor.

2. **Fase 2 – Unificar en 04-main-website**  
   - Copiar o mover las rutas y lógica de 05 (QR, generación, `/qr/:qrId`) a 04: nuevos endpoints bajo `/api/qr/*`, `/api/codes/*`, `/api/locations`, y la ruta GET `/qr/:qrId`.  
   - Copiar o mover las rutas y lógica de 06 (reportes) a 04: endpoints bajo `/api/reports/*`.  
   - Reutilizar el mismo cliente de PostgreSQL (el de 04 o el de `shared/`); no duplicar tablas.

3. **Fase 3 – Un solo admin**  
   - Unificar `admin-panel/` en uno solo: una página de login (`/admin/login`) y un dashboard (`/admin/dashboard`) con secciones o pestañas: Productos, QR, Reportes.  
   - Reutilizar la autenticación actual de 04 (`admin-auth.js`); misma tabla `admin_users` para todos.  
   - Las pantallas que hoy están en 05 y 06 pasan a ser rutas o vistas dentro de ese dashboard (p. ej. `/admin/dashboard?section=qr`, `/admin/dashboard?section=reports`).

4. **Fase 4 – Despliegue**  
   - Un solo despliegue para la app unificada (04); las URLs de 05 y 06 pueden redirigir a la nueva app o quedar como proxy a la misma si se desea mantener enlaces antiguos.

5. **01-code-generator**  
   - Se deja como está (Electron, SQLite); no forma parte del backend web.

### 3.3 Estructura objetivo (resumida)

```
GemStoneNFTManager-PC/
├── 01-code-generator/          # Sin cambios (Electron)
├── 04-main-website/            # Backend y frontend unificados
│   ├── index.js                # Todas las rutas: tienda, checkout, QR, reportes, admin
│   ├── database/               # Un solo módulo DB (o enlace a shared/)
│   ├── admin-panel/            # Un solo panel: Productos + QR + Reportes
│   ├── public/                 # Web pública (GemSpots) + assets
│   └── ...
├── 05-nft-qr-generator/        # (Opcional) Deprecar o mantener solo como referencia hasta migrar
├── 06-nft-reports/             # (Opcional) Deprecar o mantener solo como referencia
└── shared/                     # (Opcional) DB y utilidades compartidas
```

### 3.4 Qué no tocar hasta que Stripe esté listo

- La lógica actual del carrito (localStorage, reserva de stock, `proceedToCheckout()` llamando a `/api/checkout`) puede mantenerse; solo se cambiará el **flujo** del checkout para que primero cree una sesión de Stripe y no confirme orden hasta el webhook.  
- No eliminar endpoints actuales hasta tener los nuevos probados (p. ej. mantener `/api/checkout` temporalmente o renombrarlo a `/api/orders/create-draft` si se usa para crear orden en estado `pending`).

---

## 4. Plan de implementación de Stripe

### 4.1 Prerrequisitos

- Cuenta Stripe (modo test con claves `pk_test_...` y `sk_test_...`).  
- En backend: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (para verificar webhooks).  
- En frontend (si se usa Stripe.js): `STRIPE_PUBLISHABLE_KEY` (puede estar en el HTML o en una config pública).

### 4.2 Flujo objetivo con Stripe Checkout (recomendado para no tocar PCI)

1. Usuario hace "Proceed to Checkout" en el carrito.  
2. Frontend llama a `POST /api/checkout/create-session` con `{ items, shippingInfo }` (sin datos de tarjeta).  
3. Backend:  
   - Valida ítems y stock.  
   - Crea una **orden** en DB en estado `pending` (opcional pero recomendado: tabla `orders` con `id`, `stripe_session_id`, `status: 'pending'`, total, ítems, shipping, etc.).  
   - Crea una **Stripe Checkout Session** con `line_items` (precio y cantidad), `success_url`, `cancel_url`, y `metadata` (p. ej. `orderId` o `sessionId`).  
   - Devuelve `{ sessionId }` (y opcionalmente `url` si Stripe devuelve la URL de la sesión).  
4. Frontend redirige al usuario a la URL de Stripe Checkout (`session.url`).  
5. Usuario paga en Stripe; Stripe redirige a `success_url` (p. ej. `/order-success?session_id={CHECKOUT_SESSION_ID}`).  
6. Stripe envía webhook `checkout.session.completed` a tu backend.  
7. Backend (en el webhook):  
   - Verifica la firma con `STRIPE_WEBHOOK_SECRET`.  
   - Obtiene `session_id`, busca la orden por `stripe_session_id` (o por metadata).  
   - Marca la orden como `paid`.  
   - Actualiza stock (`stockManager.updateStockAfterPurchase`).  
   - Envía email de confirmación (si está implementado).  
   - Responde 200 para que Stripe no reintente.  
8. En la página `success_url` el frontend puede mostrar "Gracias por tu compra" y vaciar el carrito (y opcionalmente llamar a un endpoint para "confirmar lectura" o no; la fuente de verdad es el webhook).

### 4.3 Endpoints a añadir en 04-main-website

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/checkout/create-session` | Recibe ítems y shipping; crea orden `pending` y Stripe Checkout Session; devuelve `sessionId` y `url`. |
| POST | `/api/stripe/webhook` | Recibe eventos de Stripe; verifica firma; procesa `checkout.session.completed` (marcar orden pagada, actualizar stock). Debe ser raw body para la firma. |

### 4.4 Cambios en el frontend del carrito

- En `proceedToCheckout()` (o en un paso previo): en lugar de llamar a `POST /api/checkout` y vaciar el carrito al recibir éxito, llamar a `POST /api/checkout/create-session`, obtener `url` y hacer `window.location.href = url` (redirección a Stripe).  
- Página de éxito (p. ej. `/order-success.html`): mostrada tras volver de Stripe; vaciar el carrito (`cart.clearCart()` o equivalente) y mostrar mensaje de agradecimiento. Opcional: mostrar resumen de la orden si el backend lo devuelve al consultar por `session_id`.  
- El endpoint actual `POST /api/checkout` puede dejarse inactivo o reconvertirse en "solo crear orden draft" sin actualizar stock hasta el webhook.

### 4.5 Tabla de órdenes (recomendada)

Crear tabla `orders` (o equivalente) con al menos:

- `id` (PK), `stripe_session_id` (único), `status` ('pending' | 'paid' | 'cancelled'), `total`, `shipping_cost`, `tax`, `items` (JSON o tabla relacionada), `shipping_address` (JSON), `created_at`, `paid_at`.  
- El webhook actualiza `status` a `paid` y `paid_at` al recibir `checkout.session.completed`.

### 4.6 Webhook en desarrollo

- Usar Stripe CLI: `stripe listen --forward-to localhost:PORT/api/stripe/webhook` para recibir eventos en local y obtener el `webhook signing secret` temporal.  
- Referencia: [Stripe – Testing webhooks](https://stripe.com/docs/webhooks/test).

### 4.7 Referencias Stripe utilizadas en este plan

- [Stripe Checkout – Quickstart](https://stripe.com/docs/checkout/quickstart)  
- [Stripe Checkout – Fulfillment](https://stripe.com/docs/payments/checkout/fulfillment)  
- [Stripe Webhooks](https://stripe.com/docs/webhooks)  
- [Stripe Node.js library](https://github.com/stripe/stripe-node)  
- [Stripe + Next.js sample](https://github.com/stripe-samples/nextjs-template) (lógica aplicable a Express)

---

## 5. Resumen de tareas (checklist)

### Unificación

- [ ] Definir si se usa carpeta `shared/` para DB o solo se centraliza en 04.  
- [ ] Migrar rutas y lógica de 05 (QR, códigos, `/qr/:qrId`) a 04.  
- [ ] Migrar rutas y lógica de 06 (reportes) a 04.  
- [ ] Unificar admin-panel: un solo login, un dashboard con Productos, QR, Reportes.  
- [ ] Probar que la web pública, el flujo de carrito y la reserva de stock sigan funcionando.  
- [ ] Ajustar despliegue (un solo servicio para 04) y redirecciones si se mantienen URLs de 05 y 06.

### Stripe

- [ ] Crear cuenta Stripe y obtener claves de test.  
- [ ] Añadir dependencia `stripe` en 04-main-website.  
- [ ] Crear tabla `orders` (o equivalente) con `stripe_session_id` y `status`.  
- [ ] Implementar `POST /api/checkout/create-session` (validar ítems, crear orden `pending`, crear Checkout Session, devolver URL).  
- [ ] Implementar `POST /api/stripe/webhook` (verificar firma, procesar `checkout.session.completed`, actualizar orden y stock).  
- [ ] Cambiar el frontend del carrito para redirigir a Stripe Checkout en lugar de llamar a `/api/checkout` y vaciar carrito al volver en página de éxito.  
- [ ] Crear página de éxito de compra y configurar `success_url` y `cancel_url`.  
- [ ] Probar con tarjetas de test de Stripe y con Stripe CLI para webhooks en local.

### Referencias rápidas

- Biblioteca Web Starters (este repo): `datos/biblioteca.json` → entrada "Stripe + Next.js (oficial)", categoría "pasarelas-pago".  
- Stripe Checkout: https://stripe.com/docs/checkout/quickstart  
- Stripe Webhooks: https://stripe.com/docs/webhooks  
- Stripe + Next.js sample: https://github.com/stripe-samples/nextjs-template  

---

*Documento generado para uso en la unificación del backend GemStone NFT Manager e implementación de Stripe. Actualizar según avances del proyecto.*
