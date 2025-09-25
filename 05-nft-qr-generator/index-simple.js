console.log('🚀 Starting simple QR Generator server...');

const express = require('express');
console.log('✅ Express loaded');

const path = require('path');
console.log('✅ Path loaded');

const cors = require('cors');
console.log('✅ CORS loaded');

const helmet = require('helmet');
console.log('✅ Helmet loaded');

const rateLimit = require('express-rate-limit');
console.log('✅ Rate limit loaded');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Vercel
app.set('trust proxy', 1);

console.log('✅ App created');

// Basic middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.static('admin-panel'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

console.log('✅ Middleware configured');

// Try to load database
let PostgresDatabase = null;
let nftDatabase = null;

try {
  console.log('🔄 Loading PostgresDatabase...');
  PostgresDatabase = require('./database/postgres-database');
  console.log('✅ PostgresDatabase loaded');
  
  console.log('🔄 Initializing database...');
  nftDatabase = new PostgresDatabase();
  console.log('✅ Database initialized');
} catch (error) {
  console.error('❌ Error with database:', error.message);
  console.log('⚠️ Continuing without database...');
}

console.log('✅ Database setup completed');

// Basic routes
app.get('/', (req, res) => {
  console.log('📝 Root route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  console.log('📝 Dashboard route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'dashboard.html'));
});

// API routes with database
app.post('/api/login', async (req, res) => {
  console.log('📝 Login API accessed');
  try {
    if (!nftDatabase) {
      return res.json({ success: false, message: 'Database not available' });
    }
    
    const { username, password } = req.body;
    const result = await nftDatabase.authenticateAdmin(username, password);
    
    if (result.success) {
      res.json({ success: true, token: result.token });
    } else {
      res.json({ success: false, message: result.message });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Login failed' });
  }
});

app.get('/api/nfts', async (req, res) => {
  console.log('📝 NFTs API accessed');
  try {
    if (!nftDatabase) {
      return res.json({ success: true, nfts: [] });
    }
    
    const nfts = await nftDatabase.getAllNFTs();
    res.json({ success: true, nfts });
  } catch (error) {
    console.error('NFTs error:', error);
    res.json({ success: true, nfts: [] });
  }
});

app.get('/api/locations', async (req, res) => {
  console.log('📝 Locations API accessed');
  try {
    if (!nftDatabase) {
      return res.json({ success: true, locations: [] });
    }
    
    const locations = await nftDatabase.getLocations();
    res.json({ success: true, locations });
  } catch (error) {
    console.error('Locations error:', error);
    res.json({ success: true, locations: [] });
  }
});

app.get('/api/admin/products', async (req, res) => {
  console.log('📝 Admin Products API accessed');
  try {
    if (!nftDatabase) {
      return res.json({ success: true, products: [] });
    }
    
    const products = await nftDatabase.getAllProducts();
    res.json({ success: true, products });
  } catch (error) {
    console.error('Admin products error:', error);
    res.json({ success: true, products: [] });
  }
});

console.log('✅ Routes configured');

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

console.log('✅ Server startup initiated');

module.exports = app;
