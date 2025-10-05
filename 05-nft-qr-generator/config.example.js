// Configuration example for QR Generator
// Copy this file to config.js and update with your actual values

module.exports = {
    // Database Configuration
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://username:password@hostname:port/database',
    
    // JWT Secret for authentication
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-here',
    
    // Example for local development:
    // DATABASE_URL: 'postgresql://user:password@localhost:5432/gemstones_db'
};
