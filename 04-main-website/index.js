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

const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const app = express();
const PORT = process.env.PORT || 4000;

// Configure Express for Vercel (trust proxy)
app.set('trust proxy', 1);

// Initialize services with error handling
let database, adminAuth, stockManager;

try {
  database = new PostgresDatabase();
  adminAuth = new AdminAuth();
  stockManager = new StockManager();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.error('❌ Error initializing services:', error);
  // Continue without services for now
}

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
// Stripe webhook needs raw body for signature verification (must be before express.json)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ [Stripe webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    (async () => {
      try {
        const order = await database.getOrderByStripeSessionId(session.id);
        if (!order) {
          console.error('❌ [Stripe webhook] Order not found for session:', session.id);
          return;
        }
        if (order.status === 'paid') {
          return; // Idempotent: already processed
        }
        await database.updateOrderPaid(order.id);
        const items = order.items && (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) || [];
        const variantIds = items.filter(i => i.variantId).map(i => i.variantId);
        const productId = items[0] && items[0].productId;
        if (productId && variantIds.length > 0) {
          await stockManager.updateStockAfterPurchase(productId, items.length, variantIds);
        }
        console.log('✅ [Stripe webhook] Order', order.id, 'marked paid and stock updated');
      } catch (e) {
        console.error('❌ [Stripe webhook] Fulfillment error:', e);
      }
    })();
  }
  res.sendStatus(200);
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin-panel', express.static(path.join(__dirname, 'admin-panel')));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    services: {
      database: database ? 'OK' : 'ERROR',
      adminAuth: adminAuth ? 'OK' : 'ERROR',
      stockManager: stockManager ? 'OK' : 'ERROR'
    }
  });
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

app.get('/order-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order-success.html'));
});

// Admin routes
app.get('/admin', (req, res) => {
  // Simple entrypoint: always redirect to login; login.js se encarga de redirigir al dashboard si ya hay token válido
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-16');
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-16');
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
    if (!database || !database.pool) {
      console.error('❌ [API] Database not initialized or pool unavailable');
      return res.status(503).json({ success: false, message: 'Database not available' });
    }
    
    // Check if request is coming from gallery page
    const isGalleryRequest = (req.headers.referer && req.headers.referer.includes('/gallery')) || 
                            req.query.source === 'gallery';
    
    let products;
    if (isGalleryRequest) {
      console.log('🔍 [API] Gallery request - fetching all available products...');
      products = await database.getAvailableProducts();
    } else {
      console.log('🔍 [API] Homepage request - fetching featured products...');
      products = await database.getFeaturedProducts();
      
      if (products.length === 0) {
        console.log('⚠️ [API] No featured products found, trying all available products...');
        products = await database.getAvailableProducts();
      }
    }
    
    console.log('🔍 [API] Found products:', products.length);
    
    if (products.length === 0) {
      return res.json({ success: true, gemspots: [] });
    }
    
    const gemspots = await Promise.all(products.map(async (product) => {
      try {
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
      } catch (variantError) {
        console.error('❌ [API] Error processing product variants for product', product.id, ':', variantError);
        // Return product without variants if variant loading fails
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
          availableVariants: 0,
          hasVariants: false,
          variants: []
        };
      }
    }));
    
    console.log('✅ [API] Successfully processed', gemspots.length, 'products');
    res.json({ success: true, gemspots });
  } catch (error) {
    console.error('❌ [API] Error fetching gemspots:', error);
    console.error('❌ [API] Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching products',
      error: error.message 
    });
  }
});

