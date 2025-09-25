const { Pool } = require('pg');

class PostgresDatabase {
    constructor() {
        if (!process.env.DATABASE_URL) {
            console.error('❌ [DATABASE] DATABASE_URL not found in environment variables');
            this.pool = null;
            return;
        }
        
        console.log('🔍 [DATABASE] DATABASE_URL found:', process.env.DATABASE_URL.substring(0, 50) + '...');
        
        try {
            // Parse the connection string manually to avoid pg-connection-string issues
            const url = new URL(process.env.DATABASE_URL);
            
            console.log('🔍 [DATABASE] Parsed URL components:', {
                hostname: url.hostname,
                port: url.port || 5432,
                database: url.pathname.substring(1),
                username: url.username,
                hasPassword: !!url.password
            });
            
            this.pool = new Pool({
                host: url.hostname,
                port: url.port || 5432,
                database: url.pathname.substring(1), // Remove leading slash
                user: url.username,
                password: url.password,
                ssl: {
                    rejectUnauthorized: false
                },
                connectionTimeoutMillis: 10000, // 10 seconds
                idleTimeoutMillis: 30000, // 30 seconds
                max: 10 // Maximum number of clients in the pool
            });
            console.log('✅ [DATABASE] Pool created successfully with manual parsing');
        } catch (error) {
            console.error('❌ [DATABASE] Error creating pool:', error);
            console.error('❌ [DATABASE] Error details:', error.message);
            this.pool = null;
        }
        
        // Initialize tables with error handling
        this.initializeTables().catch(error => {
            console.error('❌ [DATABASE] Failed to initialize tables:', error.message);
        });
    }

    async initializeTables() {
        if (!this.pool) {
            console.error('❌ [DATABASE] Cannot initialize tables - no database pool');
            return;
        }
        
        let client;
        try {
            console.log('🔄 [DATABASE] Connecting to database...');
            client = await this.pool.connect();
            console.log('✅ [DATABASE] Connected to database successfully');
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

            // Create product variants table for individual NFT pots
            await client.query(`
                CREATE TABLE IF NOT EXISTS product_variants (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                    variant_code VARCHAR(100) UNIQUE NOT NULL, -- Unique code for this specific pot
                    nft_url TEXT,
                    nft_image_url TEXT,
                    qr_code_url TEXT,
                    status VARCHAR(50) DEFAULT 'available', -- available, reserved, sold
                    price DECIMAL(10,2), -- Override price if different from base product
                    notes TEXT, -- Any specific notes about this variant
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
            if (client) {
                client.release();
            }
        }
    }

    // Product management methods
    async getAllProducts() {
        if (!this.pool) {
            console.error('❌ [DATABASE] Cannot get products - no database pool');
            return [];
        }
        
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
        if (!this.pool) {
            console.error('❌ [DATABASE] Cannot get product by ID - no database pool');
            return null;
        }
        
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
        if (!this.pool) {
            console.error('❌ [DATABASE] Cannot update product - no database pool');
            throw new Error('Database not available');
        }
        
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

    async updateProductStatus(id, status) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(
                'UPDATE products SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [status, id]
            );
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error updating product status:', error);
            throw error;
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

    // Product Variants Management
    async addProductVariant(productId, variantData) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                INSERT INTO product_variants (
                    product_id, variant_code, nft_url, nft_image_url, 
                    qr_code_url, status, price, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                productId,
                variantData.variant_code,
                variantData.nft_url,
                variantData.nft_image_url,
                variantData.qr_code_url,
                variantData.status || 'available',
                variantData.price,
                variantData.notes
            ]);
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error adding product variant:', error);
            throw error;
        }
    }

    async getProductVariants(productId) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT * FROM product_variants 
                WHERE product_id = $1 
                ORDER BY created_at DESC
            `, [productId]);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting product variants:', error);
            return [];
        }
    }

    async getAvailableVariants(productId) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT * FROM product_variants 
                WHERE product_id = $1 AND status = 'available'
                ORDER BY created_at DESC
            `, [productId]);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting available variants:', error);
            return [];
        }
    }

    async updateVariantStatus(variantId, status) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                UPDATE product_variants 
                SET status = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `, [status, variantId]);
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error updating variant status:', error);
            throw error;
        }
    }

    async deleteProductVariant(variantId) {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                DELETE FROM product_variants 
                WHERE id = $1
                RETURNING *
            `, [variantId]);
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error deleting product variant:', error);
            throw error;
        }
    }

    // Get products with variant counts
    async getProductsWithVariantCounts() {
        try {
            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT 
                    p.*,
                    COUNT(pv.id) as total_variants,
                    COUNT(CASE WHEN pv.status = 'available' THEN 1 END) as available_variants,
                    COUNT(CASE WHEN pv.status = 'reserved' THEN 1 END) as reserved_variants,
                    COUNT(CASE WHEN pv.status = 'sold' THEN 1 END) as sold_variants
                FROM products p
                LEFT JOIN product_variants pv ON p.id = pv.product_id
                WHERE p.is_archived = false
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting products with variant counts:', error);
            return [];
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = PostgresDatabase;
