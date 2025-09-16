# GemStone NFT QR Generator

Generador de códigos QR para NFTs de GemStone con panel de administración.

## 🚀 Características

- **Generación de Códigos NFT**: Crea códigos únicos para cada NFT con algoritmo de checksum
- **Códigos QR Duales**: Genera QR público (para verificación) y privado (para transferencia)
- **Panel de Administración**: Interfaz web segura para administradores
- **Base de Datos SQLite**: Almacenamiento local de NFTs y códigos QR
- **Autenticación JWT**: Sistema de login seguro para administradores
- **API REST**: Endpoints para integración con otros sistemas

## 📁 Estructura del Proyecto

```
05-nft-qr-generator/
├── admin-panel/           # Panel de administración web
│   ├── login.html         # Página de login
│   ├── dashboard.html     # Dashboard principal
│   └── admin-auth.js      # Sistema de autenticación
├── database/              # Base de datos
│   └── nft-database.js    # Gestión de base de datos SQLite
├── qr-generator/          # Generador de códigos QR
│   └── qr-generator.js    # Lógica de generación de QR
├── src/                   # Código fuente
│   └── utils/
│       └── code-generator.js  # Generador de códigos NFT
├── assets/                # Archivos estáticos
│   └── qr-codes/          # Códigos QR generados
├── index.js               # Servidor principal
└── package.json           # Dependencias del proyecto
```

## 🛠️ Instalación

1. **Clonar el repositorio**:
   ```bash
   git clone <repository-url>
   cd 05-nft-qr-generator
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor**:
   ```bash
   npm start
   ```

4. **Acceder al panel de administración**:
   - Abrir navegador en: `http://localhost:3000`
   - Usuario: `admin`
   - Contraseña: `password`

## 🔧 Uso

### Crear un NFT

1. **Acceder al dashboard** después del login
2. **Completar el formulario**:
   - URL de OpenSea del NFT
   - Nombres de gemstones (separados por comas)
   - Ubicación (país, región)
   - Mes y año de creación
   - Notas opcionales
3. **Hacer clic en "Crear NFT y Generar QR"**

### Códigos QR Generados

- **QR Público**: Para verificación pública del NFT
- **QR Privado**: Para transferencia privada (una sola vez)

### API Endpoints

- `POST /api/login` - Autenticación de administrador
- `POST /api/nft/create` - Crear nuevo NFT
- `GET /api/nfts` - Listar todos los NFTs
- `GET /api/qr/:type/:nftId` - Obtener código QR
- `GET /api/stats` - Estadísticas del sistema
- `GET /api/locations` - Listar ubicaciones disponibles

## 🔐 Seguridad

- **Autenticación JWT**: Tokens seguros con expiración
- **Sesiones**: Gestión de sesiones activas
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **Helmet**: Headers de seguridad HTTP
- **CORS**: Configuración de políticas de origen cruzado

## 📊 Base de Datos

### Tablas

- **nfts**: Información de NFTs creados
- **qr_codes**: Códigos QR generados
- **locations**: Ubicaciones disponibles

### Esquema NFT

```sql
CREATE TABLE nfts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opensea_url VARCHAR(500) NOT NULL,
    nft_code VARCHAR(50) UNIQUE NOT NULL,
    gemstone_names TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    piece_number INTEGER NOT NULL,
    checksum VARCHAR(10) NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🎨 Formato de Código NFT

Los códigos siguen el formato: `GM-YYMM-GEM-XXX-CHECKSUM`

- **GM**: Prefijo GemStone
- **YYMM**: Año y mes (ej: 2409 para septiembre 2024)
- **GEM**: Código de 3 letras del gemstone (ej: AME para Amethyst)
- **XXX**: Número de pieza (001, 002, etc.)
- **CHECKSUM**: Código de verificación de 4 caracteres

## 🔄 Flujo de Trabajo

1. **Administrador** inicia sesión
2. **Crea NFT** con información de OpenSea
3. **Sistema genera** código único y códigos QR
4. **QR Público** se embebe en la maceta para verificación
5. **QR Privado** se entrega al comprador para transferencia

## 🚀 Despliegue

### Desarrollo
```bash
npm run dev  # Con nodemon para auto-reload
```

### Producción
```bash
npm start
```

### Variables de Entorno
- `PORT`: Puerto del servidor (default: 3000)
- `JWT_SECRET`: Clave secreta para JWT

## 📝 Notas Técnicas

- **Node.js**: Versión 16+ requerida
- **SQLite3**: Base de datos local
- **QRCode**: Generación de códigos QR
- **Express**: Framework web
- **JWT**: Autenticación de tokens

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo LICENSE para detalles.

## 🆘 Soporte

Para soporte técnico o preguntas:
- Crear issue en GitHub
- Contactar al equipo de desarrollo

---

**GemStone NFT Manager** - Sistema profesional de gestión de NFTs con códigos QR
