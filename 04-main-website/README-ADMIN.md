# GemSpots Main Website - Admin Panel

## 🚀 Features

### Admin Panel Features:
- **Product Management**: Add, edit, delete GemSpot products
- **Image Upload**: Upload product images with automatic resizing
- **Product Details**: Manage crystal type, rarity, dimensions, price, etc.
- **QR Code Integration**: Link products to QR codes from the QR generator
- **NFT Integration**: Connect products to NFT URLs
- **Status Management**: Track product availability (available, sold, pending)
- **Authentication**: Secure admin login with JWT tokens

### Product Fields:
- **Basic Info**: Name, description, price
- **Physical**: Dimensions, weight, crystal type, rarity
- **Digital**: QR code URL, NFT URL
- **Status**: Available, sold, pending
- **Media**: Product image upload
- **Inventory**: Stock quantity, featured status

## 🔧 Setup Instructions

### 1. Environment Variables (Vercel)
Add these to your Vercel project settings:

```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_jwt_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$KtGWhWtpuuskGKVkj9Lq6eJEVKcNLtCop11ofxZSi.3PVyHnv3i4u
```

### 2. Database Setup
The system will automatically create the required tables:
- `products` - Product information
- `admin_users` - Admin authentication

### 3. Default Admin Credentials
- **Username**: `admin`
- **Password**: `GemSpots2025!@#`

## 📱 Access Points

### Public Website:
- **Main Site**: `https://your-domain.vercel.app/`
- **Gallery**: `https://your-domain.vercel.app/gallery`

### Admin Panel:
- **Login**: `https://your-domain.vercel.app/admin/login`
- **Dashboard**: `https://your-domain.vercel.app/admin/dashboard`

## 🔗 Integration with QR Generator

### Connecting Products to QR Codes:
1. Generate QR codes in the QR Generator (`05-nft-qr-generator`)
2. Copy the QR URL (e.g., `http://192.168.18.19:3000/qr/1757970120318`)
3. Add this URL to the product's "QR Code" field in the admin panel
4. The product will now redirect to the QR code when accessed

### NFT Integration:
1. Create NFTs on OpenSea or your preferred platform
2. Copy the NFT URL
3. Add this URL to the product's "NFT URL" field
4. Customers can access the NFT through the product page

## 🎨 Product Categories

### Suggested Categories:
- **Premium**: High-quality crystals with standard features
- **Luxury**: Rare crystals with exceptional properties
- **Collector**: Limited edition or unique pieces
- **Beginner**: Entry-level crystals for new collectors

### Crystal Types:
- Amethyst, Rose Quartz, Citrine, Smoky Quartz
- Clear Quartz, Black Tourmaline, Selenite
- Labradorite, Moonstone, Tiger's Eye
- And many more...

### Rarity Levels:
- **Common**: Easily available crystals
- **Uncommon**: Moderately rare
- **Rare**: Hard to find
- **Very Rare**: Extremely limited
- **Legendary**: One-of-a-kind pieces

## 🔒 Security Features

- **JWT Authentication**: Secure token-based login
- **Password Hashing**: Bcrypt encryption for passwords
- **Session Management**: Automatic session timeout
- **File Upload Security**: Image type validation and size limits
- **Rate Limiting**: Protection against abuse

## 📊 Admin Dashboard Features

### Statistics:
- Total products count
- Available products
- Sold products
- Pending products

### Product Management:
- Visual product cards with images
- Quick edit/delete actions
- Status indicators
- Search and filter capabilities

## 🚀 Deployment

### Local Development:
```bash
npm install
npm start
```

### Vercel Deployment:
1. Connect your GitHub repository to Vercel
2. Add environment variables
3. Deploy automatically on push

## 🔄 Workflow Integration

### Complete GemSpot Creation Process:
1. **Create Product** in Admin Panel
2. **Generate QR Code** in QR Generator
3. **Link QR Code** to Product
4. **Create NFT** (optional)
5. **Link NFT** to Product
6. **Publish Product** to website

### Customer Journey:
1. **Browse** products on main website
2. **Scan QR Code** on physical GemSpot
3. **View Product** details and NFT
4. **Purchase** or learn more about the crystal

## 🛠️ Technical Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT, Bcrypt
- **File Upload**: Multer
- **Frontend**: HTML5, CSS3, JavaScript
- **Deployment**: Vercel
- **Storage**: Vercel Postgres

## 📞 Support

For technical support or questions about the admin panel, refer to the main project documentation or contact the development team.
