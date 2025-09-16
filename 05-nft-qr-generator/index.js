const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const PostgresDatabase = require('./database/postgres-database');
const QRGenerator = require('./qr-generator/qr-generator');
const AdminAuth = require('./admin-panel/admin-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// app.use(helmet({
//   contentSecurityPolicy: false
// }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'admin-panel')));
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
const nftDatabase = new PostgresDatabase();
const qrGenerator = new QRGenerator();
const adminAuth = new AdminAuth();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  console.log('Auth check - token:', token ? 'present' : 'missing');
  
  if (!token) {
    console.log('No token provided, redirecting to login');
    return res.redirect('/');
  }
  
  const decoded = adminAuth.verifyToken(token);
  if (!decoded) {
    console.log('Invalid token, redirecting to login');
    return res.redirect('/');
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Error interno del servidor' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint no encontrado' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 NFT QR Generator running on port ${PORT}`);
  console.log(`📱 Admin panel: http://localhost:${PORT}`);
  console.log(`🔗 API endpoints: http://localhost:${PORT}/api`);
});

module.exports = app;
