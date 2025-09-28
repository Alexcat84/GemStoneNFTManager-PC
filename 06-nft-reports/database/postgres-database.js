const { Pool } = require('pg');

class PostgresDatabase {
    constructor() {
        if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
            console.error('❌ [DATABASE] DATABASE_URL not found in environment variables');
            this.pool = null;
            return;
        }
        
        const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
        console.log('🔍 [DATABASE] DATABASE_URL found:', connectionString.substring(0, 50) + '...');
        
        try {
            // Parse PostgreSQL connection string manually - handle both postgres:// and postgresql://
            // Also handle query parameters like ?sslmode=require
            const match = connectionString.match(/^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/);
            
            if (!match) {
                throw new Error('Invalid PostgreSQL connection string format');
            }
            
            const [, , username, password, hostname, port, database] = match;
            
            console.log('🔍 [DATABASE] Parsed components:', {
                hostname,
                port: parseInt(port),
                database,
                username,
                hasPassword: !!password
            });
            
            this.pool = new Pool({
                host: hostname,
                port: parseInt(port),
                database: database,
                user: username,
                password: password,
                ssl: {
                    rejectUnauthorized: false,
                    require: true
                },
                connectionTimeoutMillis: 30000, // 30 seconds
                idleTimeoutMillis: 300000, // 5 minutes
                max: 2, // Maximum number of clients in the pool
                min: 0, // Minimum number of clients in the pool
                allowExitOnIdle: true, // Allow exit on idle
                keepAlive: false,
                keepAliveInitialDelayMillis: 0,
                statement_timeout: 30000, // 30 seconds
                query_timeout: 30000, // 30 seconds
                application_name: 'reports-system'
            });
            console.log('✅ [DATABASE] Pool created successfully with regex parsing');
        } catch (error) {
            console.error('❌ [DATABASE] Error creating pool:', error);
            console.error('❌ [DATABASE] Error details:', error.message);
            this.pool = null;
        }
        
        this.initializeTables();
    }

    async initializeTables() {
        if (!this.pool) {
            console.error('❌ [DATABASE] Cannot initialize tables - no database pool');
            return;
        }
        
        let client;
        let retries = 3;
        
        while (retries > 0) {
            try {
                console.log(`🔄 [DATABASE] Attempting to connect (${4-retries}/3)...`);
                client = await this.pool.connect();
                console.log('✅ [DATABASE] Connection established successfully');
                break;
            } catch (error) {
                retries--;
                console.error(`❌ [DATABASE] Connection attempt failed (${4-retries}/3):`, error.message);
                if (retries === 0) {
                    console.error('❌ [DATABASE] All connection attempts failed');
                    return; // Don't throw, just return
                }
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        try {
            console.log('✅ [DATABASE] PostgreSQL database initialized successfully');
        } catch (error) {
            console.error('❌ [DATABASE] Error initializing PostgreSQL database:', error);
            console.error('❌ [DATABASE] Error details:', error.message);
            console.error('❌ [DATABASE] Error stack:', error.stack);
        } finally {
            if (client) {
                try {
                    client.release();
                    console.log('✅ [DATABASE] Client released successfully');
                } catch (releaseError) {
                    console.error('❌ [DATABASE] Error releasing client:', releaseError.message);
                }
            }
        }
    }

    // Reports Methods - QR Codes
    async getAllQRs() {
        try {
            if (!this.pool) {
                console.log('⚠️ [REPORTS] Database not available, returning empty QR data');
                return [];
            }

            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT id, url, status, nft_url, estimated_ready_date, notes, created_at
                FROM qr_codes 
                ORDER BY created_at DESC
            `);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting QR codes for reports:', error);
            return [];
        }
    }

    // Reports Methods - Generated Codes
    async getAllGeneratedCodes() {
        try {
            if (!this.pool) {
                console.log('⚠️ [REPORTS] Database not available, returning empty codes data');
                return [];
            }

            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT gc.*, l.country, l.region
                FROM generated_codes gc
                LEFT JOIN locations l ON gc.location_id = l.id
                ORDER BY gc.generation_date DESC
            `);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting generated codes for reports:', error);
            return [];
        }
    }

    // Reports Methods - Products
    async getAllProducts() {
        try {
            if (!this.pool) {
                console.log('⚠️ [REPORTS] Database not available, returning empty products data');
                return [];
            }

            const client = await this.pool.connect();
            const result = await client.query(`
                SELECT id, name, price, status, image_urls, nft_url, nft_image_url,
                       description, crystal_type, rarity, category, dimensions, weight,
                       energy_properties, personality_target, is_featured, is_archived,
                       sold_date, created_at, updated_at
                FROM products 
                ORDER BY created_at DESC
            `);
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting products for reports:', error);
            return [];
        }
    }

    // Helper method to safely execute database operations
    async safeQuery(query, params = []) {
        if (!this.pool) {
            throw new Error('Database pool not available');
        }
        
        let client;
        try {
            client = await this.pool.connect();
            const result = await client.query(query, params);
            return result;
        } catch (error) {
            console.error('❌ [DATABASE] Query error:', error.message);
            throw error;
        } finally {
            if (client) {
                try {
                    client.release();
                } catch (releaseError) {
                    console.error('❌ [DATABASE] Error releasing client:', releaseError.message);
                }
            }
        }
    }

    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                console.log('✅ [DATABASE] Pool closed successfully');
            } catch (error) {
                console.error('❌ [DATABASE] Error closing pool:', error.message);
            }
        }
    }
}

module.exports = PostgresDatabase;
