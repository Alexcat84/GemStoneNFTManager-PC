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
                    image_url VARCHAR(500),
                    qr_code VARCHAR(500),
                    nft_url VARCHAR(500),
                    status VARCHAR(50) DEFAULT 'available',
                    category VARCHAR(100),
                    dimensions VARCHAR(100),
                    weight VARCHAR(50),
                    crystal_type VARCHAR(100),
                    rarity VARCHAR(50),
                    stock_quantity INTEGER DEFAULT 1,
                    is_featured BOOLEAN DEFAULT false,
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
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM products ORDER BY created_at DESC');
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting all products:', error);
            throw error;
        }
    }

    async getProductById(id) {
        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM products WHERE id = $1', [id]);
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error getting product by ID:', error);
            throw error;
        }
    }

    async addProduct(productData) {
        try {
            const client = await this.pool.connect();
            const {
                name, description, price, image_url, qr_code, nft_url,
                status, category, dimensions, weight, crystal_type, rarity,
                stock_quantity, is_featured
            } = productData;

            const result = await client.query(`
                INSERT INTO products (
                    name, description, price, image_url, qr_code, nft_url,
                    status, category, dimensions, weight, crystal_type, rarity,
                    stock_quantity, is_featured
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id, created_at
            `, [
                name, description, price, image_url, qr_code, nft_url,
                status, category, dimensions, weight, crystal_type, rarity,
                stock_quantity, is_featured
            ]);

            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error adding product:', error);
            throw error;
        }
    }

    async updateProduct(id, productData) {
        try {
            const client = await this.pool.connect();
            const {
                name, description, price, image_url, qr_code, nft_url,
                status, category, dimensions, weight, crystal_type, rarity,
                stock_quantity, is_featured
            } = productData;

            const result = await client.query(`
                UPDATE products SET
                    name = $1, description = $2, price = $3, image_url = $4,
                    qr_code = $5, nft_url = $6, status = $7, category = $8,
                    dimensions = $9, weight = $10, crystal_type = $11, rarity = $12,
                    stock_quantity = $13, is_featured = $14, updated_at = CURRENT_TIMESTAMP
                WHERE id = $15
                RETURNING *
            `, [
                name, description, price, image_url, qr_code, nft_url,
                status, category, dimensions, weight, crystal_type, rarity,
                stock_quantity, is_featured, id
            ]);

            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error updating product:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            const client = await this.pool.connect();
            const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error deleting product:', error);
            throw error;
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
