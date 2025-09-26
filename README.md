# GemStone NFT Manager - Complete Documentation

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Development Setup](#development-setup)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🎯 Project Overview

**GemStone NFT Manager** is a comprehensive monorepo project that manages premium crystal planters with NFT certificates. The project consists of two main applications:

1. **Main Website** (`04-main-website`) - Public-facing e-commerce site
2. **QR Generator** (`05-nft-qr-generator`) - Admin panel for NFT QR code generation

### Key Features
- 🛒 E-commerce functionality with shopping cart
- 🎨 Product gallery with filtering
- 🔐 Admin authentication system
- 📱 QR code generation for NFTs
- 💎 NFT certificate management
- 🗄️ PostgreSQL database integration
- ☁️ Vercel deployment with monorepo support

## 🏗️ Architecture

### Monorepo Structure
```
GemStoneNFTManager-PC/
├── 04-main-website/          # Main e-commerce website
├── 05-nft-qr-generator/      # QR Generator admin panel
├── vercel.json               # Vercel deployment configuration (deleted)
└── README.md                 # This documentation
```

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Authentication**: JWT + bcrypt
- **File Upload**: Multer
- **QR Generation**: qrcode library
- **Deployment**: Vercel
- **Version Control**: Git + GitHub

## 📁 Project Structure

### Main Website (`04-main-website/`)
```
04-main-website/
├── index.js                  # Main server file
├── package.json              # Dependencies and scripts
├── vercel.json               # Vercel configuration
├── database/
│   └── postgres-database.js  # Database connection and queries
├── admin-panel/
│   ├── dashboard.html        # Admin dashboard
│   ├── login.html           # Admin login page
│   ├── login.js             # Login functionality
│   └── admin-auth.js        # Authentication middleware
├── public/
│   ├── index.html           # Homepage
│   ├── gallery.html         # Product gallery
│   ├── css/                 # Stylesheets
│   ├── js/                  # JavaScript files
│   └── images/              # Static images
└── uploads/                 # File upload directory
```

### QR Generator (`05-nft-qr-generator/`)
```
05-nft-qr-generator/
├── index.js                  # Main server file
├── package.json              # Dependencies and scripts
├── vercel.json               # Vercel configuration
├── database/
│   └── postgres-database.js  # Database connection and queries
├── admin-panel/
│   ├── dashboard.html        # Admin dashboard
│   ├── login.html           # Admin login page
│   ├── login.js             # Login functionality
│   └── admin-auth.js        # Authentication middleware
├── qr-codes/                # Generated QR code images
├── code-generator/
│   └── code-generator.js    # QR code generation logic
└── assets/                  # Static assets
```

## ⚙️ Configuration

### Vercel Configuration

#### Main Website (`04-main-website/vercel.json`)
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

#### QR Generator (`05-nft-qr-generator/vercel.json`)
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

### Vercel Project Settings

#### Main Website Project
- **Project Name**: `gem-stone-nft-manager-pc`
- **Root Directory**: `04-main-website`
- **Framework Preset**: `Express`
- **Build Command**: `None` (auto-detected)
- **Output Directory**: `N/A` (auto-detected)
- **Install Command**: `npm install`

#### QR Generator Project
- **Project Name**: `qr-generator`
- **Root Directory**: `05-nft-qr-generator`
- **Framework Preset**: `Express`
- **Build Command**: `None` (auto-detected)
- **Output Directory**: `N/A` (auto-detected)
- **Install Command**: `npm install`

## 🚀 Deployment

### Vercel Deployment Process

1. **Automatic Deployments**: Triggered by Git pushes to main branch
2. **Dual Deployment**: Each push creates 2 deployments (one per project)
3. **Build Process**: 
   - Installs dependencies with `npm install`
   - Builds Node.js server functions
   - Serves static files
4. **Deployment URLs**:
   - Main Website: `gem-stone-nft-manager-pc-*.vercel.app`
   - QR Generator: `qr-generator-*.vercel.app`

### Deployment Limits
- **Free Plan**: 100 deployments per day
- **Reset**: Every 24 hours
- **Manual Redeploy**: Available when within limits

### Troubleshooting Deployments
- **Build Failed**: Check Root Directory configuration
- **No New Deployments**: Verify GitHub webhooks
- **Limit Reached**: Wait 2 hours or upgrade to Pro

## 📚 API Documentation

### Main Website API (`04-main-website`)

#### Products
- `GET /api/gemspots` - Get featured products
- `GET /api/gemspots?source=gallery` - Get all available products
- `GET /api/gemspots/:id` - Get specific product details

#### Admin
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/products` - Get all products (admin)
- `POST /api/admin/products` - Create new product
- `PUT /api/admin/products/:id` - Update product
- `PUT /api/admin/products/:id/mark-sold` - Mark product as sold
- `DELETE /api/admin/products/:id` - Delete product

### QR Generator API (`05-nft-qr-generator`)

#### Products
- `GET /api/admin/products` - Get all products
- `POST /api/admin/products` - Create new product
- `PUT /api/admin/products/:productId` - Update product
- `PUT /api/admin/products/:productId/mark-sold` - Mark product as sold
- `DELETE /api/admin/products/:productId` - Delete product

#### QR Codes
- `GET /qr/:productId` - Generate QR code for product
- `GET /qr-codes/:filename` - Serve QR code image

#### Admin
- `POST /api/admin/login` - Admin authentication

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
    status VARCHAR(20) DEFAULT 'available', -- available, sold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Admin Table
```sql
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
```sql
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_rarity ON products(rarity);
CREATE INDEX idx_products_created_at ON products(created_at);
```

## 🔐 Environment Variables

### Required Variables (Both Projects)
```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Admin Authentication
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD_HASH=your_bcrypt_hash
JWT_SECRET=your_jwt_secret_key

# Environment
NODE_ENV=production
```

### Database URL Format
```
postgresql://username:password@host:port/database?sslmode=require
```

### Generating Password Hash
```bash
# In QR Generator project
node generate-password-hash.js
```

## 🛠️ Development Setup

### Prerequisites
- Node.js >= 16.0.0
- PostgreSQL database
- Git
- Vercel CLI (optional)

### Local Development

1. **Clone Repository**
```bash
git clone https://github.com/Alexcat84/GemStoneNFTManager-PC.git
cd GemStoneNFTManager-PC
```

2. **Setup Main Website**
```bash
cd 04-main-website
npm install
# Set environment variables
npm start
```

3. **Setup QR Generator**
```bash
cd 05-nft-qr-generator
npm install
# Set environment variables
npm start
```

4. **Database Setup**
```bash
# Create database
createdb gemstone_nft_manager

# Run database initialization
# (Tables are created automatically on first run)
```

### Environment Variables Setup
```bash
# Create .env files for local development
echo "DATABASE_URL=postgresql://localhost:5432/gemstone_nft_manager" > .env
echo "ADMIN_USERNAME=admin" >> .env
echo "ADMIN_PASSWORD_HASH=your_hash_here" >> .env
echo "JWT_SECRET=your_secret_here" >> .env
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Vercel Deployment Issues
**Problem**: Deployments not triggering
**Solution**: 
- Check GitHub webhooks
- Verify Vercel project settings
- Ensure Root Directory is correct

#### 2. Database Connection Issues
**Problem**: Connection timeout or SSL errors
**Solution**:
- Verify DATABASE_URL format
- Check SSL mode requirements
- Increase connection timeouts

#### 3. Authentication Issues
**Problem**: Admin login not working
**Solution**:
- Verify password hash generation
- Check JWT_SECRET configuration
- Ensure admin user exists in database

#### 4. File Upload Issues
**Problem**: Images not uploading
**Solution**:
- Check multer configuration
- Verify upload directory permissions
- Ensure file size limits

#### 5. QR Code Generation Issues
**Problem**: QR codes not generating
**Solution**:
- Check qrcode library installation
- Verify file system permissions
- Ensure proper URL encoding

### Debug Commands
```bash
# Check database connection
node database-check.js

# Generate new password hash
node generate-password-hash.js

# Test server locally
npm start

# Check Vercel deployment logs
vercel logs
```

### Log Locations
- **Vercel**: Dashboard → Deployments → Build Logs
- **Local**: Console output
- **Database**: PostgreSQL logs

## 📝 Recent Changes & Fixes

### Latest Updates (Commit: 8839857)
1. **Filter Buttons Removed**: Eliminated "All Available" and "Featured Only" buttons from gallery
2. **Navigation Fixed**: Home, Gallery, About, Contact links working properly
3. **Mark as Sold Feature**: Implemented in both projects
4. **Vercel Configuration**: Restored working vercel.json files
5. **Database Stability**: Improved connection handling and error recovery

### Previous Fixes
- Image/NFT data persistence in admin panels
- Database schema compatibility
- Connection timeout issues
- CSP (Content Security Policy) violations
- Authentication system improvements

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes
3. Test locally
4. Commit with descriptive message
5. Push to GitHub
6. Monitor Vercel deployments

### Code Standards
- Use consistent indentation (2 spaces)
- Comment complex logic
- Follow existing naming conventions
- Test all API endpoints
- Verify database operations

### Commit Message Format
```
type: description

- Feature: New functionality
- Fix: Bug fixes
- Update: Improvements to existing features
- Config: Configuration changes
- Docs: Documentation updates
```

## 📞 Support

### Resources
- **GitHub Repository**: https://github.com/Alexcat84/GemStoneNFTManager-PC
- **Vercel Dashboard**: https://vercel.com/dashboard
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/

### Contact
For issues or questions, please create a GitHub issue or contact the development team.

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅
