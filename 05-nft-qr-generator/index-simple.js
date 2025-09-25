console.log('🚀 Starting simple QR Generator server...');

const express = require('express');
console.log('✅ Express loaded');

const path = require('path');
console.log('✅ Path loaded');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('✅ App created');

// Basic middleware
app.use(express.json());
app.use(express.static('admin-panel'));

console.log('✅ Middleware configured');

// Basic routes
app.get('/', (req, res) => {
  console.log('📝 Root route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  console.log('📝 Dashboard route accessed');
  res.sendFile(path.join(__dirname, 'admin-panel', 'dashboard.html'));
});

// Mock API routes
app.post('/api/login', (req, res) => {
  console.log('📝 Login API accessed');
  res.json({ success: true, token: 'mock-token' });
});

app.get('/api/nfts', (req, res) => {
  console.log('📝 NFTs API accessed');
  res.json({ success: true, nfts: [] });
});

app.get('/api/locations', (req, res) => {
  console.log('📝 Locations API accessed');
  res.json({ success: true, locations: [] });
});

console.log('✅ Routes configured');

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

console.log('✅ Server startup initiated');

module.exports = app;
