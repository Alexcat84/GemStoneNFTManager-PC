# Main Website - GemStone NFT Manager

## 🎯 Overview
The main e-commerce website for GemStone NFT Manager, featuring a public product gallery, shopping cart functionality, and admin panel for product management.

## 🔒 Production & security
**Required on Vercel / production:** `JWT_SECRET` (strong random), `DATABASE_URL`, Stripe keys as needed.  
**Optional:** `CORS_ORIGIN` (comma-separated allowed origins).  
**Emergency DB routes** (`/api/admin/fix-password`, `/api/admin/migrate-database`): only registered when `ENABLE_DANGEROUS_ADMIN_DB_ROUTES=true` **and** requests include header `X-Maintenance-Secret` matching `MAINTENANCE_SECRET` (≥16 chars).

## 🚀 Features
- **Public Gallery**: Display premium crystal planters with NFT certificates
- **Shopping Cart**: Add products to cart with persistent storage
- **Product Details**: Modal view with images, specifications, and NFT information
- **Admin Panel**: Secure authentication and product management
- **Responsive Design**: Mobile-friendly interface
- **SEO Optimized**: Meta tags and structured data

## 📁 Project Structure
```
04-main-website/
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
├── public/
│   ├── index.html           # Homepage
│   ├── gallery.html         # Product gallery
│   ├── css/                 # Stylesheets
│   │   ├── main.css         # Main styles
│   │   ├── animations.css   # CSS animations
│   │   ├── cart.css         # Cart styles
│   │   └── shipping.css     # Shipping styles
│   ├── js/                  # JavaScript
│   │   ├── main.js          # Main functionality
│   │   ├── cart.js          # Cart operations
│   │   ├── cart-config.js   # Cart configuration
│   │   └── shipping.js      # Shipping calculations
│   └── images/              # Static images
└── uploads/                 # File uploads
```

## 🔧 API Endpoints

### Public Endpoints
- `GET /` - Homepage
- `GET /gallery` - Product gallery
- `GET /api/gemspots` - Get featured products
- `GET /api/gemspots?source=gallery` - Get all products
- `GET /api/gemspots/:id` - Get product details

### Admin Endpoints
- `GET /admin` - Admin login page
- `POST /api/admin/login` - Admin authentication
- `GET /admin/dashboard` - Admin dashboard
- `GET /api/admin/products` - Get all products (admin)
- `POST /api/admin/products` - Create product
- `PUT /api/admin/products/:id` - Update product
- `PUT /api/admin/products/:id/mark-sold` - Mark as sold
- `POST /api/admin/reset-products-to-available` - Set all products and variants to available (for testing; requires admin auth)
- `DELETE /api/admin/products/:id` - Delete product

## 🗄️ Database Operations

### Product Management
```javascript
// Get featured products
const products = await database.getFeaturedProducts();

// Get all available products
const products = await database.getAvailableProducts();

// Create new product
const product = await database.createProduct(productData);

// Update product
const updated = await database.updateProduct(id, productData);

// Mark as sold
const result = await database.updateProductStatus(id, 'sold');
```

### Admin Authentication
```javascript
// Authenticate admin
const auth = await database.authenticateAdmin(username, password);

// Generate JWT token
const token = jwt.sign({ userId: admin.id }, JWT_SECRET);
```

## 🎨 Frontend Features

### Gallery System
- **Dynamic Loading**: Products loaded via API
- **Modal Details**: Click to view product information
- **Image Gallery**: Multiple product images
- **NFT Integration**: QR codes and marketplace links
- **Responsive Grid**: Adapts to screen size

### Shopping Cart
- **Local Storage**: Persistent cart data
- **Add/Remove Items**: Dynamic cart management
- **Price Calculation**: Automatic totals
- **Shipping Options**: Multiple delivery methods

### Admin Interface
- **Secure Login**: JWT-based authentication
- **Product CRUD**: Create, read, update, delete
- **Image Upload**: Multiple image support
- **NFT Management**: Certificate and URL handling
- **Status Management**: Available/Sold tracking

## 🔐 Security Features

### Authentication
- **JWT Tokens**: Secure session management
- **Password Hashing**: bcrypt encryption
- **Session Timeout**: Automatic logout
- **CSRF Protection**: Request validation

### File Upload Security
- **File Type Validation**: Image formats only
- **Size Limits**: Prevent large uploads
- **Path Sanitization**: Secure file storage
- **Virus Scanning**: Malware protection

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
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/index.js"
    },
    {
      "src": "/(.*)",
      "dest": "/index.js"
    }
  ]
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
cd 04-main-website
npm install
npm start
```

### Testing
```bash
# Test API endpoints
curl http://localhost:3000/api/gemspots

# Test admin login
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

### Debugging
```javascript
// Enable debug logging
console.log('🔍 Debug info:', data);

// Database connection test
const db = new PostgresDatabase();
await db.testConnection();
```

## 📊 Performance

### Optimization Features
- **Image Compression**: Optimized product images
- **Lazy Loading**: Defer non-critical resources
- **Caching**: Static asset caching
- **CDN**: Global content delivery
- **Database Indexing**: Optimized queries

### Monitoring
- **Vercel Analytics**: Performance metrics
- **Error Tracking**: Automatic error reporting
- **Uptime Monitoring**: Service availability
- **Database Monitoring**: Query performance

## 🔄 Recent Updates

### Latest Changes
- ✅ Removed filter buttons from gallery
- ✅ Fixed navigation links
- ✅ Implemented "Mark as Sold" functionality
- ✅ Improved image/NFT data persistence
- ✅ Enhanced error handling

### Known Issues
- None currently reported

---

**Maintained by**: GemStone NFT Manager Team  
**Last Updated**: January 2025