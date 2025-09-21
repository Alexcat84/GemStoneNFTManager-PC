const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;

// Configure Express for Vercel (trust proxy)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes for GemSpots data
app.get('/api/gemspots', async (req, res) => {
  try {
    // Mock data for now - you can replace this with actual database queries
    const gemspots = [
      {
        id: 1,
        name: "Premium Amethyst Planter",
        description: "Beautiful amethyst crystal planter with unique energy properties",
        price: 89.99,
        image: "/images/placeholder-gem.jpg",
        category: "premium",
        stock: 5
      },
      {
        id: 2,
        name: "Rose Quartz Planter",
        description: "Elegant rose quartz planter for love and harmony",
        price: 75.99,
        image: "/images/placeholder-gem.jpg",
        category: "standard",
        stock: 8
      },
      {
        id: 3,
        name: "Clear Quartz Planter",
        description: "Pure clear quartz planter for clarity and focus",
        price: 65.99,
        image: "/images/placeholder-gem.jpg",
        category: "standard",
        stock: 12
      }
    ];
    
    res.json({ success: true, products: gemspots });
  } catch (error) {
    console.error('Error fetching gemspots:', error);
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
});

// Newsletter subscription endpoint
app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    // Here you would typically save to database
    console.log('Newsletter subscription:', email);
    
    res.json({ success: true, message: 'Successfully subscribed to newsletter!' });
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    res.status(500).json({ success: false, message: 'Error subscribing to newsletter' });
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    // Here you would typically save to database or send email
    console.log('Contact form submission:', { name, email, message });
    
    res.json({ success: true, message: 'Thank you for your message! We will get back to you soon.' });
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ success: false, message: 'Error processing contact form' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
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
  });
}

// Export for Vercel
module.exports = app;
