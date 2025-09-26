# Development Guide - GemStone NFT Manager

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- PostgreSQL database
- Git
- Vercel CLI (optional)

### Setup
```bash
# Clone repository
git clone https://github.com/Alexcat84/GemStoneNFTManager-PC.git
cd GemStoneNFTManager-PC

# Setup Main Website
cd 04-main-website
npm install
cp .env.example .env
# Edit .env with your database credentials
npm start

# Setup QR Generator (in new terminal)
cd ../05-nft-qr-generator
npm install
cp .env.example .env
# Edit .env with your database credentials
npm start
```

## 🔧 Development Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Test locally
npm test

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push to GitHub
git push origin feature/new-feature
```

### 2. Testing
```bash
# Test Main Website
cd 04-main-website
npm start
# Visit http://localhost:3000

# Test QR Generator
cd ../05-nft-qr-generator
npm start
# Visit http://localhost:3001
```

### 3. Deployment
```bash
# Merge to main branch
git checkout main
git merge feature/new-feature
git push origin main

# Monitor Vercel deployments
# Check: https://vercel.com/dashboard
```

## 🗄️ Database Development

### Local Database Setup
```bash
# Create database
createdb gemstone_nft_manager

# Set environment variables
export DATABASE_URL="postgresql://localhost:5432/gemstone_nft_manager"
```

### Database Schema
```sql
-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    crystal_type VARCHAR(100),
    rarity VARCHAR(50),
    image_urls TEXT[],
    nft_image_url VARCHAR(500),
    nft_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_rarity ON products(rarity);
CREATE INDEX idx_products_created_at ON products(created_at);
```

### Database Operations
```javascript
// Example: Create product
const product = await database.createProduct({
  name: 'Test Product',
  description: 'Test description',
  price: 99.99,
  crystal_type: 'Quartz',
  rarity: 'COMMON',
  image_urls: ['image1.jpg'],
  nft_image_url: 'nft.jpg',
  nft_url: 'https://opensea.io/...'
});

// Example: Update product status
await database.updateProductStatus(product.id, 'sold');
```

## 🔐 Authentication Development

### Admin User Setup
```bash
# Generate password hash
cd 05-nft-qr-generator
node generate-password-hash.js

# Use the generated hash in your .env file
ADMIN_PASSWORD_HASH=your_generated_hash_here
```

### JWT Token Testing
```javascript
// Test JWT token generation
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
console.log('Token:', token);

// Test token verification
const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log('Decoded:', decoded);
```

## 🎨 Frontend Development

### CSS Development
```css
/* Main Website Styles */
/* File: 04-main-website/public/css/main.css */

/* Gallery Styles */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem 0;
}

/* Product Card Styles */
.product-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: transform 0.3s ease;
}

.product-card:hover {
  transform: translateY(-4px);
}
```

### JavaScript Development
```javascript
// Main Website JavaScript
// File: 04-main-website/public/js/main.js

// Gallery loading
async function loadGallery() {
  try {
    const response = await fetch('/api/gemspots?source=gallery');
    const data = await response.json();
    
    if (data.success) {
      displayProducts(data.products);
    }
  } catch (error) {
    console.error('Error loading gallery:', error);
  }
}

// Product modal
function showProductModal(product) {
  const modal = document.createElement('div');
  modal.className = 'product-modal-overlay';
  modal.innerHTML = `
    <div class="product-modal">
      <h2>${product.name}</h2>
      <p>$${product.price} CAD</p>
      <p>${product.description}</p>
    </div>
  `;
  document.body.appendChild(modal);
}
```

## 📱 QR Code Development

### QR Code Generation
```javascript
// QR Generator
// File: 05-nft-qr-generator/code-generator/code-generator.js

const QRCode = require('qrcode');

async function generateQRCode(productId) {
  const qrUrl = `https://your-domain.com/qr/${productId}`;
  const qrCodeDataURL = await QRCode.toDataURL(qrUrl);
  
  // Save to file
  const filename = `qr-${Date.now()}.png`;
  const filepath = path.join(__dirname, '../qr-codes', filename);
  
  await QRCode.toFile(filepath, qrUrl);
  
  return { filename, filepath, dataURL: qrCodeDataURL };
}
```

### QR Code Testing
```bash
# Test QR code generation
node -e "
const QRCode = require('qrcode');
QRCode.toDataURL('https://example.com')
  .then(url => console.log('QR Code:', url))
  .catch(err => console.error(err));
