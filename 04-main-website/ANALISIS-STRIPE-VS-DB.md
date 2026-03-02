# Análisis: Stripe vs galería / base de datos

## Resumen

- **El arreglo de Stripe** solo toca `index.js` (normalización de `baseUrl`). **No toca** la base de datos ni `postgres-database.js`.
- **Lo que rompe la galería** es cambiar `postgres-database.js` para usar `connectionString` en lugar del parseo por regex. Ese cambio hace que la conexión a Prisma falle (“upstream database”).
- **Estado correcto:** mantener `postgres-database.js` con regex; mantener en `index.js` el fix de Stripe (baseUrl con esquema). Así funcionan galería y checkout.

---

## 1. Qué hace el fix de Stripe y dónde está

**Archivo:** `04-main-website/index.js`  
**Ruta:** `POST /api/checkout/create-session` (aprox. líneas 715–720).

**Problema:** Stripe exige que `success_url` y `cancel_url` tengan esquema explícito (`https://` o `http://`). Si `BASE_URL` en Vercel viene sin esquema (solo el dominio), Stripe devuelve:

`Invalid URL: An explicit scheme (such as https) must be provided.`

**Solución (ya aplicada):**

```js
const rawBase = process.env.BASE_URL || (req.headers.origin || '').replace(/\/$/, '') || `http://localhost:${PORT}`;
const baseUrl = (rawBase && !/^https?:\/\//i.test(rawBase))
  ? (rawBase.startsWith('localhost') || rawBase.startsWith('127.0.0.1') ? `http://${rawBase}` : `https://${rawBase}`)
  : rawBase;
const successUrl = `${baseUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = `${baseUrl}/#gallery`;
```

Solo se usa `baseUrl` para construir las URLs de Stripe y, si hace falta, para las imágenes de los line_items. No se usa en ninguna ruta de API ni en la lógica de base de datos.

**Conclusión:** El fix de Stripe **no** corta el flujo de la base de datos. Solo afecta al checkout de Stripe.

---

## 2. Por qué “deja de funcionar” cuando hacemos otros cambios

La galería deja de funcionar cuando en `04-main-website/database/postgres-database.js` se sustituye el **parseo por regex + opciones explícitas** del `Pool` por **solo `connectionString`**:

**Versión que funciona (actual):**

- Se parsea `DATABASE_URL` con un regex.
- Se crea el `Pool` con `host`, `port`, `database`, `user`, `password` y `ssl: { rejectUnauthorized: false }`.

**Versión que falla (la que hemos revertido):**

- Se pasa `connectionString` directamente a `new Pool({ connectionString, ssl: ... })`.
- La conexión a `db.prisma.io` (Prisma) falla y el servidor de Prisma devuelve algo como:  
  `Failed to connect to upstream database. Please contact Prisma support if the problem persists.`

**Por qué pasa:**  
Con **opciones explícitas**, el cliente `pg` envía al proxy de Prisma (db.prisma.io) un handshake y parámetros de startup muy concretos (host, port, database, user, password, SSL). Con **solo `connectionString`**, `pg` parsea la URL y puede:

- Interpretar distinto el path (p. ej. base vacía si la URL es `5432/?sslmode=require`).
- Enviar otros parámetros de startup o de SSL.

Esa diferencia puede hacer que el proxy de Prisma rechace la conexión o no pueda conectar al upstream, de ahí el mensaje de error de Prisma. El fallo está en **cómo nos conectamos al proxy**, no en Prisma en sí cuando usamos la forma que ya funciona (regex + opciones explícitas).

---

## 3. Qué dicen los docs

- **Stripe:** Las URLs de redirect deben incluir esquema (`https://` o `http://`). Nuestro fix cumple eso sin tocar la DB.
- **Prisma / PostgreSQL:** Aceptan tanto `postgres://` como `postgresql://` y parámetros como `?sslmode=require`. No obligan a usar solo `connectionString`; usar opciones explícitas (host, port, database, user, password, ssl) es válido y en este proyecto es lo que funciona con el proxy de Prisma.

---

## 4. Cómo debe quedar todo para que Stripe funcione y la galería no se rompa

1. **No cambiar** `04-main-website/database/postgres-database.js`: dejar el parseo por regex y la creación del `Pool` con `host`, `port`, `database`, `user`, `password`, `ssl: { rejectUnauthorized: false }`. No usar solo `connectionString` en ese archivo.
2. **Mantener** en `04-main-website/index.js` la normalización de `baseUrl` en la ruta `POST /api/checkout/create-session` (como está ahora).
3. **Opcional:** En Vercel, definir `BASE_URL` con esquema (p. ej. `https://tu-dominio.vercel.app`) para no depender solo de la normalización; no es obligatorio si el código ya añade `https://` cuando falta.

Con esto, el checkout de Stripe tiene URLs válidas y la conexión a la base de datos (y por tanto la galería) sigue funcionando como ahora.