// Debug endpoint to check database status
app.get('/api/debug/products', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Checking database status...');
    
    const allProducts = await database.getAllProducts();
    const featuredProducts = await database.getFeaturedProducts();
    const availableProducts = await database.getAvailableProducts();
    
    res.json({
      success: true,
      debug: {
        totalProducts: allProducts.length,
        featuredProducts: featuredProducts.length,
        availableProducts: availableProducts.length,
        allProducts: allProducts.map(p => ({
          id: p.id,
          name: p.name,
          is_featured: p.is_featured,
          status: p.status,
          is_archived: p.is_archived
        }))
      }
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// API endpoint for full gallery (all products)
app.get('/api/gallery', async (req, res) => {
  try {
    console.log('🔍 [GALLERY API] Fetching all available products...');
    const products = await database.getAvailableProducts();
    console.log('🔍 [GALLERY API] Found products:', products.length);
    
    const gemspots = await Promise.all(products.map(async (product) => {
      try {
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
      } catch (variantError) {
        console.error('❌ [GALLERY API] Error processing product variants for product', product.id, ':', variantError);
        // Return product without variants if variant loading fails
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
          availableVariants: 0,
          hasVariants: false,
          variants: []
        };
      }
    }));
    
    console.log('✅ [GALLERY API] Successfully processed', gemspots.length, 'products');
    res.json({ success: true, gemspots });
  } catch (error) {
    console.error('❌ [GALLERY API] Error fetching gallery products:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching gallery products',
      error: error.message 
    });
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
app.get('/api/admin/table-structure', async (req, res) => {
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
app.post('/api/checkout/create-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ success: false, message: 'Stripe is not configured' });
  }
  try {
    const { items, shippingInfo } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in cart' });
    }
    const variantIds = items.filter(i => i.variantId).map(i => i.variantId);
    const productId = items[0] && items[0].productId;
    if (productId && variantIds.length > 0) {
      const stockUpdate = await stockManager.checkStock(productId, items.length);
      if (!stockUpdate.available) {
        return res.status(400).json({
          success: false,
          message: `Only ${stockUpdate.availableStock} units available`,
          availableStock: stockUpdate.availableStock
        });
      }
    }
    const subtotal = items.reduce((sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1), 0);
    const shippingCost = (shippingInfo && Number(shippingInfo.cost)) || 0;
    const taxRate = 0.13;
    const tax = (subtotal + shippingCost) * taxRate;
    const total = subtotal + shippingCost + tax;
    const orderData = {
      status: 'pending',
      total,
      shipping_cost: shippingCost,
      tax,
      items: items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        price: Number(i.price) || 0,
        quantity: i.quantity || 1
      })),
      shipping_address: shippingInfo || null
    };
    const order = await database.createOrder(orderData);
    const rawBase = process.env.BASE_URL || (req.headers.origin || '').replace(/\/$/, '') || `http://localhost:${PORT}`;
    const baseUrl = (rawBase && !/^https?:\/\//i.test(rawBase))
      ? (rawBase.startsWith('localhost') || rawBase.startsWith('127.0.0.1') ? `http://${rawBase}` : `https://${rawBase}`)
      : rawBase;
    const successUrl = `${baseUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/#gallery`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: items.map(item => {
        const imageUrl = item.image && !item.image.startsWith('data:') && (item.image.startsWith('http') ? item.image : `${baseUrl}${item.image}`);
        return {
          price_data: {
            currency: 'cad',
            product_data: {
              name: item.name,
              ...(imageUrl ? { images: [imageUrl] } : {})
            },
            unit_amount: Math.round((Number(item.price) || 0) * 100)
          },
          quantity: item.quantity || 1
        };
      }),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orderId: String(order.id) }
    });
    await database.updateOrderStripeSessionId(order.id, session.id);
    res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating checkout session'
    });
  }
});

// Checkout API endpoint (legacy: no real payment; keep for backward compatibility or remove later)
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
    
    console.log('🔍 [ADMIN API] Raw products from database:', products.length);
    products.forEach((product, index) => {
      console.log(`🔍 [ADMIN API] Product ${index + 1}:`, {
        id: product.id,
        name: product.name,
        image_urls: product.image_urls,
        nft_url: product.nft_url,
        nft_image_url: product.nft_image_url
      });
    });
    
    // Transform products for admin dashboard compatibility
    const transformedProducts = products.map(product => ({
      ...product,
      image_url: product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : null,
      image_urls: product.image_urls || [],
      nft_image_url: product.nft_image_url || null,
      nft_url: product.nft_url || null
    }));
    
    console.log('🔍 [ADMIN API] Transformed products:', transformedProducts.length);
    transformedProducts.forEach((product, index) => {
      console.log(`🔍 [ADMIN API] Transformed Product ${index + 1}:`, {
        id: product.id,
        name: product.name,
        image_url: product.image_url,
        image_urls: product.image_urls,
        nft_url: product.nft_url,
        nft_image_url: product.nft_image_url
      });
    });
    
    res.json({ success: true, products: transformedProducts });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

