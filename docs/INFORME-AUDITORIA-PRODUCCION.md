# Informe de auditoría — Producción (GemStone NFT Manager)

**Versión:** 1.0  
**Alcance:** `04-main-website` (sitio + admin + Stripe + reportes + QR/códigos)  
**Enfoque:** Evaluación sin reescritura; remediación incremental.

---

## 1. Resumen ejecutivo

| Categoría | Hallazgos críticos | Hallazgos altos | Estado tras remediación |
|-----------|-------------------|-----------------|-------------------------|
| Seguridad API | 2 rutas admin sin auth | JWT por defecto, logs sensibles | Ver §6 |
| Pagos (Stripe) | — | Webhook correcto con firma | Sin cambio estructural |
| Operaciones | Migraciones HTTP | CORS abierto, body 50MB | Ver §6 |
| Observabilidad | Logs con datos sensibles | — | Reducido en prod |

---

## 2. Hallazgos detallados (pre-remediación)

### Crítico

| ID | Hallazgo | Riesgo |
|----|-----------|--------|
| C1 | `POST /api/admin/fix-password` sin autenticación, fija hash conocido | Toma de control admin |
| C2 | `POST /api/admin/migrate-database` sin autenticación | Alteración de esquema DB |

### Alto

| ID | Hallazgo | Riesgo |
|----|-----------|--------|
| A1 | `JWT_SECRET` con fallback en código si falta env | Tokens falsificables si se conoce default |
| A2 | Log de contraseña en claro y hash en `admin-auth.js` | Fuga en logs (Vercel, etc.) |
| A3 | `check-password.js` con contraseña y hash en repo | Fuga por git |
| A4 | `GET /api/admin/diagnostic` sin auth, datos de admin | Reconocimiento / fuga |

### Medio

| ID | Hallazgo | Riesgo |
|----|-----------|--------|
| M1 | `cors()` sin `origin` restringido | Abuso cross-origin con token robado |
| M2 | `express.json` 50MB | DoS / memoria |
| M3 | Rate limit global 1000/15min; login sin límite específico | Fuerza bruta login |
| M4 | Logs de `DATABASE_URL` parcial en consola | Fuga parcial de credenciales |
| M5 | Respuesta de `fix-password` incluía fila de usuario (hash) | Fuga en respuesta HTTP |

### Bajo / seguimiento

| ID | Hallazgo |
|----|-----------|
| B1 | Helmet con CSP desactivada — endurecer en fase 2 |
| B2 | Uploads en `/tmp` en Vercel — evaluar almacenamiento objeto en fase 2 |
| B3 | Duplicación 05/06 vs 04 — documentar fuente de verdad |

---

## 3. Cambios implementados (aprobación / trazabilidad)

Los siguientes ítems se aplican en código en el mismo commit que añade este informe:

1. **C1 / C2:** Rutas `fix-password` y `migrate-database` solo activas si `ENABLE_DANGEROUS_ADMIN_DB_ROUTES=true` **y** header `X-Maintenance-Secret` coincide con `MAINTENANCE_SECRET` (mín. 16 caracteres). Por defecto en producción: **403/503** si mal configurado; sin env de enable → **404**.
2. **A1:** En `production` o `VERCEL`, si falta `JWT_SECRET`, la app **falla al iniciar** (`AdminAuth`).
3. **A2:** Eliminados logs de contraseña y de hash almacenado; log de usuario sin datos sensibles.
4. **A3:** `check-password.js` solo usa variables de entorno (`ADMIN_PASSWORD_TEST`, `ADMIN_HASH_TEST`); sin secretos en archivo.
5. **A4:** `GET /api/admin/diagnostic` protegido con `requireAuth`.
6. **M1:** CORS restringible con `CORS_ORIGIN` (lista separada por comas); si no está definido, comportamiento anterior (`true`).
7. **M2:** Límite de body JSON/urlencoded **2MB** (subidas siguen por Multer).
8. **M3:** Rate limit dedicado en `POST /api/admin/login` (20 intentos / 15 min por IP, `trustProxy`).
9. **M4:** En prod/Vercel, logs de DB sin volcar prefijo de URL con credenciales.
10. **M5:** Respuesta de `fix-password` sin objeto usuario con hash.
11. **A4 (extra):** Respuestas de error de `diagnostic` sin `stack` en `NODE_ENV=production`.

---

## 4. Variables de entorno — checklist producción

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | PostgreSQL |
| `JWT_SECRET` | Sí (prod/Vercel) | Secreto fuerte, aleatorio |
| `STRIPE_SECRET_KEY` | Si hay pagos | Modo live según entorno |
| `STRIPE_WEBHOOK_SECRET` | Sí (webhook) | Del dashboard Stripe |
| `BASE_URL` | Recomendada | URL pública del sitio |
| `CORS_ORIGIN` | Recomendada | Ej: `https://tudominio.com` |
| `ENABLE_DANGEROUS_ADMIN_DB_ROUTES` | No | Solo emergencia; `true` para habilitar rutas de mantenimiento |
| `MAINTENANCE_SECRET` | Si enable arriba | Secreto largo; enviar como header `X-Maintenance-Secret` |

---

## 5. Aprobación

- [ ] He leído el informe y los cambios de la §3.
- [ ] Variables de entorno en Vercel/ hosting actualizadas según §4.
- [ ] Entiendo que las rutas de mantenimiento quedan **desactivadas** salvo configuración explícita.

**Aprobado por:** _________________  **Fecha:** _________________

---

## 6. Pendientes recomendados (fase 2 — no incluidos en este commit)

- CSP con Helmet (probar en staging para no romper CDNs).
- Almacenamiento persistente de imágenes (S3/R2/Blob) si se requiere fuera de `/tmp`.
- Tests automatizados mínimos (login, webhook mock, mark-sold).
- Rotación de credenciales si algún secreto estuvo en git histórico.

---

*Documento generado para trazabilidad de auditoría y remediación.*
