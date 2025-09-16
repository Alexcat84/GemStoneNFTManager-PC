const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const multer = require('multer');
const PostgresDatabase = require('./database/postgres-database');
const AdminAuth = require('./admin-panel/admin-auth');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize services
const database = new PostgresDatabase();
const adminAuth = new AdminAuth();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// Admin routes
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel', 'dashboard.html'));
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (!token) {
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Token required' });
    } else {
      return res.redirect('/admin/login');
    }
  }
  
  const decoded = adminAuth.verifyToken(token);
  if (!decoded) {
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    } else {
      return res.redirect('/admin/login');
    }
  }
  
  req.user = decoded;
  next();
};

// API Routes for GemSpots data
app.get('/api/gemspots', async (req, res) => {
  try {
    const products = await database.getAllProducts();
    const gemspots = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      image: product.image_url || "/images/default-gemspot.jpg",
      qrCode: product.qr_code,
      nftUrl: product.nft_url,
      status: product.status,
      category: product.category,
      dimensions: product.dimensions,
      weight: product.weight,
      crystal: product.crystal_type,
      rarity: product.rarity
    }));
    
    res.json({ success: true, gemspots });
  } catch (error) {
    console.error('Error fetching gemspots:', error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

// Admin API Routes
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await adminAuth.login(username, password);
    
    if (result) {
      res.json({ success: true, token: result.token, user: result.user });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

app.get('/api/admin/verify', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/admin/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const username = req.user.username;
    
    const success = await adminAuth.changePassword(username, currentPassword, newPassword);
    
    if (success) {
      res.json({ success: true, message: 'Password changed successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
});

// Diagnostic endpoint
app.get('/api/admin/diagnostic', async (req, res) => {
  try {
    console.log('🔍 [DIAGNOSTIC] Starting database diagnostic...');
    
    // Test database connection
    const client = await database.pool.connect();
    console.log('🔍 [DIAGNOSTIC] Database connection successful');
    
    // Check if admin_users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users'
      );
    `);
    
    console.log('🔍 [DIAGNOSTIC] Admin users table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Check if admin user exists
      const userCheck = await client.query('SELECT * FROM admin_users WHERE username = $1', ['admin']);
      console.log('🔍 [DIAGNOSTIC] Admin user found:', userCheck.rows.length > 0);
      console.log('🔍 [DIAGNOSTIC] Admin user data:', userCheck.rows[0]);
    }
    
    client.release();
    
    res.json({
      success: true,
      database: {
        connected: true,
        adminUsersTableExists: tableCheck.rows[0].exists,
        adminUserExists: tableCheck.rows[0].exists ? (await database.getAdminByUsername('admin')) ? true : false : false
      }
    });
  } catch (error) {
    console.error('❌ [DIAGNOSTIC ERROR]:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Fix password endpoint
app.post('/api/admin/fix-password', async (req, res) => {
  try {
    console.log('🔧 [FIX PASSWORD] Starting password fix...');
    
    const bcrypt = require('bcryptjs');
    const correctHash = '$2a$10$KtGWhWtpuuskGKVkj9Lq6eJEVKcNLtCop11ofxZSi.3PVyHnv3i4u';
    
    // Update admin password in database
    const client = await database.pool.connect();
    const result = await client.query(
      'UPDATE admin_users SET password_hash = $1 WHERE username = $2 RETURNING *',
      [correctHash, 'admin']
    );
    
    client.release();
    
    console.log('🔧 [FIX PASSWORD] Password updated successfully');
    
    res.json({
      success: true,
      message: 'Password updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ [FIX PASSWORD ERROR]:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

app.get('/api/admin/products', requireAuth, async (req, res) => {
  try {
    const products = await database.getAllProducts();
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

app.post('/api/admin/products', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_url: req.file ? `/uploads/${req.file.filename}` : null,
      qr_code: req.body.qr_code,
      nft_url: req.body.nft_url,
      status: req.body.status || 'available',
      category: req.body.category,
      dimensions: req.body.dimensions,
      weight: req.body.weight,
      crystal_type: req.body.crystal_type,
      rarity: req.body.rarity,
      stock_quantity: parseInt(req.body.stock_quantity) || 1,
      is_featured: req.body.is_featured === 'true'
    };

    const result = await database.addProduct(productData);
    res.json({ success: true, product: result });
  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ success: false, message: 'Error adding product' });
  }
});

app.put('/api/admin/products/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const productId = req.params.id;
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_url: req.file ? `/uploads/${req.file.filename}` : req.body.existing_image,
      qr_code: req.body.qr_code,
      nft_url: req.body.nft_url,
      status: req.body.status,
      category: req.body.category,
      dimensions: req.body.dimensions,
      weight: req.body.weight,
      crystal_type: req.body.crystal_type,
      rarity: req.body.rarity,
      stock_quantity: parseInt(req.body.stock_quantity),
      is_featured: req.body.is_featured === 'true'
    };

    const result = await database.updateProduct(productId, productData);
    res.json({ success: true, product: result });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res) => {
  try {
    const productId = req.params.id;
    const result = await database.deleteProduct(productId);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🌟 GemSpots Website running on port ${PORT}`);
  console.log(`🌐 Website: http://localhost:${PORT}`);
  console.log(`📱 Mobile: http://192.168.18.19:${PORT}`);
});
