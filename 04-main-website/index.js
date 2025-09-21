const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const multer = require('multer');
const PostgresDatabase = require('./database/postgres-database');
const AdminAuth = require('./admin-panel/admin-auth');
const StockManager = require('./database/stock-manager');

const app = express();
const PORT = process.env.PORT || 4000;

// Configure Express for Vercel (trust proxy)
app.set('trust proxy', 1);

// Initialize services
const database = new PostgresDatabase();
const adminAuth = new AdminAuth();
const stockManager = new StockManager();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use /tmp for Vercel, uploads/ for local development
    const uploadDir = process.env.VERCEL ? '/tmp' : 'uploads/';
    cb(null, uploadDir);
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
// Note: express.static moved after admin routes to avoid conflicts
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

// Rate limiting (configured for Vercel)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  trustProxy: true, // Trust Vercel's proxy
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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

// Authentication middleware
const requireAuth = (req, res, next) => {
  console.log('🔐 requireAuth middleware called for:', req.url);
  
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  console.log('🔐 Token found:', token ? 'YES' : 'NO');
  
  if (!token) {
    console.log('🔐 No token, checking if API or page...');
    if (req.url.startsWith('/api/')) {
      console.log('🔐 API request without token, returning 401');
      return res.status(401).json({ success: false, message: 'Token required' });
    } else {
      console.log('🔐 Page request without token, redirecting to login...');
      return res.redirect('/admin/login');
    }
  }
  
  const decoded = adminAuth.verifyToken(token);
  console.log('🔐 Token verification result:', decoded ? 'VALID' : 'INVALID');
  if (!decoded) {
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    } else {
      console.log('🔐 Invalid token, redirecting to login...');
      return res.redirect('/admin/login');
    }
  }
  
  req.user = decoded;
  next();
};

// Debug middleware to log all requests
app.use((req, res, next) => {
  if (req.url.startsWith('/admin/')) {
    console.log('🔍 [ROUTE-DEBUG] Admin route accessed:', req.url, 'Method:', req.method);
  }
  next();
});