"
```

## 🚀 Deployment Development

### Vercel Configuration
```json
// vercel.json for each project
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/index.js"
    }
  ]
}
```

### Environment Variables
```bash
# .env file for local development
DATABASE_URL=postgresql://localhost:5432/gemstone_nft_manager
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=your_bcrypt_hash
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

### Vercel CLI Development
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## 🧪 Testing

### API Testing
```bash
# Test Main Website API
curl http://localhost:3000/api/gemspots
curl http://localhost:3000/api/gemspots?source=gallery

# Test QR Generator API
curl http://localhost:3001/api/admin/products
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

### Database Testing
```bash
# Test database connection
node database-check.js

# Test product creation
node -e "
const db = require('./database/postgres-database');
const product = await db.createProduct({
  name: 'Test Product',
  price: 99.99,
  description: 'Test'
});
console.log('Created:', product);
"
```

### Frontend Testing
```bash
# Test gallery loading
# Open browser console and run:
loadGallery();

# Test product modal
showProductModal({
  name: 'Test Product',
  price: 99.99,
  description: 'Test description'
});
```

## 🐛 Debugging

### Common Debug Techniques
```javascript
// Database debugging
console.log('🔍 Database query:', query);
console.log('🔍 Query result:', result);

// API debugging
console.log('🔍 Request body:', req.body);
console.log('🔍 Response data:', data);

// Frontend debugging
console.log('🔍 Product data:', product);
console.log('🔍 API response:', response);
```

### Error Handling
```javascript
// Database error handling
try {
  const result = await database.query(query, params);
  return result;
} catch (error) {
  console.error('Database error:', error);
  throw new Error('Database operation failed');
}

// API error handling
app.use((error, req, res, next) => {
  console.error('API error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});
```

## 📊 Performance Monitoring

### Database Performance
```javascript
// Connection pooling monitoring
console.log('🔍 Pool stats:', pool.totalCount, pool.idleCount, pool.waitingCount);

// Query performance
const start = Date.now();
const result = await database.query(query);
const duration = Date.now() - start;
console.log(`🔍 Query took ${duration}ms`);
```

### Frontend Performance
```javascript
// Image loading performance
const img = new Image();
img.onload = () => {
  console.log('🔍 Image loaded in:', Date.now() - start, 'ms');
};
img.src = imageUrl;
```

## 🔄 Git Workflow

### Branch Strategy
```bash
# Main branch
main

# Feature branches
feature/add-product-filter
feature/improve-qr-generation
feature/fix-authentication

# Bug fix branches
fix/gallery-loading-issue
fix/database-connection-timeout
```

### Commit Messages
```bash
# Feature commits
git commit -m "feat: add product filtering to gallery"
git commit -m "feat: implement QR code regeneration"

# Bug fix commits
git commit -m "fix: resolve gallery loading issue"
git commit -m "fix: improve database connection stability"

# Configuration commits
git commit -m "config: update Vercel deployment settings"
git commit -m "config: add environment variables"

# Documentation commits
git commit -m "docs: update API documentation"
git commit -m "docs: add development setup guide"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database status
pg_ctl status

# Test connection
psql -d gemstone_nft_manager -c "SELECT 1;"

# Check environment variables
echo $DATABASE_URL
```

#### 2. Port Conflicts
```bash
# Check port usage
lsof -i :3000
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

#### 3. File Permission Issues
```bash
# Fix upload directory permissions
chmod 755 uploads/
chmod 755 qr-codes/

# Fix file ownership
chown -R $USER:$USER uploads/
chown -R $USER:$USER qr-codes/
```

#### 4. Vercel Deployment Issues
```bash
# Check Vercel logs
vercel logs

# Test local build
vercel build

# Check environment variables
vercel env ls
```

## 📚 Resources

### Documentation
- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vercel Documentation](https://vercel.com/docs)
- [JWT Documentation](https://jwt.io/)

### Tools
- [Postman](https://www.postman.com/) - API testing
- [pgAdmin](https://www.pgadmin.org/) - Database management
- [Vercel CLI](https://vercel.com/cli) - Deployment tool

### Community
- [GitHub Issues](https://github.com/Alexcat84/GemStoneNFTManager-PC/issues)
- [Stack Overflow](https://stackoverflow.com/)
- [Node.js Community](https://nodejs.org/en/community/)

---

**Happy Coding!** 🚀