// Admin Reports (migrated from 06-nft-reports)
app.get('/api/admin/reports/qrs', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [REPORTS] Loading QR codes...');
    const qrs = await database.getAllQRs();
    console.log('🔍 [REPORTS] QR codes loaded:', Array.isArray(qrs) ? qrs.length : 0);
    res.json({ success: true, qrs: qrs || [] });
  } catch (error) {
    console.error('Error fetching QR reports:', error);
    res.status(500).json({ success: false, message: 'Error fetching QR reports' });
  }
});

app.get('/api/admin/reports/codes', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [REPORTS] Loading generated codes...');
    const codes = await database.getAllGeneratedCodes();
    console.log('🔍 [REPORTS] Generated codes loaded:', Array.isArray(codes) ? codes.length : 0);
    res.json({ success: true, codes: codes || [] });
  } catch (error) {
    console.error('Error fetching codes reports:', error);
    res.status(500).json({ success: false, message: 'Error fetching codes reports' });
  }
});

app.get('/api/admin/reports/products', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [REPORTS] Loading products for reports...');
    const products = await database.getAllProducts();
    console.log('🔍 [REPORTS] Products loaded:', Array.isArray(products) ? products.length : 0);
    res.json({ success: true, products: products || [] });
  } catch (error) {
    console.error('Error fetching products reports:', error);
    res.status(500).json({ success: false, message: 'Error fetching products reports' });
  }
});

// Admin Code Generator / Locations (migrated from 05-nft-qr-generator)
app.get('/api/admin/locations', requireAuth, async (req, res) => {
  try {
    const locations = await database.getAllLocations();
    res.json({ success: true, locations: locations || [] });
  } catch (error) {
    console.error('Error getting locations:', error);
    res.status(500).json({ success: false, message: 'Error getting locations' });
  }
});

app.post('/api/admin/locations', requireAuth, async (req, res) => {
  try {
    const { country, region } = req.body;
    if (!country || !region) {
      return res.status(400).json({ success: false, message: 'country and region are required' });
    }
    const location = await database.addLocation(country, region);
    res.json({ success: true, location });
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ success: false, message: 'Error adding location' });
  }
});

app.get('/api/admin/codes', requireAuth, async (req, res) => {
  try {
    const codes = await database.getAllGeneratedCodes();
    res.json({ success: true, codes: codes || [] });
  } catch (error) {
    console.error('Error getting codes:', error);
    res.status(500).json({ success: false, message: 'Error getting codes' });
  }
});

app.post('/api/admin/codes/generate', requireAuth, async (req, res) => {
  try {
    const { gemstoneNames, locationId, month, year, notes } = req.body;
    if (!Array.isArray(gemstoneNames) || !gemstoneNames.length || !locationId || !month || !year) {
      return res.status(400).json({ success: false, message: 'gemstoneNames, locationId, month and year are required' });
    }

    // Get next correlative number
    const pieceNumber = await database.getNextCorrelative(gemstoneNames, month, year);

    // Use same code generator logic as in 05 (imported util)
    const CodeGenerator = require('../05-nft-qr-generator/src/utils/code-generator');
    const codeGenerator = new CodeGenerator();

    const fullCode = codeGenerator.generateCode(gemstoneNames, month, year, pieceNumber);
    const checksum = codeGenerator.generateChecksum(gemstoneNames.join(','), month, year, pieceNumber);
    const gemstoneCodes = gemstoneNames.map(name => codeGenerator.getGemstoneCode(name));

    const codeData = {
      full_code: fullCode,
      gemstone_names: JSON.stringify(gemstoneNames),
      gemstone_codes: JSON.stringify(gemstoneCodes),
      location_id: locationId,
      piece_number: pieceNumber,
      month,
      year,
      checksum,
      notes: notes || ''
    };

    const saved = await database.addGeneratedCode(codeData);

    res.json({
      success: true,
      message: 'Code generated successfully',
      fullCode,
      pieceNumber,
      gemstoneNames,
      ...saved
    });
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ success: false, message: 'Error generating code' });
  }
});

app.get('/api/admin/codes/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    const codes = await database.searchGeneratedCodes(query || '');
    res.json({ success: true, codes: codes || [] });
  } catch (error) {
    console.error('Error searching codes:', error);
    res.status(500).json({ success: false, message: 'Error searching codes' });
  }
});

