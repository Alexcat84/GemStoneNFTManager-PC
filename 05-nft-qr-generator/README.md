# QR Generator - GemStone NFT Manager

## 🎯 Overview
The QR Generator is an admin panel for creating and managing NFT QR codes for GemStone products. It provides a secure interface for product management and QR code generation.

## 🚀 Features
- **Admin Authentication**: Secure login with JWT tokens
- **Product Management**: CRUD operations for products
- **QR Code Generation**: Automatic QR code creation for NFTs
- **Image Upload**: Multiple image support with validation
- **NFT Integration**: OpenSea marketplace links
- **Status Management**: Track product availability
- **Database Integration**: PostgreSQL with connection pooling

## 📁 Project Structure
```
05-nft-qr-generator/
├── index.js                  # Express server
├── package.json              # Dependencies
├── vercel.json               # Vercel configuration
├── database/
│   └── postgres-database.js  # Database operations
├── admin-panel/
│   ├── dashboard.html        # Admin interface
│   ├── login.html           # Login page
│   ├── login.js             # Login logic
│   └── admin-auth.js        # Auth middleware
├── code-generator/
│   └── code-generator.js    # QR generation logic
├── qr-codes/                # Generated QR images
├── assets/                  # Static assets
└── src/
    └── utils/
        └── code-generator.js # Utility functions
```

## 🔧 API Endpoints

### Authentication
- `GET /` - Login page
- `POST /api/admin/login` - Admin authentication
- `GET /dashboard` - Admin dashboard (protected)

### Product Management
- `GET /api/admin/products` - Get all products
- `POST /api/admin/products` - Create new product
- `PUT /api/admin/products/:productId` - Update product
- `PUT /api/admin/products/:productId/mark-sold` - Mark as sold
- `DELETE /api/admin/products/:productId` - Delete product

### QR Code Generation
- `GET /qr/:productId` - Generate QR code for product
- `GET /qr-codes/:filename` - Serve QR code image

## 🗄️ Database Schema

### Products Table
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    crystal_type VARCHAR(100),
    rarity VARCHAR(50),
    image_urls TEXT[], -- Array of image URLs
    nft_image_url VARCHAR(500), -- NFT certificate image
    nft_url VARCHAR(500), -- NFT marketplace URL
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Admin Users Table
```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 Authentication System

### Login Process
1. **Username/Password**: Admin credentials
2. **Password Verification**: bcrypt hash comparison
3. **JWT Generation**: Secure token creation
4. **Session Management**: Token-based authentication

### Security Features
- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure session management
- **Rate Limiting**: Prevent brute force attacks
- **Input Validation**: Sanitize user inputs
- **CORS Protection**: Cross-origin request security

## 📱 QR Code Generation

### QR Code Features
- **Unique URLs**: Each product gets unique QR code
- **NFT Integration**: Links to OpenSea marketplace
- **Image Storage**: PNG format with timestamp
- **Automatic Generation**: Created on product creation
- **Regeneration**: Update QR codes when needed

### QR Code Structure
```
https://your-domain.com/qr/{productId}
```

### File Naming Convention
```
qr-{timestamp}.png
```

## 🎨 Admin Interface

### Dashboard Features
- **Product List**: View all products with status
- **Add Product**: Create new products with images
- **Edit Product**: Update existing products
- **Delete Product**: Remove products
- **Mark as Sold**: Change product status
- **Image Management**: Upload and manage images

### Form Validation
- **Required Fields**: Name, price, description
- **Image Validation**: File type and size limits
- **URL Validation**: NFT marketplace links
- **Price Validation**: Numeric values only

## 🚀 Deployment

### Vercel Configuration
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    },
    {
      "src": "admin-panel/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/index.js"
    },
    {
      "src": "/",
      "dest": "/index.js"
    },
    {
      "src": "/dashboard",
      "dest": "/index.js"
    },
    {
      "src": "/qr/(.*)",
      "dest": "/index.js"
    },
    {
      "src": "/qr-codes/(.*)",
      "dest": "/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/admin-panel/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Environment Variables
```bash
DATABASE_URL=postgresql://...
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...
JWT_SECRET=...
NODE_ENV=production
```

## 🛠️ Development

### Local Setup
```bash
cd 05-nft-qr-generator
npm install
npm start
```

### Dependencies
```json
{
  "express": "^4.18.2",
  "sqlite3": "^5.1.6",
  "qrcode": "^1.5.3",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "cors": "^2.8.5",
  "helmet": "^7.1.0",
  "express-rate-limit": "^7.1.5",
  "pg": "^8.11.3",
  "multer": "^1.4.5-lts.1"
}
```

### Testing
```bash
# Test QR generation
curl http://localhost:3000/qr/1

