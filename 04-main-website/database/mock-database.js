// Mock database for local testing without PostgreSQL
class MockDatabase {
    constructor() {
        this.products = [
            {
                id: 1,
                name: "Amethyst Dream",
                description: "A stunning amethyst crystal planter that brings tranquility and spiritual energy to your space.",
                price: 119.99,
                image_url: "/images/amethyst-dream.jpg",
                qr_code: "http://192.168.18.19:3000/qr/1757970120318",
                nft_url: "https://opensea.io/assets/ethereum/0x...",
                status: "available",
                category: "premium",
                dimensions: "8\" x 6\" x 4\"",
                weight: "2.5 lbs",
                crystal_type: "Amethyst",
                rarity: "Rare",
                stock_quantity: 1,
                is_featured: false,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                id: 2,
                name: "Rose Quartz Harmony",
                description: "Embrace love and compassion with this beautiful rose quartz planter, perfect for your favorite succulents.",
                price: 99.99,
                image_url: "/images/rose-quartz-harmony.jpg",
                qr_code: "http://192.168.18.19:3000/qr/1757970380083",
                nft_url: "https://opensea.io/assets/ethereum/0x...",
                status: "available",
                category: "premium",
                dimensions: "7\" x 5\" x 3.5\"",
                weight: "2.1 lbs",
                crystal_type: "Rose Quartz",
                rarity: "Common",
                stock_quantity: 1,
                is_featured: false,
                created_at: new Date(),
                updated_at: new Date()
            }
        ];
        
        this.adminUsers = [
            {
                id: 1,
                username: "admin",
                password_hash: "$2a$10$KtGWhWtpuuskGKVkj9Lq6eJEVKcNLtCop11ofxZSi.3PVyHnv3i4u", // GemSpots2025!@#
                role: "admin",
                created_at: new Date(),
                updated_at: new Date()
            }
        ];
        
        this.nextId = 3;
        console.log('✅ Mock Database initialized with sample data');
    }

    async initializeTables() {
        // Mock implementation - no actual database setup needed
        return Promise.resolve();
    }

    // Product management methods
    async getAllProducts() {
        return [...this.products];
    }

    async getProductById(id) {
        return this.products.find(p => p.id === parseInt(id));
    }

    async addProduct(productData) {
        const newProduct = {
            id: this.nextId++,
            ...productData,
            created_at: new Date(),
            updated_at: new Date()
        };
        this.products.push(newProduct);
        return newProduct;
    }

    async updateProduct(id, productData) {
        const index = this.products.findIndex(p => p.id === parseInt(id));
        if (index === -1) {
            throw new Error('Product not found');
        }
        
        this.products[index] = {
            ...this.products[index],
            ...productData,
            updated_at: new Date()
        };
        
        return this.products[index];
    }

    async deleteProduct(id) {
        const index = this.products.findIndex(p => p.id === parseInt(id));
        if (index === -1) {
            throw new Error('Product not found');
        }
        
        return this.products.splice(index, 1)[0];
    }

    // Admin authentication methods
    async getAdminByUsername(username) {
        return this.adminUsers.find(u => u.username === username);
    }

    async updateAdminPassword(username, newPasswordHash) {
        const user = this.adminUsers.find(u => u.username === username);
        if (user) {
            user.password_hash = newPasswordHash;
            user.updated_at = new Date();
            return user;
        }
        return null;
    }

    async close() {
        // Mock implementation - no actual connection to close
        return Promise.resolve();
    }
}

module.exports = MockDatabase;
