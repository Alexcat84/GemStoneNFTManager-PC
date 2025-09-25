const express = require('express'); // Updated v2
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const PostgresDatabase = require('./database/postgres-database');
const QRGenerator = require('./qr-generator/qr-generator');
const AdminAuth = require('./admin-panel/admin-auth');
const CodeGenerator = require('./code-generator/code-generator');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Vercel
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'admin-panel')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});
// Serve QR codes from database in Vercel, from files locally
if (process.env.VERCEL) {
  app.get('/qr-codes/:filename', async (req, res) => {
    try {
      const qrId = req.params.filename.replace('qr-', '').replace('.png', '');
      const qr = await qrGenerator.getQRById(qrId);
      
      if (qr && qr.qr_data) {
        res.setHeader('Content-Type', 'image/png');
        res.send(Buffer.from(qr.qr_data.split(',')[1], 'base64'));
      } else {
        res.status(404).send('QR code not found');
      }
    } catch (error) {
      console.error('Error serving QR code:', error);
      res.status(500).send('Error serving QR code');
    }
  });
} else {
  app.use('/qr-codes', express.static(path.join(__dirname, 'qr-codes')));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize database and services
let nftDatabase, qrGenerator, adminAuth, codeGenerator;

try {
  console.log('🔄 Initializing services...');
  nftDatabase = new PostgresDatabase();
  qrGenerator = new QRGenerator();
  adminAuth = new AdminAuth();
  codeGenerator = new CodeGenerator();
  console.log('✅ Services initialized successfully');
} catch (error) {
  console.error('❌ Error initializing services:', error);
  // Continue without services for now
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  console.log('Auth check - token:', token ? 'present' : 'missing');
  console.log('Auth check - URL:', req.url);
  
  if (!token) {
    console.log('No token provided');
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Token required' });
    } else {
      return res.redirect('/');
    }
  }
  
  const decoded = adminAuth.verifyToken(token);
  if (!decoded) {
    console.log('Invalid token');
    if (req.url.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    } else {
      return res.redirect('/');
    }
  }
  
  console.log('Token valid for user:', decoded.username);
  req.user = decoded;
  next();
};

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel', 'dashboard.html'));
});

// API Routes
app.post('/api/login', async (req, res) => {
  console.log('Login attempt:', req.body);
  try {
    const { username, password } = req.body;
    const token = await adminAuth.login(username, password);
    
    if (token) {
      console.log('Login successful for user:', username);
      res.json({ success: true, token: token.token, sessionId: token.sessionId, user: token.user });
    } else {
      console.log('Login failed for user:', username);
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Change password endpoint
app.post('/api/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Contraseña actual y nueva contraseña son requeridas' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    
    const success = await adminAuth.changePassword(req.user.username, oldPassword, newPassword);
    
    if (success) {
      res.json({ success: true, message: 'Contraseña cambiada exitosamente' });
    } else {
      res.status(400).json({ success: false, message: 'Contraseña actual incorrecta' });
    }
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

app.post('/api/qr/generate', async (req, res) => {
  try {
    const { url, status = 'ready', nft_url = null, estimated_ready_date = null, notes = null } = req.body;
    
    // Generate simple QR code
    const qrId = await qrGenerator.generateSimpleQR(url, status, nft_url, estimated_ready_date, notes);
    
    res.json({
      success: true,
      message: 'Código QR generado exitosamente',
      qrId
    });
  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({ success: false, message: 'Error al generar código QR' });
  }
});

app.get('/api/qrs', async (req, res) => {
  try {
    const qrs = await qrGenerator.getAllQRs();
    res.json({ success: true, qrs });
  } catch (error) {
    console.error('Error fetching QRs:', error);
    res.status(500).json({ success: false, message: 'Error al obtener códigos QR' });
  }
});

app.get('/api/qr/view/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const qrPath = path.join(__dirname, 'qr-codes', `qr-${qrId}.png`);
    
    if (fs.existsSync(qrPath)) {
      res.sendFile(qrPath);
    } else {
      res.status(404).json({ success: false, message: 'QR code not found' });
    }
  } catch (error) {
    console.error('Error serving QR:', error);
    res.status(500).json({ success: false, message: 'Error al obtener QR' });
  }
});

app.put('/api/qr/update/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const updates = req.body;
    
    const result = await qrGenerator.updateQRCode(qrId, updates);
    
    if (result.changes > 0) {
      res.json({ 
        success: true, 
        message: 'QR code actualizado exitosamente' 
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'QR code no encontrado' 
      });
    }
  } catch (error) {
    console.error('Error updating QR:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar QR' });
  }
});