app.delete('/api/admin/codes/:codeId', requireAuth, async (req, res) => {
  try {
    const { codeId } = req.params;
    const result = await database.deleteGeneratedCode(codeId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error deleting code:', error);
    res.status(500).json({ success: false, message: 'Error deleting code' });
  }
});

app.post('/api/admin/products', requireAuth, upload.fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 },
  { name: 'nftImage', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('📦 [ADD PRODUCT] Starting product creation...');
    console.log('📦 [ADD PRODUCT] Files received:', req.files ? Object.keys(req.files) : 'No files');
    console.log('📦 [ADD PRODUCT] Body data:', req.body);
    
    // Process images in specific order
    const imageUrls = [];
    const imageOrder = ['image1', 'image2', 'image3', 'image4'];
    
    console.log('📦 [ADD PRODUCT] Processing images in order...');
    imageOrder.forEach((imageField, index) => {
      if (req.files && req.files[imageField] && req.files[imageField][0]) {
        const file = req.files[imageField][0];
        console.log(`📦 [ADD PRODUCT] Processing ${imageField}:`, file.filename);
        
        // Store as base64 for Vercel, or file path for local
        if (process.env.VERCEL) {
          const fs = require('fs');
          const imageBuffer = fs.readFileSync(file.path);
          const base64Image = imageBuffer.toString('base64');
          imageUrls.push(`data:${file.mimetype};base64,${base64Image}`);
        } else {
          imageUrls.push(`/uploads/${file.filename}`);
        }
      }
    });
    
    console.log('📦 [ADD PRODUCT] Final imageUrls:', imageUrls);

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
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 },
  { name: 'nftImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const productId = req.params.id;
    
    console.log('🔄 [EDIT PRODUCT] Starting product update for ID:', productId);
    console.log('🔄 [EDIT PRODUCT] Files received:', req.files ? Object.keys(req.files) : 'No files');
    console.log('🔄 [EDIT PRODUCT] Body data:', req.body);
    console.log('🔄 [EDIT PRODUCT] existing_images:', req.body.existing_images);
    console.log('🔄 [EDIT PRODUCT] existing_nft_image:', req.body.existing_nft_image);
    console.log('🔄 [EDIT PRODUCT] existing_nft_url:', req.body.existing_nft_url);
    console.log('🔄 [EDIT PRODUCT] nft_url from form:', req.body.nft_url);
    
    // Get existing product data if needed (for preserving images and NFT data)
    let existingProduct = null;
    const needsExistingData = (!req.files || !req.files.images) && !req.body.existing_images;
    const needsExistingNft = (!req.files || !req.files.nftImage) && !req.body.existing_nft_image;
    const needsExistingNftUrl = !req.body.nft_url && !req.body.existing_nft_url;
    
    console.log('🔄 [EDIT PRODUCT] needsExistingData:', needsExistingData);
    console.log('🔄 [EDIT PRODUCT] needsExistingNft:', needsExistingNft);
    console.log('🔄 [EDIT PRODUCT] needsExistingNftUrl:', needsExistingNftUrl);
    
    if (needsExistingData || needsExistingNft || needsExistingNftUrl) {
      existingProduct = await database.getProductById(productId);
      console.log('🔄 [EDIT PRODUCT] Retrieved existing product:', existingProduct ? 'Found' : 'Not found');
      if (existingProduct) {
        console.log('🔄 [EDIT PRODUCT] Existing image_urls:', existingProduct.image_urls);
        console.log('🔄 [EDIT PRODUCT] Existing nft_image_url:', existingProduct.nft_image_url);
        console.log('🔄 [EDIT PRODUCT] Existing nft_url:', existingProduct.nft_url);
      }
    }
    
    // Process images in specific order
    let imageUrls = [];
    const imageOrder = ['image1', 'image2', 'image3', 'image4'];
    
    // Check if there are new images uploaded
    const hasNewImages = imageOrder.some(field => 
      req.files && req.files[field] && req.files[field][0]
    );
    
    if (hasNewImages) {
      // New images uploaded - process them in order
      console.log('🔄 [EDIT PRODUCT] Processing new images in order...');
      imageOrder.forEach((imageField, index) => {
        if (req.files && req.files[imageField] && req.files[imageField][0]) {
          const file = req.files[imageField][0];
          console.log(`🔄 [EDIT PRODUCT] Processing ${imageField}:`, file.filename);
          
          // Store as base64 for Vercel, or file path for local
          if (process.env.VERCEL) {
            const fs = require('fs');
            const imageBuffer = fs.readFileSync(file.path);
            const base64Image = imageBuffer.toString('base64');
            imageUrls.push(`data:${file.mimetype};base64,${base64Image}`);
          } else {
            imageUrls.push(`/uploads/${file.filename}`);
          }
        }
      });
    } else if (req.body.existing_images) {
      // No new images - keep existing ones from form data
      console.log('🔄 [EDIT PRODUCT] Using existing images from form data');
      console.log('🔄 [EDIT PRODUCT] Raw existing_images string:', req.body.existing_images);
      try {
        imageUrls = JSON.parse(req.body.existing_images);
        console.log('🔄 [EDIT PRODUCT] Parsed existing_images:', imageUrls);
      } catch (parseError) {
        console.error('🔄 [EDIT PRODUCT] Error parsing existing_images:', parseError);
        imageUrls = [];
      }
    } else if (existingProduct && existingProduct.image_urls) {
      // No new images and no existing_images in body - get from database
      console.log('🔄 [EDIT PRODUCT] Using existing images from database');
      imageUrls = existingProduct.image_urls;
    }
    
    console.log('🔄 [EDIT PRODUCT] Final imageUrls:', imageUrls);

    // Process NFT image
    let nftImageUrl = req.body.existing_nft_image;
    console.log('🔄 [EDIT PRODUCT] Initial nftImageUrl from form:', nftImageUrl);
    
    if (req.files && req.files.nftImage && req.files.nftImage[0]) {
      // New NFT image uploaded - use it
      console.log('🔄 [EDIT PRODUCT] Processing new NFT image');
      if (process.env.VERCEL) {
        const fs = require('fs');
        const imageBuffer = fs.readFileSync(req.files.nftImage[0].path);
        const base64Image = imageBuffer.toString('base64');
        nftImageUrl = `data:${req.files.nftImage[0].mimetype};base64,${base64Image}`;
      } else {
        nftImageUrl = `/uploads/${req.files.nftImage[0].filename}`;
      }
    } else if (!nftImageUrl && existingProduct && existingProduct.nft_image_url) {
      // No new NFT image and no existing_nft_image in body - get from database
      console.log('🔄 [EDIT PRODUCT] Using existing NFT image from database');
      nftImageUrl = existingProduct.nft_image_url;
    }
    
    console.log('🔄 [EDIT PRODUCT] Final nftImageUrl:', nftImageUrl);

    // Process NFT URL - preserve existing if not provided
    let nftUrl = req.body.nft_url;
    if (!nftUrl && req.body.existing_nft_url) {
      // Use existing NFT URL from form data
      nftUrl = req.body.existing_nft_url;
      console.log('🔄 [EDIT PRODUCT] Using existing NFT URL from form data');
    } else if (!nftUrl && existingProduct && existingProduct.nft_url) {
      // Use existing NFT URL from database
      nftUrl = existingProduct.nft_url;
      console.log('🔄 [EDIT PRODUCT] Using existing NFT URL from database');
    }
    
    console.log('🔄 [EDIT PRODUCT] Final nftUrl:', nftUrl);

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      image_urls: imageUrls,
      nft_url: nftUrl,
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

app.put('/api/admin/products/:id/mark-sold', requireAuth, async (req, res) => {
  try {
    const productId = req.params.id;
    const result = await database.updateProductStatus(productId, 'sold');
    res.json({ success: true, message: 'Product marked as sold successfully' });
  } catch (error) {
    console.error('Error marking product as sold:', error);
    res.status(500).json({ success: false, message: 'Error marking product as sold' });
  }
});

/** Reset all products and variants to available (for testing). Requires admin auth. */
app.post('/api/admin/reset-products-to-available', requireAuth, async (req, res) => {
  try {
    if (!database || !database.pool) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }
    const result = await database.resetAllProductsToAvailable();
    console.log('🔄 [Admin] Reset products to available:', result);
    res.json({
      success: true,
      message: 'All products and variants set to available',
      ...result
    });
  } catch (error) {
    console.error('Error resetting products to available:', error);
    res.status(500).json({ success: false, message: error.message || 'Error resetting products' });
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
