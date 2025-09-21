# GemSpots - Premium Crystal Planters with NFT

A modern web application for managing and showcasing premium crystal planters with NFT integration.

## 🌟 Features

- **Premium Crystal Planters**: Handcrafted planters with authentic crystals
- **NFT Integration**: Each planter comes with a unique NFT certificate
- **QR Code System**: Smart QR codes for verification and ownership
- **Blockchain Technology**: Immutable records and public verification
- **Admin Panel**: Complete management system for products and QR codes
- **Responsive Design**: Beautiful, modern interface for all devices

## 🏗️ Project Structure

```
GemStoneNFTManager-PC/
├── 01-code-generator/          # Unique NFT code generator
├── 04-main-website/           # Main public website
├── 05-nft-qr-generator/       # QR code generator and admin panel
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gemspots.git
cd gemspots
```

2. Install dependencies for each project:
```bash
# Main website
cd 04-main-website
npm install

# QR Generator
cd ../05-nft-qr-generator
npm install
```

3. Start the servers:
```bash
# Main website (port 4000)
cd 04-main-website
npm start

# QR Generator (port 3000)
cd ../05-nft-qr-generator
npm start
```

## 🌐 Access URLs

- **Main Website**: http://localhost:4000
- **Admin Panel**: http://localhost:3000
- **API Endpoints**: http://localhost:3000/api

## 📱 Mobile Access

For mobile testing on the same network:
- **Main Website**: http://[YOUR_IP]:4000
- **Admin Panel**: http://[YOUR_IP]:3000

## 🔧 Configuration

### Environment Variables
Create a `.env` file in each project directory:

```env
# 04-main-website/.env
PORT=4000
NODE_ENV=development

# 05-nft-qr-generator/.env
PORT=3000
JWT_SECRET=your-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
```

## 🎨 Features

### Main Website
- **Hero Section**: Eye-catching introduction with crystal animations
- **About Section**: Company information with blockchain technology explanation
- **Gallery**: Dynamic product showcase with filtering
- **Contact**: Contact form and information
- **Responsive Design**: Works perfectly on all devices

### Admin Panel
- **QR Code Generation**: Create QR codes with smart redirection
- **Product Management**: Add, edit, and manage products
- **Status Management**: Track QR code status (ready, pending, custom)
- **Search & Filter**: Find products and QR codes easily
- **Export Features**: Download QR codes in HD

### QR Code System
- **Smart Redirection**: QR codes redirect based on status
- **Status Types**:
  - `ready`: Direct redirect to NFT URL
  - `pending`: Shows "NFT in process" page
  - `custom`: Redirects to custom URL
- **HD Quality**: 1024x1024 pixel QR codes
- **Database Storage**: All QR data stored in SQLite

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **QR Generation**: QRCode.js
- **Authentication**: JWT, bcryptjs
- **Security**: Helmet, CORS, Rate Limiting
- **Animations**: AOS (Animate On Scroll)

## 📊 Database Schema

### QR Codes Table
```sql
CREATE TABLE qr_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    qr_id TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'ready',
    nft_url TEXT,
    estimated_ready_date DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 Security Features

- **JWT Authentication**: Secure admin access
- **Password Hashing**: bcryptjs for password security
- **Rate Limiting**: API protection against abuse
- **CORS Configuration**: Cross-origin request security
- **Input Validation**: Server-side validation for all inputs

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Configure environment variables
3. Deploy automatically on every push

### Other Platforms
- **Netlify**: For static sites
- **Heroku**: For full-stack applications
- **DigitalOcean**: For VPS deployment

## 📝 API Endpoints

### QR Code Management
- `POST /api/qr/generate` - Generate new QR code
- `GET /api/qr/list` - Get all QR codes
- `PUT /api/qr/update/:qrId` - Update QR code details
- `GET /api/qr/details/:qrId` - Get QR code details

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout

### Smart Redirection
- `GET /qr/:qrId` - Smart QR code redirection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:
- **Email**: info@gemspots.ca
- **Phone**: +1 (613) 617-7296
- **Location**: Ottawa, Ontario, Canada

## 🎯 Roadmap

- [ ] E-commerce integration
- [ ] Payment processing
- [ ] Inventory management
- [ ] Customer portal
- [ ] Analytics dashboard
- [ ] Mobile app

---

**GemSpots** - Where nature meets technology ✨