// Admin routes - MUST be before static middleware
app.get('/admin/login', (req, res) => {
  console.log('🔐 /admin/login route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

app.get('/admin/debug', (req, res) => {
  console.log('🔍 /admin/debug route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'debug.html'));
});

app.get('/admin/dashboard', requireAuth, (req, res) => {
  console.log('🔐 /admin/dashboard route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'dashboard.html'));
});

// Static files middleware (moved after admin routes to avoid conflicts)
app.use(express.static(path.join(__dirname, 'public')));

// API Routes for GemSpots data
app.get('/api/gemspots', async (req, res) => {
  try {
    const products = await database.getFeaturedProducts();
    
    const gemspots = await Promise.all(products.map(async (product) => {
      // Get available variants for this product
      const variants = await database.getAvailableVariants(product.id);
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        images: product.image_urls || ["/images/default-gemspot.jpg"],
        nftUrl: product.nft_url,
        nftImage: product.nft_image_url,
        crystal_type: product.crystal_type,
        rarity: product.rarity,
        energyProperties: product.energy_properties,
        personalityTarget: product.personality_target,
        status: product.status,
        category: product.category,
        dimensions: product.dimensions,
        weight: product.weight,
        stock: product.stock_quantity,
        isFeatured: product.is_featured,
        createdAt: product.created_at,
        availableVariants: variants.length,
        hasVariants: variants.length > 0,
        variants: variants.map(variant => ({
          id: variant.id,
          variant_code: variant.variant_code,
          nft_url: variant.nft_url,
          nft_image_url: variant.nft_image_url,
          qr_code_url: variant.qr_code_url,
          price: variant.price ? parseFloat(variant.price) : parseFloat(product.price),
          status: variant.status
        }))
      };
    }));
    
    res.json({ success: true, gemspots });
  } catch (error) {
    console.error('Error fetching gemspots:', error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

// API endpoint to get a specific product by ID
app.get('/api/gemspots/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const products = await database.getAllProducts();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const productData = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price),
      images: product.image_urls || ["/images/default-gemspot.jpg"],
      nftUrl: product.nft_url,
      nftImage: product.nft_image_url,
      crystal_type: product.crystal_type,
      rarity: product.rarity,
      energy_properties: product.energy_properties,
      personality_target: product.personality_target,
      status: product.status,
      category: product.category,
      dimensions: product.dimensions,
      weight: product.weight,
      stock: product.stock_quantity,
      isFeatured: product.is_featured,
      createdAt: product.created_at
    };
    
    res.json({
      success: true,
      product: productData
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

// Admin API Routes
app.get('/api/admin/table-structure', requireAuth, async (req, res) => {
    try {
        const client = await database.pool.connect();
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            ORDER BY ordinal_position
        `);
        client.release();
        
        res.json({
            success: true,
            columns: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error getting table structure:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Stock management API routes
app.post('/api/stock/check', async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        
        if (!productId || !quantity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Product ID and quantity are required' 
            });
        }

        const stockCheck = await stockManager.checkStock(productId, quantity);
        res.json(stockCheck);
    } catch (error) {
        console.error('Error checking stock:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error checking stock availability' 
        });
    }
});

app.post('/api/stock/reserve', async (req, res) => {
    try {
        const { sessionId, productId, quantity } = req.body;
        
        if (!sessionId || !productId || !quantity) {
            return res.status(400).json({ 
                success: false, 
                message: 'Session ID, product ID, and quantity are required' 
            });
        }

        // Check stock availability first
        const stockCheck = await stockManager.checkStock(productId, quantity);
        if (!stockCheck.available) {
            return res.status(400).json({
                success: false,
                message: `Only ${stockCheck.availableStock} units available`,
                availableStock: stockCheck.availableStock
            });
        }

        // Reserve stock
        stockManager.reserveStock(sessionId, productId, quantity);
        
        res.json({ 
            success: true, 
            message: 'Stock reserved successfully',
            reservedQuantity: quantity
        });
    } catch (error) {
        console.error('Error reserving stock:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error reserving stock' 
        });
    }
});

app.post('/api/stock/release', async (req, res) => {
    try {
        const { sessionId, productId, quantity } = req.body;
        
        if (!sessionId || !productId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Session ID and product ID are required' 
            });
        }

        // Release stock reservation
        stockManager.releaseReservation(sessionId, productId);
        
        res.json({ 
            success: true, 
            message: 'Stock reservation released successfully'
        });
    } catch (error) {
        console.error('Error releasing stock:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error releasing stock reservation' 
        });
    }
});

app.get('/api/stock/status', async (req, res) => {
    try {
        const stockStatus = await stockManager.getStockStatus();
        res.json({ 
            success: true, 
            stockStatus: stockStatus 
        });
    } catch (error) {
        console.error('Error getting stock status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error getting stock status' 
        });
    }
});

// Product Variants API routes
app.get('/api/products/:id/variants', async (req, res) => {
    try {
        const productId = req.params.id;
        const variants = await database.getProductVariants(productId);
        res.json({ success: true, variants });
    } catch (error) {
        console.error('Error getting product variants:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/products/:id/variants/available', async (req, res) => {
    try {
        const productId = req.params.id;
        const variants = await database.getAvailableVariants(productId);
        res.json({ success: true, variants });
    } catch (error) {
        console.error('Error getting available variants:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/products/:id/variants', requireAuth, async (req, res) => {
    try {
        const productId = req.params.id;
        const variantData = req.body;
        
        const variant = await database.addProductVariant(productId, variantData);
        res.json({ success: true, variant });
    } catch (error) {
        console.error('Error adding product variant:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/admin/variants/:variantId/status', requireAuth, async (req, res) => {
    try {
        const variantId = req.params.variantId;
        const { status } = req.body;
        
        const variant = await database.updateVariantStatus(variantId, status);
        res.json({ success: true, variant });
    } catch (error) {
        console.error('Error updating variant status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/admin/variants/:variantId', requireAuth, async (req, res) => {
    try {
        const variantId = req.params.variantId;
        
        const variant = await database.deleteProductVariant(variantId);
        res.json({ success: true, variant });
    } catch (error) {
        console.error('Error deleting product variant:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Checkout API endpoint
app.post('/api/checkout', async (req, res) => {
    try {
        const { items, shippingInfo, paymentInfo } = req.body;
        
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No items in cart'
            });
        }
        
        // Process each item and update stock
        const processedItems = [];
        const variantIds = [];
        
        for (const item of items) {
            // Extract variant ID if present
            if (item.variantId) {
                variantIds.push(item.variantId);
            }
            
            processedItems.push({
                id: item.id,
                name: item.name,
                variant_code: item.variant_code,
                price: item.price,
                quantity: item.quantity
            });
        }
        
        // Update stock for variants
        if (variantIds.length > 0) {
            const stockUpdate = await stockManager.updateStockAfterPurchase(
                items[0].productId, 
                items.length, 
                variantIds
            );
            
            if (!stockUpdate.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error updating stock'
                });
            }
        }
        
        // Here you would typically:
        // 1. Process payment with Stripe/PayPal
        // 2. Send confirmation email
        // 3. Create order record in database
        // 4. Send shipping notification
        
        console.log('✅ Checkout processed successfully:', {
            items: processedItems,
            variantIds: variantIds,
            shippingInfo: shippingInfo
        });
        
        res.json({
            success: true,
            message: 'Order processed successfully',
            orderId: 'ORD-' + Date.now(),
            items: processedItems
        });
        
    } catch (error) {
        console.error('Error processing checkout:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing checkout'
        });
    }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('🔐 [LOGIN] Login attempt received');
    console.log('🔐 [LOGIN] Request body:', req.body);
    console.log('🔐 [LOGIN] Content-Type:', req.get('Content-Type'));
    
    let username, password;
    
    // Handle both JSON and form data
    if (req.get('Content-Type') && req.get('Content-Type').includes('application/json')) {
      username = req.body.username;
      password = req.body.password;
    } else {
      // Form data
      username = req.body.username;
      password = req.body.password;
    }
    
    if (!username || !password) {
      console.log('🔐 [LOGIN] Missing username or password');
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    
    console.log('🔐 [LOGIN] Attempting login for user:', username);
    const result = await adminAuth.login(username, password);
    
    if (result) {
      console.log('🔐 [LOGIN] Login successful for user:', username);
      res.json({ success: true, token: result.token, user: result.user });
    } else {
      console.log('🔐 [LOGIN] Login failed for user:', username);
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('🔐 [LOGIN] Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
});

// Test endpoint to verify admin user exists
app.get('/api/admin/test-user', async (req, res) => {
  try {
    console.log('🔍 [TEST-USER] Testing admin user lookup...');
    const user = await adminAuth.database.getAdminByUsername('admin');
    console.log('🔍 [TEST-USER] User found:', user ? 'YES' : 'NO');
    if (user) {
      console.log('🔍 [TEST-USER] User details:', { id: user.id, username: user.username, role: user.role });
      console.log('🔍 [TEST-USER] Password hash exists:', !!user.password_hash);
      console.log('🔍 [TEST-USER] Password hash preview:', user.password_hash ? user.password_hash.substring(0, 20) + '...' : 'NONE');
    }
    res.json({ 
      success: true, 
      userExists: !!user,
      user: user ? { id: user.id, username: user.username, role: user.role } : null,
      hasPassword: user ? !!user.password_hash : false,
      passwordHash: user ? user.password_hash : null
    });
  } catch (error) {
    console.error('❌ [TEST-USER] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to verify password hash
app.post('/api/admin/test-password', async (req, res) => {
  try {
    const { password } = req.body;
    console.log('🔐 [TEST-PASSWORD] Testing password:', password ? 'PROVIDED' : 'NOT_PROVIDED');
    
    const user = await adminAuth.database.getAdminByUsername('admin');
    if (!user) {
      return res.json({ success: false, message: 'Admin user not found' });
    }
    
    const bcrypt = require('bcryptjs');
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    console.log('🔐 [TEST-PASSWORD] Password validation result:', isValid);
    console.log('🔐 [TEST-PASSWORD] Stored hash:', user.password_hash);
    
    res.json({ 
      success: true, 
      isValid: isValid,
      storedHash: user.password_hash
    });
  } catch (error) {
    console.error('❌ [TEST-PASSWORD] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset admin password endpoint
app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    console.log('🔐 [RESET-PASSWORD] Resetting admin password...');
    
    if (!newPassword) {
      return res.json({ success: false, message: 'New password required' });
    }
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await adminAuth.database.updateAdminPassword('admin', hashedPassword);
    
    console.log('🔐 [RESET-PASSWORD] Admin password reset successfully');
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully',
      newHash: hashedPassword
    });
  } catch (error) {
    console.error('❌ [RESET-PASSWORD] Error:', error);
    res.status(500).json({ success: false, error: error.message });
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

// Diagnostic endpoint (NO AUTH for troubleshooting)
app.get('/api/admin/diagnostic', async (req, res) => {
  try {
    console.log('🔍 [DIAGNOSTIC] Starting database diagnostic...');
    
    // Test database connection
    const client = await database.pool.connect();
    console.log('🔍 [DIAGNOSTIC] Database connection successful');
    
    // Check if website_admins table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'website_admins'
      );
    `);
    
    console.log('🔍 [DIAGNOSTIC] Website admins table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Check if admin user exists
      const userCheck = await client.query('SELECT * FROM website_admins WHERE username = $1', ['admin']);
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

// Create admin user endpoint (NO AUTH for initial setup)
app.post('/api/admin/create-admin', async (req, res) => {
  try {
    console.log('🔧 [CREATE ADMIN] Starting admin user creation...');
    
    const bcrypt = require('bcryptjs');
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const client = await database.pool.connect();
    try {
      // Check if admin already exists
      const existingAdmin = await client.query(
        'SELECT id FROM website_admins WHERE username = $1',
        [username]
      );
      
      if (existingAdmin.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Admin user already exists' });
      }
      
      // Create new admin user
      const result = await client.query(
        'INSERT INTO website_admins (username, password_hash, role, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, username, role',
        [username, hashedPassword, 'admin']
      );
      
      console.log('✅ [CREATE ADMIN] Admin user created successfully:', result.rows[0]);
      
      res.json({
        success: true,
        message: 'Admin user created successfully',
        user: result.rows[0]
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ [CREATE ADMIN ERROR]:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating admin user',
      error: error.message
    });
  }
});

// Fix password endpoint
app.post('/api/admin/fix-password', requireAuth, async (req, res) => {
  try {
    console.log('🔧 [FIX PASSWORD] Starting password fix...');
    
    const bcrypt = require('bcryptjs');
    const correctHash = '$2a$10$KtGWhWtpuuskGKVkj9Lq6eJEVKcNLtCop11ofxZSi.3PVyHnv3i4u';
    
    // Update admin password in database
    const client = await database.pool.connect();
    const result = await client.query(
      'UPDATE website_admins SET password_hash = $1 WHERE username = $2 RETURNING *',
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
app.post('/api/admin/migrate-database', requireAuth, async (req, res) => {
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
      "ALTER TABLE products ADD COLUMN IF NOT EXISTS nft_image_url TEXT",
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
    
    // Fix existing column types for base64 images
    const typeMigrations = [
      "ALTER TABLE products ALTER COLUMN nft_image_url TYPE TEXT",
      "ALTER TABLE products DROP COLUMN IF EXISTS qr_code",
      "ALTER TABLE products ALTER COLUMN nft_url TYPE TEXT"
    ];
    
    for (const migration of typeMigrations) {
      try {
        await client.query(migration);
        console.log('✅ [MIGRATION v2.0] Type fixed:', migration);
      } catch (migrationError) {
        console.log('⚠️ [MIGRATION v2.0] Type migration skipped:', migration);
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
        // Store as base64 for Vercel, or file path for local
        if (process.env.VERCEL) {
          const fs = require('fs');
          const imageBuffer = fs.readFileSync(file.path);
          const base64Image = imageBuffer.toString('base64');
          imageUrls.push(`data:${file.mimetype};base64,${base64Image}`);
        } else {
          imageUrls.push(`/uploads/${file.filename}`);
        }
      });
    }

    // Process NFT image
    let nftImageUrl = null;
    if (req.files && req.files.nftImage && req.files.nftImage[0]) {
      console.log('📦 [ADD PRODUCT] Processing NFT image');
      if (process.env.VERCEL) {
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(req.files.nftImage[0].path);
        const base64Image = imageBuffer.toString('base64');
        nftImageUrl = `data:${req.files.nftImage[0].mimetype};base64,${base64Image}`;
      } else {
        nftImageUrl = `/uploads/${req.files.nftImage[0].filename}`;
      }
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_urls: imageUrls,
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
    if (req.files && req.files.images) {
      req.files.images.forEach(file => {
        // Store as base64 for Vercel, or file path for local
        if (process.env.VERCEL) {
          const fs = require('fs');
          const imageBuffer = fs.readFileSync(file.path);
          const base64Image = imageBuffer.toString('base64');
          imageUrls.push(`data:${file.mimetype};base64,${base64Image}`);
        } else {
          imageUrls.push(`/uploads/${file.filename}`);
        }
      });
    } else if (req.body.existing_images) {
      // Keep existing images if no new ones uploaded
      imageUrls.push(...JSON.parse(req.body.existing_images));
    }

    // Process NFT image
    let nftImageUrl = req.body.existing_nft_image;
    if (req.files && req.files.nftImage && req.files.nftImage[0]) {
      if (process.env.VERCEL) {
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(req.files.nftImage[0].path);
        const base64Image = imageBuffer.toString('base64');
        nftImageUrl = `data:${req.files.nftImage[0].mimetype};base64,${base64Image}`;
      } else {
        nftImageUrl = `/uploads/${req.files.nftImage[0].filename}`;
      }
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_urls: imageUrls,
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
  // Don't handle admin routes with 404
  if (req.url.startsWith('/admin/')) {
    return res.status(404).json({ success: false, message: 'Admin route not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start server (only in development)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🌟 GemSpots Website running on port ${PORT}`);
    console.log(`🌐 Website: http://localhost:${PORT}`);
    console.log(`📱 Mobile: http://192.168.18.19:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
