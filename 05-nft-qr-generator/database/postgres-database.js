const { Pool } = require('pg');
const CodeGenerator = require('../src/utils/code-generator');

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
            // Parse PostgreSQL connection string manually
            const match = connectionString.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
            
            if (!match) {
                throw new Error('Invalid PostgreSQL connection string format');
            }
            
            const [, username, password, hostname, port, database] = match;
            
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
                    rejectUnauthorized: false
                },
                connectionTimeoutMillis: 10000,
                idleTimeoutMillis: 30000,
                max: 10
            });
            console.log('✅ [DATABASE] Pool created successfully with regex parsing');
        } catch (error) {
            console.error('❌ [DATABASE] Error creating pool:', error);
            console.error('❌ [DATABASE] Error details:', error.message);
            this.pool = null;
        }
        
        this.codeGenerator = new CodeGenerator();
        this.initializeTables();
    }

    async initializeTables() {
        if (!this.pool) {
            console.error('❌ [DATABASE] Cannot initialize tables - no database pool');
            return;
        }
        
        let client;
        try {
            client = await this.pool.connect();
            
            // Create tables
            await client.query(`
                CREATE TABLE IF NOT EXISTS nfts (
                    id SERIAL PRIMARY KEY,
                    opensea_url VARCHAR(500) NOT NULL,
                    nft_code VARCHAR(50) UNIQUE NOT NULL,
                    gemstone_names TEXT NOT NULL,
                    location_id INTEGER NOT NULL,
                    piece_number INTEGER NOT NULL,
                    checksum VARCHAR(10) NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS qr_codes (
                    id SERIAL PRIMARY KEY,
                    nft_id INTEGER NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    qr_data TEXT NOT NULL,
                    qr_image_path VARCHAR(255),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (nft_id) REFERENCES nfts(id)
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS locations (
                    id SERIAL PRIMARY KEY,
                    country VARCHAR(50) NOT NULL,
                    region VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create products table for Website Admin
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

            await client.query(`
                CREATE TABLE IF NOT EXISTS generated_codes (
                    id SERIAL PRIMARY KEY,
                    full_code VARCHAR(50) UNIQUE NOT NULL,
                    gemstone_names TEXT NOT NULL,
                    gemstone_codes TEXT NOT NULL,
                    location_id INTEGER NOT NULL,
                    piece_number INTEGER NOT NULL,
                    generation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    month INTEGER NOT NULL,
                    year INTEGER NOT NULL,
                    checksum VARCHAR(10) NOT NULL,
                    notes TEXT,
                    FOREIGN KEY (location_id) REFERENCES locations(id)
                )
            `);

            // Create indexes
            await client.query(`CREATE INDEX IF NOT EXISTS idx_nfts_nft_code ON nfts(nft_code)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_qr_codes_nft_id ON qr_codes(nft_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(type)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_generated_codes_full_code ON generated_codes(full_code)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_generated_codes_generation_date ON generated_codes(generation_date)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_generated_codes_month_year ON generated_codes(month, year)`);

            // Insert initial data
            await this.insertInitialData(client);
            
            console.log('PostgreSQL database initialized successfully');
        } catch (error) {
            console.error('Error initializing PostgreSQL database:', error);
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async insertInitialData(client) {
        const locations = [
            // Canada
            ['Canada', 'Ontario'],
            ['Canada', 'British Columbia'],
            ['Canada', 'Quebec'],
            ['Canada', 'Alberta'],
            ['Canada', 'Manitoba'],
            ['Canada', 'Saskatchewan'],
            ['Canada', 'Nova Scotia'],
            ['Canada', 'New Brunswick'],
            ['Canada', 'Newfoundland and Labrador'],
            ['Canada', 'Prince Edward Island'],
            ['Canada', 'Northwest Territories'],
            ['Canada', 'Yukon'],
            ['Canada', 'Nunavut'],
            
            // United States
            ['United States', 'California'],
            ['United States', 'New York'],
            ['United States', 'Texas'],
            ['United States', 'Florida'],
            ['United States', 'Illinois'],
            ['United States', 'Pennsylvania'],
            ['United States', 'Ohio'],
            ['United States', 'Georgia'],
            ['United States', 'North Carolina'],
            ['United States', 'Michigan'],
            ['United States', 'New Jersey'],
            ['United States', 'Virginia'],
            ['United States', 'Washington'],
            ['United States', 'Arizona'],
            ['United States', 'Massachusetts'],
            ['United States', 'Tennessee'],
            ['United States', 'Indiana'],
            ['United States', 'Missouri'],
            ['United States', 'Maryland'],
            ['United States', 'Wisconsin'],
            ['United States', 'Colorado'],
            ['United States', 'Minnesota'],
            ['United States', 'South Carolina'],
            ['United States', 'Alabama'],
            ['United States', 'Louisiana'],
            ['United States', 'Kentucky'],
            ['United States', 'Oregon'],
            ['United States', 'Oklahoma'],
            ['United States', 'Connecticut'],
            ['United States', 'Utah'],
            ['United States', 'Iowa'],
            ['United States', 'Nevada'],
            ['United States', 'Arkansas'],
            ['United States', 'Mississippi'],
            ['United States', 'Kansas'],
            ['United States', 'New Mexico'],
            ['United States', 'Nebraska'],
            ['United States', 'West Virginia'],
            ['United States', 'Idaho'],
            ['United States', 'Hawaii'],
            ['United States', 'New Hampshire'],
            ['United States', 'Maine'],
            ['United States', 'Montana'],
            ['United States', 'Rhode Island'],
            ['United States', 'Delaware'],
            ['United States', 'South Dakota'],
            ['United States', 'North Dakota'],
            ['United States', 'Alaska'],
            ['United States', 'Vermont'],
            ['United States', 'Wyoming'],
            
            // Brazil
            ['Brazil', 'São Paulo'],
            ['Brazil', 'Rio de Janeiro'],
            ['Brazil', 'Minas Gerais'],
            ['Brazil', 'Bahia'],
            ['Brazil', 'Paraná'],
            ['Brazil', 'Rio Grande do Sul'],
            ['Brazil', 'Pernambuco'],
            ['Brazil', 'Ceará'],
            ['Brazil', 'Pará'],
            ['Brazil', 'Santa Catarina'],
            ['Brazil', 'Goiás'],
            ['Brazil', 'Maranhão'],
            ['Brazil', 'Paraíba'],
            ['Brazil', 'Espírito Santo'],
            ['Brazil', 'Piauí'],
            ['Brazil', 'Alagoas'],
            ['Brazil', 'Tocantins'],
            ['Brazil', 'Rio Grande do Norte'],
            ['Brazil', 'Acre'],
            ['Brazil', 'Amapá'],
            ['Brazil', 'Amazonas'],
            ['Brazil', 'Rondônia'],
            ['Brazil', 'Roraima'],
            ['Brazil', 'Sergipe'],
            ['Brazil', 'Mato Grosso'],
            ['Brazil', 'Mato Grosso do Sul'],
            ['Brazil', 'Distrito Federal'],
            
            // Australia
            ['Australia', 'New South Wales'],
            ['Australia', 'Victoria'],
            ['Australia', 'Queensland'],
            ['Australia', 'Western Australia'],
            ['Australia', 'South Australia'],
            ['Australia', 'Tasmania'],
            ['Australia', 'Australian Capital Territory'],
            ['Australia', 'Northern Territory'],
            
            // Mexico
            ['Mexico', 'Mexico City'],
            ['Mexico', 'Jalisco'],
            ['Mexico', 'Nuevo León'],
            ['Mexico', 'Puebla'],
            ['Mexico', 'Guanajuato'],
            ['Mexico', 'Veracruz'],
            ['Mexico', 'Yucatán'],
            ['Mexico', 'Chihuahua'],
            ['Mexico', 'Michoacán'],
            ['Mexico', 'Oaxaca'],
            ['Mexico', 'Chiapas'],
            ['Mexico', 'Sonora'],
            ['Mexico', 'Coahuila'],
            ['Mexico', 'Tamaulipas'],
            ['Mexico', 'Sinaloa'],
            ['Mexico', 'Durango'],
            ['Mexico', 'San Luis Potosí'],
            ['Mexico', 'Zacatecas'],
            ['Mexico', 'Aguascalientes'],
            ['Mexico', 'Querétaro'],
            ['Mexico', 'Hidalgo'],
            ['Mexico', 'Tlaxcala'],
            ['Mexico', 'Morelos'],
            ['Mexico', 'Colima'],
            ['Mexico', 'Nayarit'],
            ['Mexico', 'Baja California'],
            ['Mexico', 'Baja California Sur'],
            ['Mexico', 'Campeche'],
            ['Mexico', 'Quintana Roo'],
            ['Mexico', 'Tabasco'],
            ['Mexico', 'Guerrero'],
            
            // United Kingdom
            ['United Kingdom', 'England'],
            ['United Kingdom', 'Scotland'],
            ['United Kingdom', 'Wales'],
            ['United Kingdom', 'Northern Ireland'],
            
            // Germany
            ['Germany', 'Bavaria'],
            ['Germany', 'Baden-Württemberg'],
            ['Germany', 'North Rhine-Westphalia'],
            ['Germany', 'Lower Saxony'],
            ['Germany', 'Hesse'],
            ['Germany', 'Saxony'],
            ['Germany', 'Rhineland-Palatinate'],
            ['Germany', 'Berlin'],
            ['Germany', 'Schleswig-Holstein'],
            ['Germany', 'Brandenburg'],
            ['Germany', 'Saxony-Anhalt'],
            ['Germany', 'Thuringia'],
            ['Germany', 'Hamburg'],
            ['Germany', 'Mecklenburg-Vorpommern'],
            ['Germany', 'Saarland'],
            ['Germany', 'Bremen'],
            
            // France
            ['France', 'Île-de-France'],
            ['France', 'Auvergne-Rhône-Alpes'],
            ['France', 'Hauts-de-France'],
            ['France', 'Occitanie'],
            ['France', 'Nouvelle-Aquitaine'],
            ['France', 'Grand Est'],
            ['France', 'Pays de la Loire'],
            ['France', 'Brittany'],
            ['France', 'Normandy'],
            ['France', 'Provence-Alpes-Côte d\'Azur'],
            ['France', 'Bourgogne-Franche-Comté'],
            ['France', 'Centre-Val de Loire'],
            ['France', 'Corsica'],
            
            // Japan
            ['Japan', 'Tokyo'],
            ['Japan', 'Osaka'],
            ['Japan', 'Aichi'],
            ['Japan', 'Fukuoka'],
            ['Japan', 'Hokkaido'],
            ['Japan', 'Hyogo'],
            ['Japan', 'Saitama'],
            ['Japan', 'Chiba'],
            ['Japan', 'Kanagawa'],
            ['Japan', 'Shizuoka'],
            ['Japan', 'Ibaraki'],
            ['Japan', 'Hiroshima'],
            ['Japan', 'Kyoto'],
            ['Japan', 'Niigata'],
            ['Japan', 'Miyagi'],
            ['Japan', 'Nagano'],
            ['Japan', 'Gifu'],
            ['Japan', 'Gunma'],
            ['Japan', 'Tochigi'],
            ['Japan', 'Okayama'],
            ['Japan', 'Kumamoto'],
            ['Japan', 'Kagoshima'],
            ['Japan', 'Mie'],
            ['Japan', 'Shiga'],
            ['Japan', 'Nara'],
            ['Japan', 'Wakayama'],
            ['Japan', 'Tottori'],
            ['Japan', 'Shimane'],
            ['Japan', 'Yamaguchi'],
            ['Japan', 'Tokushima'],
            ['Japan', 'Kagawa'],
            ['Japan', 'Ehime'],
            ['Japan', 'Kochi'],
            ['Japan', 'Saga'],
            ['Japan', 'Nagasaki'],
            ['Japan', 'Oita'],
            ['Japan', 'Miyazaki'],
            ['Japan', 'Kagawa'],
            ['Japan', 'Fukui'],
            ['Japan', 'Ishikawa'],
            ['Japan', 'Toyama'],
            ['Japan', 'Fukushima'],
            ['Japan', 'Yamagata'],
            ['Japan', 'Akita'],
            ['Japan', 'Iwate'],
            ['Japan', 'Aomori'],
            ['Japan', 'Okinawa']
        ];

        for (const [country, region] of locations) {
            await client.query(
                'INSERT INTO locations (country, region) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [country, region]
            );
        }
    }

    async generateNFTCode(gemstoneNames, month, year) {
        try {
            const client = await this.pool.connect();
            const gemstoneNamesStr = JSON.stringify(gemstoneNames);
            
            const result = await client.query(`
                SELECT MAX(piece_number) as max_number
                FROM nfts
                WHERE gemstone_names = $1 AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3
            `, [gemstoneNamesStr, month, year]);
            
            client.release();
            
            const nextNumber = (result.rows[0].max_number || 0) + 1;
            const fullCode = this.codeGenerator.generateCode(gemstoneNames, month, year, nextNumber);
            const checksum = this.codeGenerator.generateChecksum(gemstoneNames.join(','), month, year, nextNumber);
            
            return {
                fullCode,
                pieceNumber: nextNumber,
                checksum
            };
        } catch (error) {
            console.error('Error generating NFT code:', error);
            throw error;
        }
    }

    async createNFT(nftData) {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                INSERT INTO nfts (opensea_url, nft_code, gemstone_names, location_id, piece_number, checksum, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [
                nftData.opensea_url,
                nftData.nft_code,
                nftData.gemstone_names,
                nftData.location_id,
                nftData.piece_number,
                nftData.checksum,
                nftData.notes || ''
            ]);
            
            client.release();
            
            return { id: result.rows[0].id, ...nftData };
        } catch (error) {
            console.error('Error creating NFT:', error);
            throw error;
        }
    }

    async getAllNFTs() {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                SELECT n.*, l.country, l.region
                FROM nfts n
                LEFT JOIN locations l ON n.location_id = l.id
                ORDER BY n.created_at DESC
            `);
            
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting all NFTs:', error);
            throw error;
        }
    }

    async getNFTById(id) {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                SELECT n.*, l.country, l.region
                FROM nfts n
                LEFT JOIN locations l ON n.location_id = l.id
                WHERE n.id = $1
            `, [id]);
            
            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error getting NFT by ID:', error);
            throw error;
        }
    }

    async getAllLocations() {
        try {
            console.log('🔍 [DB DEBUG] getAllLocations called');
            console.log('🔍 [DB DEBUG] Pool exists:', !!this.pool);
            
            const client = await this.pool.connect();
            console.log('🔍 [DB DEBUG] Client connected successfully');
            
            const result = await client.query('SELECT * FROM locations ORDER BY country, region');
            console.log('🔍 [DB DEBUG] Query executed, rows:', result.rows.length);
            console.log('🔍 [DB DEBUG] First few rows:', result.rows.slice(0, 3));
            
            client.release();
            console.log('🔍 [DB DEBUG] Client released');
            return result.rows;
        } catch (error) {
            console.error('❌ [DB ERROR] Error getting all locations:', error);
            console.error('❌ [DB ERROR] Error stack:', error.stack);
            throw error;
        }
    }

    async getStats() {
        try {
            const client = await this.pool.connect();
            
            const totalNFTs = await client.query('SELECT COUNT(*) as total_nfts FROM nfts');
            
            const thisMonth = new Date().getMonth() + 1;
            const thisYear = new Date().getFullYear();
            
            const thisMonthNFTs = await client.query(`
                SELECT COUNT(*) as this_month_nfts FROM nfts 
                WHERE EXTRACT(MONTH FROM created_at) = $1 AND EXTRACT(YEAR FROM created_at) = $2
            `, [thisMonth, thisYear]);
            
            const gemstoneStats = await client.query(`
                SELECT gemstone_names, COUNT(*) as count
                FROM nfts
                GROUP BY gemstone_names
                ORDER BY count DESC
            `);
            
            client.release();
            
            return {
                totalNFTs: parseInt(totalNFTs.rows[0].total_nfts),
                thisMonthNFTs: parseInt(thisMonthNFTs.rows[0].this_month_nfts),
                gemstoneStats: gemstoneStats.rows
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            throw error;
        }
    }

    // Code Generator Methods
    async getAllGeneratedCodes() {
        try {
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
            console.error('Error getting generated codes:', error);
            throw error;
        }
    }

    async addGeneratedCode(codeData) {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                INSERT INTO generated_codes (
                    full_code, gemstone_names, gemstone_codes, location_id, 
                    piece_number, month, year, checksum, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id, generation_date
            `, [
                codeData.full_code,
                codeData.gemstone_names,
                codeData.gemstone_codes,
                codeData.location_id,
                codeData.piece_number,
                codeData.month,
                codeData.year,
                codeData.checksum,
                codeData.notes || ''
            ]);
            
            client.release();
            
            return {
                id: result.rows[0].id,
                generation_date: result.rows[0].generation_date,
                ...codeData
            };
        } catch (error) {
            console.error('Error adding generated code:', error);
            throw error;
        }
    }

    async getNextCorrelative(gemstoneNames, month, year) {
        try {
            const client = await this.pool.connect();
            const gemstoneNamesStr = JSON.stringify(gemstoneNames);
            
            const result = await client.query(`
                SELECT MAX(piece_number) as max_number
                FROM generated_codes
                WHERE gemstone_names = $1 AND month = $2 AND year = $3
            `, [gemstoneNamesStr, month, year]);
            
            client.release();
            
            return (result.rows[0].max_number || 0) + 1;
        } catch (error) {
            console.error('Error getting next correlative:', error);
            throw error;
        }
    }

    async searchGeneratedCodes(query) {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                SELECT gc.*, l.country, l.region
                FROM generated_codes gc
                LEFT JOIN locations l ON gc.location_id = l.id
                WHERE gc.full_code ILIKE $1 
                   OR gc.gemstone_names ILIKE $1 
                   OR gc.notes ILIKE $1
                ORDER BY gc.generation_date DESC
            `, [`%${query}%`]);
            
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error searching generated codes:', error);
            throw error;
        }
    }

    async deleteGeneratedCode(codeId) {
        try {
            const client = await this.pool.connect();
            
            // First check if the code exists
            const checkResult = await client.query(
                'SELECT id, full_code FROM generated_codes WHERE id = $1',
                [codeId]
            );
            
            if (checkResult.rows.length === 0) {
                client.release();
                return { success: false, message: 'Code not found' };
            }
            
            // Delete the code
            const deleteResult = await client.query(
                'DELETE FROM generated_codes WHERE id = $1',
                [codeId]
            );
            
            client.release();
            
            return {
                success: true,
                message: 'Code deleted successfully',
                deletedCode: checkResult.rows[0].full_code
            };
        } catch (error) {
            console.error('Error deleting generated code:', error);
            throw error;
        }
    }

    async addLocation(country, region) {
        try {
            const client = await this.pool.connect();
            
            const result = await client.query(`
                INSERT INTO locations (country, region)
                VALUES ($1, $2)
                RETURNING id, created_at
            `, [country, region]);
            
            client.release();
            
            return {
                id: result.rows[0].id,
                country,
                region,
                created_at: result.rows[0].created_at
            };
        } catch (error) {
            console.error('Error adding location:', error);
            throw error;
        }
    }

    // Product management methods for Website Admin
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

    async createProduct(productData) {
        try {
            const client = await this.pool.connect();
            const {
                name, description, price, image_urls, nft_url, nft_image_url,
                status, category, dimensions, weight, crystal_type, rarity,
                energy_properties, personality_target, stock_quantity,
                is_featured, is_archived
            } = productData;

            const result = await client.query(`
                INSERT INTO products (
                    name, description, price, image_urls, nft_url, nft_image_url,
                    status, category, dimensions, weight, crystal_type, rarity,
                    energy_properties, personality_target, stock_quantity,
                    is_featured, is_archived
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING *
            `, [
                name, description, price, image_urls, nft_url, nft_image_url,
                status, category, dimensions, weight, crystal_type, rarity,
                energy_properties, personality_target, stock_quantity,
                is_featured, is_archived
            ]);

            client.release();
            return result.rows[0];
        } catch (error) {
            console.error('Error creating product:', error);
            throw error;
        }
    }

    async updateProduct(id, productData) {
        try {
            const client = await this.pool.connect();
            const {
                name, description, price, image_urls, nft_url, nft_image_url,
                status, category, dimensions, weight, crystal_type, rarity,
                energy_properties, personality_target, stock_quantity,
                is_featured, is_archived
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
                energy_properties, personality_target, stock_quantity,
                is_featured, is_archived, id
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

    // Admin authentication method
    async authenticateAdmin(username, password) {
        try {
            if (!this.pool) {
                return { success: false, message: 'Database not available' };
            }

            const client = await this.pool.connect();
            const result = await client.query('SELECT * FROM admin_users WHERE username = $1', [username]);
            client.release();

            if (result.rows.length === 0) {
                return { success: false, message: 'Invalid credentials' };
            }

            const admin = result.rows[0];
            const bcrypt = require('bcryptjs');
            const isValidPassword = await bcrypt.compare(password, admin.password_hash);

            if (!isValidPassword) {
                return { success: false, message: 'Invalid credentials' };
            }

            // Generate a simple token (in production, use JWT)
            const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
            
            return { 
                success: true, 
                token: token,
                user: { username: admin.username, role: admin.role }
            };
        } catch (error) {
            console.error('Authentication error:', error);
            return { success: false, message: 'Authentication failed' };
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
        }
    }
}

module.exports = PostgresDatabase;

