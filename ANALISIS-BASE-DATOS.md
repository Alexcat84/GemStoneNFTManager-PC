# Análisis: base de datos y cambios recientes

## Revert realizado

Se revirtió **solo** el cambio del fix de la URL de Stripe (commit b5eb79a):

- **Antes del fix:** `baseUrl` se tomaba de `process.env.BASE_URL` o `req.headers.origin` sin normalizar.
- **Fix (revertido):** Se añadía `https://` (o `http://` en localhost) cuando la URL no tenía esquema.
- **Estado actual:** Vuelve a usarse una sola línea:  
  `const baseUrl = process.env.BASE_URL || (req.headers.origin || '').replace(/\/$/, '') || \`http://localhost:${PORT}\`;`

**Consecuencia:** Si en Vercel `BASE_URL` está definida **sin** `https://` (por ejemplo solo el dominio), Stripe puede volver a devolver *"Invalid URL: An explicit scheme (such as https) must be provided"*. Cuando la base de datos funcione y quieras volver a usar Stripe Checkout, conviene asegurar que `BASE_URL` incluya el esquema (ej. `https://tu-dominio.vercel.app`) o reaplicar el fix de normalización en `04-main-website/index.js`.

---

## Flujo de la base de datos (para no dañar)

### Inicialización

1. **`04-main-website/index.js`**
   - Crea `database = new PostgresDatabase()` dentro de un `try/catch`.
   - Si el constructor de `PostgresDatabase` lanzara, `database` quedaría `undefined` y el servidor seguiría arrancando "sin servicios".

2. **`04-main-website/database/postgres-database.js`**
   - El **constructor no lanza**: si falta `DATABASE_URL`, el formato no coincide con el regex o falla la creación del `Pool`, se asigna `this.pool = null` y se sigue.
   - Por tanto, `database` casi siempre es un **objeto** (instancia de `PostgresDatabase`), pero `database.pool` puede ser `null` cuando la DB no está disponible.

### Uso en las rutas

- En `index.js` las rutas suelen comprobar solo `if (!database)` y devolver 500.
- Si `database` existe pero `database.pool` es `null`, al llamar por ejemplo a `database.getFeaturedProducts()` se hace `this.pool.connect()` y se **lanza** porque `pool` es `null`. Ese error lo captura el `catch` de la ruta y se responde 500.
- **Recomendación para no dañar:** En rutas que usen la DB, comprobar también el pool:  
  `if (!database || !database.pool) return res.status(500).json({ success: false, message: 'Database not available' });`  
  Así se evita lanzar y se devuelve un 500 controlado. No cambia el comportamiento funcional cuando la DB no está.

### Formato de DATABASE_URL

- El regex en `postgres-database.js` espera:  
  `postgres(ql)?://user:password@host:port/database?optional`
- Si la URL tiene caracteres especiales en la contraseña (por ejemplo `@` o `#`), hay que codificarlos (URL-encode) o el regex puede fallar y `this.pool` quedará `null`.
- En Vercel, comprobar que la variable `DATABASE_URL` esté definida y sea una cadena de conexión válida para el proveedor (p. ej. Neon, Supabase, Railway).

### Dependencias de la galería

- **Home:** `GET /api/gemspots` sin `source=gallery` ni referer de `/gallery` → `getFeaturedProducts()` y, si devuelve vacío, `getAvailableProducts()`.
- **Galería:** misma ruta con referer que incluya `/gallery` o `?source=gallery` → `getAvailableProducts()`.
- Si la DB no está (pool null o error de conexión), la API responde 500 y el front (con el manejo actual en `main.js`) puede mostrar el mensaje de error de galería en lugar de dejar la sección en blanco.

---

## Resumen

- Revertido únicamente el fix de la URL de Stripe; el resto del código (incluido el manejo de galería vacía/error) se mantiene.
- La base de datos puede "no funcionar" por: `DATABASE_URL` ausente o mal formada en Vercel, formato de URL que no cumple el regex, o el servicio Postgres no accesible (red/firewall, SSL, etc.).
- Para no dañar al tocar código: comprobar `database` y `database.pool` antes de usar la DB y no cambiar el formato esperado de `DATABASE_URL` sin actualizar el regex o la lógica de conexión.
