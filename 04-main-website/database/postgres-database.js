const { Pool } = require('pg');

class PostgresDatabase {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        this.initializeTables();
    }

    async initializeTables() {
        const client = await this.pool.connect();
        try {
            // Create products table
            await client.query(`
                CREATE TABLE IF NOT EXISTS products (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    price DECIMAL(10,2) NOT NULL,
                    image_urls TEXT[], -- Array of image URLs
                    nft_url TEXT,
                    nft_image_url TEXT, -- NFT image
                    status VARCHAR(50) DEFAULT 'available',
                    category VARCHAR(100),
                    dimensions VARCHAR(100),
                    weight VARCHAR(50),
                    crystal_type VARCHAR(100), -- Custom crystal type
                    rarity VARCHAR(50),
                    energy_properties TEXT, -- Energy properties
                    personality_target TEXT, -- Target personality
                    stock_quantity INTEGER DEFAULT 1,
                    is_featured BOOLEAN DEFAULT false,
                    is_archived BOOLEAN DEFAULT false, -- For sold/archived products
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create admin users table
            await client.query(`
                CREATE TABLE IF NOT EXISTS admin_users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(20) DEFAULT 'admin',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Insert default admin if not exists
            const checkAdmin = await client.query('SELECT * FROM admin_users WHERE username = $1', ['admin']);
            if (checkAdmin.rows.length === 0) {
                const bcrypt = require('bcryptjs');
                const defaultPassword = process.env.ADMIN_PASSWORD_HASH || '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
                await client.query(
                    'INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3)',
                    ['admin', defaultPassword, 'admin']
                );
            }

            console.log('✅ Database tables initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing database:', error);
        } finally {
            client.release();
        }
    }

    // Product management methods
    async getAllProducts() {
        let client;
        let retries = 3;
        
        while (retries > 0) {
            try {
                client = await this.pool.connect();
                const result = await client.query('SELECT * FROM products ORDER BY created_at DESC');
                client.release();
                return result.rows;
            } catch (error) {
                if (client) {
                    try {
                        client.release();
                    } catch (releaseError) {
                        console.error('Error releasing client:', releaseError);
                    }
                }
                
                console.error(`Get all products attempt ${4 - retries} failed:`, error.message);
                
                if (retries === 1) {
                    throw new Error(`Failed to get all products after 3 attempts: ${error.message}`);
                }
                
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
    }

    async getFeaturedProducts() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM products WHERE is_featured = true AND is_archived = false ORDER BY created_at DESC');
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting featured products:', error);
            throw error;
        }
    }

    async getAvailableProducts() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM products WHERE status = \'available\' AND is_archived = false ORDER BY created_at DESC');
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting available products:', error);
            throw error;
        }
    }

    async getArchivedProducts() {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM products WHERE is_archived = true ORDER BY created_at DESC');
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting archived products:', error);
            throw error;
        }
    }

    async getProductById(id) {
        let client;
        let retries = 3;
        
        while (retries > 0) {
            try {
                client = await this.pool.connect();
                const result = await client.query('SELECT * FROM products WHERE id = $1', [id]);
                client.release();
                return result.rows[0];
            } catch (error) {
                if (client) {
                    try {
                        client.release();
                    } catch (releaseError) {
                        console.error('Error releasing client:', releaseError);
                    }
                }
                
                console.error(`Get product by ID attempt ${4 - retries} failed:`, error.message);
                
                if (retries === 1) {
                    throw new Error(`Failed to get product by ID after 3 attempts: ${error.message}`);
                }
                
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
    }

    async addProduct(productData) {
        let client;
        let retries = 3;
        
        while (retries > 0) {
            try {
                client = await this.pool.connect();
                const {
                    name, description, price, image_urls, nft_url, nft_image_url,
                    status, category, dimensions, weight, crystal_type, rarity,
                    energy_properties, personality_target, stock_quantity, is_featured, is_archived
                } = productData;

                const result = await client.query(`
                    INSERT INTO products (
                        name, description, price, image_urls, nft_url, nft_image_url,
                        status, category, dimensions, weight, crystal_type, rarity,
                        energy_properties, personality_target, stock_quantity, is_featured, is_archived
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    RETURNING id, created_at
                `, [
                    name, description, price, image_urls || [], nft_url, nft_image_url,
                    status || 'available', category, dimensions, weight, crystal_type, rarity,
                    energy_properties, personality_target, stock_quantity || 1, is_featured || false, is_archived || false
                ]);

                client.release();
                return result.rows[0];
            } catch (error) {
                if (client) {
                    try {
                        client.release();
                    } catch (releaseError) {
                        console.error('Error releasing client:', releaseError);
                    }
                }
                
                console.error(`Add product attempt ${4 - retries} failed:`, error.message);
                
                if (retries === 1) {
                    throw new Error(`Failed to add product after 3 attempts: ${error.message}`);
                }
                
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
    }

    async updateProduct(id, productData) {
        let client;
        let retries = 3;
        
        while (retries > 0) {
            try {
                client = await this.pool.connect();
                const {
                    name, description, price, image_urls, nft_url, nft_image_url,
                    status, category, dimensions, weight, crystal_type, rarity,
                    energy_properties, personality_target, stock_quantity, is_featured, is_archived
                } = productData;

                const result = await client.query(`
                    UPDATE products SET
                        name = $1, description = $2, price = $3, image_urls = $4,
                        nft_url = $5, nft_image_url = $6, status = $7, category = $8,
                        dimensions = $9, weight = $10, crystal_type = $11, rarity = $12,
                        energy_properties = $13, personality_target = $14, stock_quantity = $15, 
                        is_featured = $16, is_archived = $17, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $18
                    RETURNING *
                `, [
                    name, description, price, image_urls, nft_url, nft_image_url,
                    status, category, dimensions, weight, crystal_type, rarity,
                    energy_properties, personality_target, stock_quantity, is_featured, is_archived, id
                ]);

                client.release();
                return result.rows[0];
            } catch (error) {
                if (client) {
                    try {
                        client.release();
                    } catch (releaseError) {
                        console.error('Error releasing client:', releaseError);
                    }
                }
                
                console.error(`Update product attempt ${4 - retries} failed:`, error.message);
                
                if (retries === 1) {
                    throw new Error(`Failed to update product after 3 attempts: ${error.message}`);
                }
                
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
    }

    async deleteProduct(id) {
        let client;
        let retries = 3;
        
        while (retries > 0) {
            try {
                client = await this.pool.connect();
                const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
                client.release();
                return result.rows[0];
            } catch (error) {
                if (client) {
                    try {
                        client.release();
                    } catch (releaseError) {
                        console.error('Error releasing client:', releaseError);
                    }
                }
                
                console.error(`Delete product attempt ${4 - retries} failed:`, error.message);
                
                if (retries === 1) {
                    throw new Error(`Failed to delete product after 3 attempts: ${error.message}`);
                }
                
                retries--;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
    }

    // Admin authentication methods
    async getAdminByUsername(username) {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM admin_users WHERE username = $1', [username]);
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error getting admin by username:', error);
            throw error;
        }
    }

    async updateAdminPassword(username, newPasswordHash) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(
                'UPDATE admin_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2 RETURNING *',
                [newPasswordHash, username]
            );
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error updating admin password:', error);
            throw error;
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = PostgresDatabase;
