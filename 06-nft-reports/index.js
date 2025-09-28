const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const PostgresDatabase = require('./database/postgres-database');
const AdminAuth = require('./admin-panel/admin-auth');

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
app.use(express.static(path.join(__dirname, 'admin-panel')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize database and services
let nftDatabase, adminAuth;

try {
  console.log('🔄 Initializing services...');
  nftDatabase = new PostgresDatabase();
  adminAuth = new AdminAuth();
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

// Reports API Routes
app.get('/api/reports/qrs', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [REPORTS] Loading QR codes...');
    const qrs = await nftDatabase.getAllQRs();
    console.log('🔍 [REPORTS] QR codes loaded:', qrs.length);
    res.json({ success: true, qrs });
  } catch (error) {
    console.error('Error fetching QR reports:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes de QR' });
  }
});

app.get('/api/reports/codes', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [REPORTS] Loading generated codes...');
    const codes = await nftDatabase.getAllGeneratedCodes();
    console.log('🔍 [REPORTS] Generated codes loaded:', codes.length);
    res.json({ success: true, codes });
  } catch (error) {
    console.error('Error fetching codes reports:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes de códigos' });
  }
});

app.get('/api/reports/products', requireAuth, async (req, res) => {
  try {
    console.log('🔍 [REPORTS] Loading products...');
    const products = await nftDatabase.getAllProducts();
    console.log('🔍 [REPORTS] Products loaded:', products.length);
    res.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products reports:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes de productos' });
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

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ [UNCAUGHT EXCEPTION]:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [UNHANDLED REJECTION] at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

app.listen(PORT, () => {
  console.log(`🚀 NFT Reports System running on port ${PORT}`);
  console.log(`📊 Reports dashboard: http://localhost:${PORT}`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
});

module.exports = app;
