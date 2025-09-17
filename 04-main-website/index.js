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
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 5 // Maximum 5 files total
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware for file uploads
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false, 
        message: 'File too large. Maximum size is 10MB per file.' 
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({ 
        success: false, 
        message: 'Too many files. Maximum is 5 files.' 
      });
    }
  }
  next(error);
});

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
    const products = await database.getFeaturedProducts();
    const gemspots = products.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      images: product.image_urls || ["/images/default-gemspot.jpg"],
      qrCode: product.qr_code,
      nftUrl: product.nft_url,
      nftImage: product.nft_image_url,
      crystal: product.crystal_type,
      rarity: product.rarity,
      energyProperties: product.energy_properties,
      personalityTarget: product.personality_target,
      status: product.status,
      category: product.category,
      dimensions: product.dimensions,
      weight: product.weight,
      stock: product.stock_quantity,
      isFeatured: product.is_featured,
      createdAt: product.created_at
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

// Database migration endpoint
app.post('/api/admin/migrate-database', async (req, res) => {
  try {
    console.log('🔄 [MIGRATION v2.0] Starting database migration...');
    
    const client = await database.pool.connect();
    
    // Check if new columns exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name IN ('image_urls', 'nft_image_url', 'energy_properties', 'personality_target', 'is_archived')
    `);
    
    console.log('🔄 [MIGRATION v2.0] Existing columns:', columnCheck.rows.map(r => r.column_name));
    
    // Add missing columns
    const migrations = [
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[]",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS nft_image_url VARCHAR(500)",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS energy_properties TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS personality_target TEXT",
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false"
    ];
    
    for (const migration of migrations) {
      try {
        await client.query(migration);
        console.log('✅ [MIGRATION v2.0] Executed:', migration);
      } catch (migrationError) {
        console.log('⚠️ [MIGRATION v2.0] Skipped (already exists):', migration);
      }
    }
    
    // Migrate existing image_url to image_urls array
    await client.query(`
      UPDATE products 
      SET image_urls = ARRAY[image_url] 
      WHERE image_url IS NOT NULL 
      AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL)
    `);
    
    client.release();
    
    console.log('🔄 [MIGRATION v2.0] Database migration completed successfully');
    
    res.json({
      success: true,
      message: 'Database migration v2.0 completed successfully',
      migratedColumns: columnCheck.rows.map(r => r.column_name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [MIGRATION v2.0 ERROR]:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
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

app.post('/api/admin/products', requireAuth, upload.fields([
  { name: 'images', maxCount: 4 },
  { name: 'nftImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('📦 [ADD PRODUCT] Starting product creation...');
    console.log('📦 [ADD PRODUCT] Files received:', req.files ? Object.keys(req.files) : 'No files');
    console.log('📦 [ADD PRODUCT] Body data:', req.body);
    
    // Process multiple images
    const imageUrls = [];
    if (req.files && req.files.images) {
      console.log('📦 [ADD PRODUCT] Processing images:', req.files.images.length);
      req.files.images.forEach(file => {
        imageUrls.push(`/uploads/${file.filename}`);
      });
    }

    // Process NFT image
    let nftImageUrl = null;
    if (req.files && req.files.nftImage && req.files.nftImage[0]) {
      console.log('📦 [ADD PRODUCT] Processing NFT image');
      nftImageUrl = `/uploads/${req.files.nftImage[0].filename}`;
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_urls: imageUrls,
      qr_code: req.body.qr_code,
      nft_url: req.body.nft_url,
      nft_image_url: nftImageUrl,
      status: req.body.status || 'available',
      category: req.body.category,
      dimensions: req.body.dimensions,
      weight: req.body.weight,
      crystal_type: req.body.crystal_type,
      rarity: req.body.rarity,
      energy_properties: req.body.energy_properties,
      personality_target: req.body.personality_target,
      stock_quantity: parseInt(req.body.stock_quantity) || 1,
      is_featured: req.body.is_featured === 'true',
      is_archived: req.body.is_archived === 'true'
    };

    console.log('📦 [ADD PRODUCT] Product data prepared:', productData);
    
    const result = await database.addProduct(productData);
    console.log('📦 [ADD PRODUCT] Product created successfully:', result);
    
    res.json({ success: true, product: result });
  } catch (error) {
    console.error('❌ [ADD PRODUCT ERROR]:', error);
    console.error('❌ [ADD PRODUCT ERROR STACK]:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error adding product',
      error: error.message 
    });
  }
});

app.put('/api/admin/products/:id', requireAuth, upload.fields([
  { name: 'images', maxCount: 4 },
  { name: 'nftImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Process multiple images
    const imageUrls = [];
    if (req.files.images) {
      req.files.images.forEach(file => {
        imageUrls.push(`/uploads/${file.filename}`);
      });
    } else if (req.body.existing_images) {
      // Keep existing images if no new ones uploaded
      imageUrls.push(...JSON.parse(req.body.existing_images));
    }

    // Process NFT image
    let nftImageUrl = req.body.existing_nft_image;
    if (req.files.nftImage && req.files.nftImage[0]) {
      nftImageUrl = `/uploads/${req.files.nftImage[0].filename}`;
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_urls: imageUrls,
      qr_code: req.body.qr_code,
      nft_url: req.body.nft_url,
      nft_image_url: nftImageUrl,
      status: req.body.status,
      category: req.body.category,
      dimensions: req.body.dimensions,
      weight: req.body.weight,
      crystal_type: req.body.crystal_type,
      rarity: req.body.rarity,
      energy_properties: req.body.energy_properties,
      personality_target: req.body.personality_target,
      stock_quantity: parseInt(req.body.stock_quantity),
      is_featured: req.body.is_featured === 'true',
      is_archived: req.body.is_archived === 'true'
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
