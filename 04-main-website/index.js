const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// API Routes for GemSpots data
app.get('/api/gemspots', (req, res) => {
  // Sample data - in production this would come from a database
  const gemspots = [
    {
      id: 1,
      name: "Amethyst Dream",
      description: "A stunning amethyst crystal planter that brings tranquility and spiritual energy to your space.",
      price: 119.99,
      image: "/images/amethyst-dream.jpg",
      qrCode: "http://192.168.18.19:3000/qr/1757970120318",
      nftUrl: "https://opensea.io/assets/ethereum/0x...",
      status: "ready",
      category: "premium",
      dimensions: "8\" x 6\" x 4\"",
      weight: "2.5 lbs",
      crystal: "Amethyst",
      rarity: "Rare"
    },
    {
      id: 2,
      name: "Rose Quartz Harmony",
      description: "Embrace love and compassion with this beautiful rose quartz planter, perfect for your favorite succulents.",
      price: 99.99,
      image: "/images/rose-quartz-harmony.jpg",
      qrCode: "http://192.168.18.19:3000/qr/1757970380083",
      nftUrl: "https://opensea.io/assets/ethereum/0x...",
      status: "ready",
      category: "premium",
      dimensions: "7\" x 5\" x 3.5\"",
      weight: "2.1 lbs",
      crystal: "Rose Quartz",
      rarity: "Common"
    },
    {
      id: 3,
      name: "Citrine Abundance",
      description: "Attract prosperity and success with this vibrant citrine crystal planter, a symbol of wealth and abundance.",
      price: 129.99,
      image: "/images/citrine-abundance.jpg",
      qrCode: "http://192.168.18.19:3000/qr/1757970576109",
      nftUrl: "https://opensea.io/assets/ethereum/0x...",
      status: "pending",
      category: "luxury",
      dimensions: "9\" x 7\" x 5\"",
      weight: "3.2 lbs",
      crystal: "Citrine",
      rarity: "Very Rare"
    },
    {
      id: 4,
      name: "Smoky Quartz Grounding",
      description: "Find balance and grounding with this powerful smoky quartz planter, perfect for meditation spaces.",
      price: 109.99,
      image: "/images/smoky-quartz-grounding.jpg",
      qrCode: "http://192.168.18.19:3000/qr/1757970893386",
      nftUrl: "https://opensea.io/assets/ethereum/0x...",
      status: "ready",
      category: "premium",
      dimensions: "8.5\" x 6.5\" x 4.5\"",
      weight: "2.8 lbs",
      crystal: "Smoky Quartz",
      rarity: "Uncommon"
    }
  ];
  
  res.json({ success: true, gemspots });
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