app.get('/api/qr/details/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const qr = await qrGenerator.getQRById(qrId);
    
    if (qr) {
      res.json({ success: true, qr });
    } else {
      res.status(404).json({ success: false, message: 'QR code no encontrado' });
    }
  } catch (error) {
    console.error('Error getting QR details:', error);
    res.status(500).json({ success: false, message: 'Error al obtener detalles del QR' });
  }
});

// Smart redirect endpoint for QR codes
app.get('/qr/:qrId', async (req, res) => {
  try {
    const { qrId } = req.params;
    const qr = await qrGenerator.getQRById(qrId);
    
    if (!qr) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>QR Code Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #f5f7fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #dc3545; font-size: 1.2rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌ QR Code Not Found</div>
            <p>The QR code you scanned is not valid or has been removed.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Handle different statuses
    if (qr.status === 'ready') {
      // Direct redirect to the URL
      res.redirect(qr.url);
    } else if (qr.status === 'pending') {
      // Show pending page
      const estimatedDate = qr.estimated_ready_date ? new Date(qr.estimated_ready_date) : null;
      const now = new Date();
      const diffDays = estimatedDate ? Math.ceil((estimatedDate - now) / (1000 * 60 * 60 * 24)) : null;
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>NFT in Process - GemSpots</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #f5f7fa; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
            .title { color: #ffc107; font-size: 1.5rem; margin-bottom: 1rem; }
            .message { color: #666; margin-bottom: 1rem; }
            .countdown { color: #28a745; font-weight: bold; }
            .qr-id { color: #999; font-size: 0.9rem; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">⏳</div>
            <div class="title">NFT in Process</div>
            <div class="message">Your GemSpot is being crystalized and the NFT is being created.</div>
            ${diffDays !== null ? `
              <div class="countdown">
                ${diffDays > 0 ? `Ready in ${diffDays} days` : 
                  diffDays === 0 ? 'Ready today!' : 
                  `Overdue by ${Math.abs(diffDays)} days`}
              </div>
            ` : ''}
            <div class="qr-id">QR Code: ${qrId}</div>
          </div>
        </body>
        </html>
      `);
    } else if (qr.status === 'custom' && qr.nft_url) {
      // Redirect to custom NFT URL
      res.redirect(qr.nft_url);
    } else {
      // Fallback to original URL
      res.redirect(qr.url);
    }
  } catch (error) {
    console.error('Error handling QR redirect:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - GemSpots</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #f5f7fa; }
          .container { max-width: 500px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error { color: #dc3545; font-size: 1.2rem; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">⚠️ Error</div>
          <p>There was an error processing your QR code. Please try again later.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Code Generator API Routes
app.get('/api/locations', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Starting getAllLocations...');
    console.log('🔍 [DEBUG] Database pool exists:', !!nftDatabase.pool);
    
    const locations = await nftDatabase.getAllLocations();
    console.log('🔍 [DEBUG] Locations retrieved:', locations.length);
    console.log('🔍 [DEBUG] First few locations:', locations.slice(0, 3));
    
    res.json(locations);
  } catch (error) {
    console.error('❌ [ERROR] Error getting locations:', error);
    console.error('❌ [ERROR] Error stack:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting locations',
      error: error.message,
      stack: error.stack
    });
  }
});

app.post('/api/locations', requireAuth, async (req, res) => {
  try {
    const { country, region } = req.body;
    const result = await nftDatabase.addLocation(country, region);
    res.json({ success: true, location: result });
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ success: false, message: 'Error adding location' });
  }
});

app.get('/api/codes', requireAuth, async (req, res) => {
  try {
    const codes = await nftDatabase.getAllGeneratedCodes();
    res.json(codes);
  } catch (error) {
    console.error('Error getting codes:', error);
    res.status(500).json({ success: false, message: 'Error getting codes' });
  }
});

app.post('/api/codes/generate', requireAuth, async (req, res) => {
  try {
    const { gemstoneNames, locationId, month, year, notes } = req.body;
    
    // Get next correlative number
    const pieceNumber = await nftDatabase.getNextCorrelative(gemstoneNames, month, year);
    
    // Generate the code
    const fullCode = codeGenerator.generateCode(gemstoneNames, month, year, pieceNumber);
    const checksum = codeGenerator.generateChecksum(gemstoneNames.join(','), month, year, pieceNumber);
    
    // Generate gemstone codes
    const gemstoneCodes = gemstoneNames.map(name => codeGenerator.getGemstoneCode(name));
    
    // Prepare code data
    const codeData = {
      full_code: fullCode,
      gemstone_names: JSON.stringify(gemstoneNames),
      gemstone_codes: JSON.stringify(gemstoneCodes),
      location_id: locationId,
      piece_number: pieceNumber,
      month: month,
      year: year,
      checksum: checksum,
      notes: notes || ''
    };
    
    // Save to database
    const result = await nftDatabase.addGeneratedCode(codeData);
    
    res.json({
      success: true,
      message: 'Code generated successfully',
      fullCode,
      pieceNumber,
      gemstoneNames,
      ...result
    });
  } catch (error) {
    console.error('Error generating code:', error);
    res.status(500).json({ success: false, message: 'Error generating code' });
  }
});

app.get('/api/codes/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    const codes = await nftDatabase.searchGeneratedCodes(query);
    res.json(codes);
  } catch (error) {
    console.error('Error searching codes:', error);
    res.status(500).json({ success: false, message: 'Error searching codes' });
  }
});

app.delete('/api/codes/:codeId', requireAuth, async (req, res) => {
  try {
    const { codeId } = req.params;
    const result = await nftDatabase.deleteGeneratedCode(codeId);
    
    if (result.success) {
      res.json({ success: true, message: 'Code deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Code not found' });
    }
  } catch (error) {
    console.error('Error deleting code:', error);
    res.status(500).json({ success: false, message: 'Error deleting code' });
  }
});

// Website Admin API Routes
app.get('/api/admin/products', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [WEBSITE ADMIN] Loading products from database...');
    
    const products = await nftDatabase.getAllProducts();
    
    // Transform products to match frontend expectations
    const transformedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      status: product.status,
      image_url: product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : '/images/placeholder-gem.jpg',
      image_urls: product.image_urls || [], // Include full array for editing
      nft_image_url: product.nft_image_url || '', // Include NFT image URL
      nft_url: product.nft_url || '', // Include NFT URL
      description: product.description,
      crystal_type: product.crystal_type,
      rarity: product.rarity,
      category: product.category,
      dimensions: product.dimensions,
      weight: product.weight,
      energy_properties: product.energy_properties,
      personality_target: product.personality_target,
      is_featured: product.is_featured,
      is_archived: product.is_archived,
      created_at: product.created_at
    }));
    
    res.json({ success: true, products: transformedProducts });
  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).json({ success: false, message: 'Error loading products' });
  }
});

app.post('/api/admin/products', requireAuth, upload.fields([
  { name: 'images', maxCount: 4 },
  { name: 'nft_image', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('➕ [WEBSITE ADMIN] Creating new product...');
    console.log('📦 [DEBUG] Request body:', req.body);
    console.log('📦 [DEBUG] Request files:', req.files);
    
    // Process uploaded images
    let imageUrls = [];
    let nftImageUrl = null;
    
    if (req.files) {
      // Process product images
      if (req.files.images && req.files.images.length > 0) {
        imageUrls = req.files.images.map(file => {
          // For now, store as base64 data URLs (in production, upload to cloud storage)
          const base64 = file.buffer.toString('base64');
          return `data:${file.mimetype};base64,${base64}`;
        });
      }
      
      // Process NFT image
      if (req.files.nft_image && req.files.nft_image.length > 0) {
        const nftFile = req.files.nft_image[0];
        const base64 = nftFile.buffer.toString('base64');
        nftImageUrl = `data:${nftFile.mimetype};base64,${base64}`;
      }
    }
    
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
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
      is_archived: req.body.is_archived === 'true',
      image_urls: imageUrls,
      nft_url: req.body.nft_url,
      nft_image_url: nftImageUrl
    };
    
    console.log('📦 [DEBUG] Product data prepared:', productData);
    
    const newProduct = await nftDatabase.createProduct(productData);
    res.json({ success: true, product: newProduct, message: 'Product created successfully' });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, message: 'Error creating product' });
  }
});

app.put('/api/admin/products/:productId', requireAuth, upload.fields([
  { name: 'images', maxCount: 4 },
  { name: 'nft_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`✏️ [WEBSITE ADMIN] Updating product ${productId}...`);
    
    // Debug: Log all form data received
    console.log('🔄 [EDIT PRODUCT] Form data received:');
    console.log('🔄 [EDIT PRODUCT] req.body.existing_images:', req.body.existing_images);
    console.log('🔄 [EDIT PRODUCT] req.body.existing_nft_image:', req.body.existing_nft_image);
    console.log('🔄 [EDIT PRODUCT] req.body.existing_nft_url:', req.body.existing_nft_url);
    console.log('🔄 [EDIT PRODUCT] req.body.nft_url:', req.body.nft_url);
    
    // Get current product data from database for debugging
    try {
      const currentProduct = await nftDatabase.getProductById(productId);
      console.log('🔄 [EDIT PRODUCT] Current product from database:');
      console.log('🔄 [EDIT PRODUCT] Current image_urls:', currentProduct?.image_urls);
      console.log('🔄 [EDIT PRODUCT] Current nft_image_url:', currentProduct?.nft_image_url);
      console.log('🔄 [EDIT PRODUCT] Current nft_url:', currentProduct?.nft_url);
    } catch (error) {
      console.log('🔄 [EDIT PRODUCT] Error getting current product:', error.message);
    }
    
    // Process uploaded images
    let imageUrls = [];
    let nftImageUrl = null;
    
    if (req.files) {
      // Process product images
      if (req.files.images && req.files.images.length > 0) {
        imageUrls = req.files.images.map(file => {
          // For now, store as base64 data URLs (in production, upload to cloud storage)
          const base64 = file.buffer.toString('base64');
          return `data:${file.mimetype};base64,${base64}`;
        });
      }
      
      // Process NFT image
      if (req.files.nft_image && req.files.nft_image.length > 0) {
        const nftFile = req.files.nft_image[0];
        const base64 = nftFile.buffer.toString('base64');
        nftImageUrl = `data:${nftFile.mimetype};base64,${base64}`;
      }
    }
    
    // If no new images uploaded, keep existing ones
    if (imageUrls.length === 0 && req.body.existing_images) {
      try {
        imageUrls = JSON.parse(req.body.existing_images);
        console.log('🔄 [EDIT PRODUCT] Using existing images from form data');
        console.log('🔄 [EDIT PRODUCT] Parsed existing_images:', imageUrls);
      } catch (e) {
        console.log('Could not parse existing images:', e);
      }
    }
    
    if (!nftImageUrl && req.body.existing_nft_image) {
      nftImageUrl = req.body.existing_nft_image;
      console.log('🔄 [EDIT PRODUCT] Using existing NFT image from form data');
    }
    
    // Process NFT URL - preserve existing if not provided
    let nftUrl = req.body.nft_url;
    if (!nftUrl && req.body.existing_nft_url) {
      // Use existing NFT URL from form data
      nftUrl = req.body.existing_nft_url;
      console.log('🔄 [EDIT PRODUCT] Using existing NFT URL from form data');
    }
    
    console.log('🔄 [EDIT PRODUCT] Final imageUrls:', imageUrls);
    console.log('🔄 [EDIT PRODUCT] Final nftImageUrl:', nftImageUrl);
    console.log('🔄 [EDIT PRODUCT] Final nftUrl:', nftUrl);
    
    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: parseFloat(req.body.price),
      status: req.body.status,
      category: req.body.category,
      dimensions: req.body.dimensions,
      weight: req.body.weight,
      crystal_type: req.body.crystal_type,
      rarity: req.body.rarity,
      energy_properties: req.body.energy_properties,
      personality_target: req.body.personality_target,
      stock_quantity: parseInt(req.body.stock_quantity) || 1,
      is_featured: req.body.is_featured === 'true',
      is_archived: req.body.is_archived === 'true',
      image_urls: imageUrls,
      nft_url: nftUrl,
      nft_image_url: nftImageUrl
    };
    
    const updatedProduct = await nftDatabase.updateProduct(productId, productData);
    
    if (updatedProduct) {
      res.json({ success: true, product: updatedProduct, message: 'Product updated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, message: 'Error updating product' });
  }
});

app.delete('/api/admin/products/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🗑️ [WEBSITE ADMIN] Deleting product ${productId}...`);
    
    const deletedProduct = await nftDatabase.deleteProduct(productId);
    
    if (deletedProduct) {
      res.json({ success: true, message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Product not found' });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, message: 'Error deleting product' });
  }
});

// Product Variants API Routes
app.get('/api/products/:productId/variants', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`🔍 [WEBSITE ADMIN] Loading variants for product ${productId}...`);
    
    // For now, return empty array since we don't have variants implemented yet
    res.json({ success: true, variants: [] });
  } catch (error) {
    console.error('Error loading variants:', error);
    res.status(500).json({ success: false, message: 'Error loading variants' });
  }
});

app.post('/api/admin/products/:productId/variants', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`➕ [WEBSITE ADMIN] Creating variant for product ${productId}...`);
    
    // For now, return success since variants are not fully implemented
    res.json({ success: true, message: 'Variant created successfully' });
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({ success: false, message: 'Error creating variant' });
  }
});

app.delete('/api/admin/variants/:variantId', requireAuth, async (req, res) => {
  try {
    const { variantId } = req.params;
    console.log(`🗑️ [WEBSITE ADMIN] Deleting variant ${variantId}...`);
    
    // For now, return success since variants are not fully implemented
    res.json({ success: true, message: 'Variant deleted successfully' });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({ success: false, message: 'Error deleting variant' });
  }
});

// Diagnostic endpoint to check database status
app.get('/api/admin/db-status', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [DIAGNOSTIC] Checking database status...');
    
    const client = await nftDatabase.pool.connect();
    try {
      // Check if locations table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'locations'
        );
      `);
      
      // Check if generated_codes table exists
      const codesTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'generated_codes'
        );
      `);
      
      // Count locations
      const countResult = await client.query('SELECT COUNT(*) as count FROM locations');
      
      // Count generated codes
      const codesCountResult = await client.query('SELECT COUNT(*) as count FROM generated_codes');
      
      // Get sample locations
      const sampleResult = await client.query('SELECT * FROM locations LIMIT 5');
      
      // Get sample generated codes
      const sampleCodesResult = await client.query('SELECT * FROM generated_codes LIMIT 5');
      
      res.json({
        success: true,
        database: {
          locationsTableExists: tableCheck.rows[0].exists,
          codesTableExists: codesTableCheck.rows[0].exists,
          locationCount: parseInt(countResult.rows[0].count),
          codesCount: parseInt(codesCountResult.rows[0].count),
          sampleLocations: sampleResult.rows,
          sampleCodes: sampleCodesResult.rows
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ [DIAGNOSTIC ERROR]:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// Temporary endpoint to populate locations database
app.post('/api/admin/populate-locations', requireAuth, async (req, res) => {
  try {
    console.log('🔄 Attempting to populate locations...');
    const client = await nftDatabase.pool.connect();
    try {
      // Clear existing locations to ensure fresh insert
      await client.query('TRUNCATE TABLE locations RESTART IDENTITY CASCADE;');
      console.log('✅ Existing locations truncated.');

      // Insert all locations
      const locations = [
        // Canada
        ['Canada', 'Ontario'],
        ['Canada', 'British Columbia'],
        ['Canada', 'Quebec'],
        ['Canada', 'Alberta'],
        ['Canada', 'Manitoba'],
        ['Canada', 'Saskatchewan'],
        ['Canada', 'Nova Scotia'],
        ['Canada', 'New Brunswick'],
        ['Canada', 'Newfoundland and Labrador'],
        ['Canada', 'Prince Edward Island'],
        ['Canada', 'Northwest Territories'],
        ['Canada', 'Yukon'],
        ['Canada', 'Nunavut'],
        
        // United States
        ['United States', 'California'],
        ['United States', 'New York'],
        ['United States', 'Texas'],
        ['United States', 'Florida'],
        ['United States', 'Illinois'],
        ['United States', 'Pennsylvania'],
        ['United States', 'Ohio'],
        ['United States', 'Georgia'],
        ['United States', 'North Carolina'],
        ['United States', 'Michigan'],
        ['United States', 'New Jersey'],
        ['United States', 'Virginia'],
        ['United States', 'Washington'],
        ['United States', 'Arizona'],
        ['United States', 'Massachusetts'],
        ['United States', 'Tennessee'],
        ['United States', 'Indiana'],
        ['United States', 'Missouri'],
        ['United States', 'Maryland'],
        ['United States', 'Wisconsin'],
        ['United States', 'Colorado'],
        ['United States', 'Minnesota'],
        ['United States', 'South Carolina'],
        ['United States', 'Alabama'],
        ['United States', 'Louisiana'],
        ['United States', 'Kentucky'],
        ['United States', 'Oregon'],
        ['United States', 'Oklahoma'],
        ['United States', 'Connecticut'],
        ['United States', 'Utah'],
        ['United States', 'Iowa'],
        ['United States', 'Nevada'],
        ['United States', 'Arkansas'],
        ['United States', 'Mississippi'],
        ['United States', 'Kansas'],
        ['United States', 'New Mexico'],
        ['United States', 'Nebraska'],
        ['United States', 'West Virginia'],
        ['United States', 'Idaho'],
        ['United States', 'Hawaii'],
        ['United States', 'New Hampshire'],
        ['United States', 'Maine'],
        ['United States', 'Montana'],
        ['United States', 'Rhode Island'],
        ['United States', 'Delaware'],
        ['United States', 'South Dakota'],
        ['United States', 'North Dakota'],
        ['United States', 'Alaska'],
        ['United States', 'Vermont'],
        ['United States', 'Wyoming'],
        
        // Europe
        ['United Kingdom', 'England'],
        ['United Kingdom', 'Scotland'],
        ['United Kingdom', 'Wales'],
        ['United Kingdom', 'Northern Ireland'],
        ['France', 'Île-de-France'],
        ['France', 'Provence-Alpes-Côte d\'Azur'],
        ['France', 'Auvergne-Rhône-Alpes'],
        ['France', 'Occitanie'],
        ['France', 'Nouvelle-Aquitaine'],
        ['Germany', 'Bavaria'],
        ['Germany', 'Baden-Württemberg'],
        ['Germany', 'North Rhine-Westphalia'],
        ['Germany', 'Lower Saxony'],
        ['Germany', 'Hesse'],
        ['Spain', 'Madrid'],
        ['Spain', 'Catalonia'],
        ['Spain', 'Andalusia'],
        ['Spain', 'Valencia'],
        ['Italy', 'Lombardy'],
        ['Italy', 'Lazio'],
        ['Italy', 'Campania'],
        ['Italy', 'Sicily'],
        ['Netherlands', 'North Holland'],
        ['Netherlands', 'South Holland'],
        ['Netherlands', 'Utrecht'],
        ['Belgium', 'Flanders'],
        ['Belgium', 'Wallonia'],
        ['Switzerland', 'Zurich'],
        ['Switzerland', 'Bern'],
        ['Switzerland', 'Geneva'],
        ['Austria', 'Vienna'],
        ['Austria', 'Upper Austria'],
        ['Sweden', 'Stockholm'],
        ['Sweden', 'Västra Götaland'],
        ['Norway', 'Oslo'],
        ['Norway', 'Rogaland'],
        ['Denmark', 'Capital Region'],
        ['Finland', 'Uusimaa'],
        ['Poland', 'Masovian'],
        ['Poland', 'Silesian'],
        ['Czech Republic', 'Prague'],
        ['Hungary', 'Budapest'],
        ['Portugal', 'Lisbon'],
        ['Portugal', 'Porto'],
        ['Greece', 'Attica'],
        ['Ireland', 'Dublin'],
        ['Ireland', 'Cork'],
        
        // Asia
        ['Japan', 'Tokyo'],
        ['Japan', 'Osaka'],
        ['Japan', 'Aichi'],
        ['Japan', 'Fukuoka'],
        ['China', 'Beijing'],
        ['China', 'Shanghai'],
        ['China', 'Guangdong'],
        ['China', 'Jiangsu'],
        ['South Korea', 'Seoul'],
        ['South Korea', 'Busan'],
        ['South Korea', 'Incheon'],
        ['India', 'Maharashtra'],
        ['India', 'Delhi'],
        ['India', 'Karnataka'],
        ['India', 'Tamil Nadu'],
        ['Singapore', 'Singapore'],
        ['Hong Kong', 'Hong Kong'],
        ['Taiwan', 'Taipei'],
        ['Thailand', 'Bangkok'],
        ['Thailand', 'Chiang Mai'],
        ['Malaysia', 'Kuala Lumpur'],
        ['Malaysia', 'Selangor'],
        ['Indonesia', 'Jakarta'],
        ['Indonesia', 'East Java'],
        ['Philippines', 'Metro Manila'],
        ['Philippines', 'Cebu'],
        ['Vietnam', 'Ho Chi Minh City'],
        ['Vietnam', 'Hanoi'],
        ['Israel', 'Tel Aviv'],
        ['Israel', 'Jerusalem'],
        ['United Arab Emirates', 'Dubai'],
        ['United Arab Emirates', 'Abu Dhabi'],
        ['Saudi Arabia', 'Riyadh'],
        ['Saudi Arabia', 'Mecca'],
        ['Turkey', 'Istanbul'],
        ['Turkey', 'Ankara'],
        
        // Americas
        ['Mexico', 'Mexico City'],
        ['Mexico', 'Jalisco'],
        ['Mexico', 'Nuevo León'],
        ['Mexico', 'Puebla'],
        ['Brazil', 'São Paulo'],
        ['Brazil', 'Rio de Janeiro'],
        ['Brazil', 'Minas Gerais'],
        ['Brazil', 'Bahia'],
        ['Argentina', 'Buenos Aires'],
        ['Argentina', 'Córdoba'],
        ['Argentina', 'Santa Fe'],
        ['Chile', 'Santiago'],
        ['Chile', 'Valparaíso'],
        ['Colombia', 'Bogotá'],
        ['Colombia', 'Antioquia'],
        ['Peru', 'Lima'],
        ['Peru', 'Arequipa'],
        ['Venezuela', 'Caracas'],
        ['Venezuela', 'Zulia'],
        ['Ecuador', 'Pichincha'],
        ['Ecuador', 'Guayas'],
        ['Uruguay', 'Montevideo'],
        ['Paraguay', 'Asunción'],
        ['Bolivia', 'La Paz'],
        ['Bolivia', 'Santa Cruz'],
        
        // Oceania
        ['Australia', 'New South Wales'],
        ['Australia', 'Victoria'],
        ['Australia', 'Queensland'],
        ['Australia', 'Western Australia'],
        ['New Zealand', 'Auckland'],
        ['New Zealand', 'Wellington'],
        ['New Zealand', 'Canterbury'],
        
        // Africa
        ['South Africa', 'Gauteng'],
        ['South Africa', 'Western Cape'],
        ['South Africa', 'KwaZulu-Natal'],
        ['Egypt', 'Cairo'],
        ['Egypt', 'Alexandria'],
        ['Nigeria', 'Lagos'],
        ['Nigeria', 'Abuja'],
        ['Kenya', 'Nairobi'],
        ['Kenya', 'Mombasa'],
        ['Morocco', 'Casablanca'],
        ['Morocco', 'Rabat'],
        ['Tunisia', 'Tunis'],
        ['Algeria', 'Algiers'],
        ['Ghana', 'Greater Accra'],
        ['Ghana', 'Ashanti'],
        ['Ethiopia', 'Addis Ababa'],
        ['Tanzania', 'Dar es Salaam'],
        ['Uganda', 'Kampala'],
        ['Rwanda', 'Kigali'],
        ['Botswana', 'Gaborone'],
        ['Namibia', 'Windhoek'],
        ['Zimbabwe', 'Harare'],
        ['Zambia', 'Lusaka'],
        ['Mozambique', 'Maputo'],
        ['Angola', 'Luanda'],
        ['Senegal', 'Dakar'],
        ['Ivory Coast', 'Abidjan'],
        ['Cameroon', 'Douala'],
        ['Cameroon', 'Yaoundé'],
        ['Democratic Republic of Congo', 'Kinshasa'],
        ['Democratic Republic of Congo', 'Lubumbashi'],
        ['Madagascar', 'Antananarivo'],
        ['Mauritius', 'Port Louis'],
        ['Seychelles', 'Victoria'],
        ['Libya', 'Tripoli'],
        ['Sudan', 'Khartoum'],
        ['Chad', 'N\'Djamena'],
        ['Niger', 'Niamey'],
        ['Mali', 'Bamako'],
        ['Burkina Faso', 'Ouagadougou'],
        ['Guinea', 'Conakry'],
        ['Sierra Leone', 'Freetown'],
        ['Liberia', 'Monrovia'],
        ['Gambia', 'Banjul'],
        ['Guinea-Bissau', 'Bissau'],
        ['Cape Verde', 'Praia'],
        ['São Tomé and Príncipe', 'São Tomé'],
        ['Equatorial Guinea', 'Malabo'],
        ['Gabon', 'Libreville'],
        ['Republic of Congo', 'Brazzaville'],
        ['Central African Republic', 'Bangui'],
        ['Burundi', 'Bujumbura'],
        ['Malawi', 'Lilongwe'],
        ['Lesotho', 'Maseru'],
        ['Swaziland', 'Mbabane'],
        ['Comoros', 'Moroni'],
        ['Djibouti', 'Djibouti'],
        ['Eritrea', 'Asmara'],
        ['Somalia', 'Mogadishu'],
        ['South Sudan', 'Juba']
      ];

      for (const [country, region] of locations) {
        await client.query(
          'INSERT INTO locations (country, region) VALUES ($1, $2)',
          [country, region]
        );
      }
      
      console.log(`✅ ${locations.length} locations inserted successfully!`);
      res.json({ success: true, message: `${locations.length} locations populated successfully!` });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error populating locations:', error);
    res.status(500).json({ success: false, message: 'Error populating locations' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint no encontrado' });
});

app.listen(PORT, () => {
  console.log(`🚀 NFT QR Generator running on port ${PORT}`);
  console.log(`📱 Admin panel: http://localhost:${PORT}`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
});

module.exports = app;