# Test admin login
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

## 🔧 Database Operations

### Connection Management
```javascript
// Database connection with pooling
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
  min: 0,
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 300000
});
```

### Query Operations
```javascript
// Create product with QR code
const product = await database.createProduct({
  name: 'Product Name',
  description: 'Description',
  price: 100.00,
  crystal_type: 'Quartz',
  rarity: 'RARE',
  image_urls: ['image1.jpg', 'image2.jpg'],
  nft_image_url: 'nft-certificate.jpg',
  nft_url: 'https://opensea.io/...'
});

// Update product status
await database.updateProductStatus(productId, 'sold');
```

## 📊 Performance

### Optimization Features
- **Connection Pooling**: Efficient database connections
- **Image Compression**: Optimized file sizes
- **Caching**: Static asset caching
- **Rate Limiting**: Prevent abuse
- **Error Handling**: Graceful failure recovery

### Monitoring
- **Database Metrics**: Connection and query performance
- **Error Tracking**: Automatic error reporting
- **Uptime Monitoring**: Service availability
- **File System Monitoring**: QR code generation

## 🔄 Recent Updates

### Latest Changes
- ✅ Implemented "Mark as Sold" functionality
- ✅ Fixed image/NFT data persistence
- ✅ Improved database connection stability
- ✅ Enhanced error handling and logging
- ✅ Added comprehensive input validation

### Database Improvements
- ✅ Connection retry mechanism
- ✅ Increased timeout values
- ✅ Better error handling
- ✅ Schema compatibility fixes

## 🚨 Troubleshooting

### Common Issues

#### 1. QR Code Generation Fails
**Problem**: QR codes not generating
**Solution**: 
- Check file system permissions
- Verify qrcode library installation
- Ensure proper URL encoding

#### 2. Database Connection Issues
**Problem**: Connection timeouts
**Solution**:
- Verify DATABASE_URL format
- Check SSL configuration
- Increase timeout values

#### 3. Image Upload Problems
**Problem**: Images not uploading
**Solution**:
- Check multer configuration
- Verify file size limits
- Ensure proper MIME types

#### 4. Authentication Issues
**Problem**: Login not working
**Solution**:
- Verify password hash
- Check JWT_SECRET
- Ensure admin user exists

### Debug Commands
```bash
# Test database connection
node database-check.js

# Generate password hash
node generate-password-hash.js

# Check QR code generation
node -e "const qr = require('qrcode'); qr.toDataURL('test').then(console.log)"
```

## 📝 API Examples

### Create Product
```javascript
const productData = {
  name: 'Crystal Planter',
  description: 'Beautiful crystal planter with NFT',
  price: 150.00,
  crystal_type: 'Amethyst',
  rarity: 'RARE',
  images: [file1, file2],
  nft_image: nftFile,
  nft_url: 'https://opensea.io/collection/...'
};

const response = await fetch('/api/admin/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(productData)
});
```

### Generate QR Code
```javascript
// QR code is automatically generated on product creation
// Access via: /qr/{productId}
const qrUrl = `https://your-domain.com/qr/${productId}`;
```

---

**Maintained by**: GemStone NFT Manager Team  
**Last Updated**: January 2025