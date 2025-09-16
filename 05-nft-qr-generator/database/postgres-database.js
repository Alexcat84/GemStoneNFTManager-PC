const { Pool } = require('pg');
const CodeGenerator = require('../src/utils/code-generator');

class PostgresDatabase {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        this.codeGenerator = new CodeGenerator();
        this.initializeTables();
    }

    async initializeTables() {
        try {
            const client = await this.pool.connect();
            
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

            // Create indexes
            await client.query(`CREATE INDEX IF NOT EXISTS idx_nfts_nft_code ON nfts(nft_code)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_qr_codes_nft_id ON qr_codes(nft_id)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(type)`);
            await client.query(`CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country)`);

            // Insert initial data
            await this.insertInitialData(client);
            
            client.release();
            console.log('PostgreSQL database initialized successfully');
        } catch (error) {
            console.error('Error initializing PostgreSQL database:', error);
        }
    }

    async insertInitialData(client) {
        const locations = [
            ['Canada', 'Ontario'],
            ['Canada', 'British Columbia'],
            ['Canada', 'Quebec'],
            ['United States', 'California'],
            ['United States', 'New York'],
            ['United States', 'Texas'],
            ['Brazil', 'São Paulo'],
            ['Brazil', 'Rio de Janeiro'],
            ['Brazil', 'Minas Gerais'],
            ['Australia', 'New South Wales'],
            ['Australia', 'Victoria'],
            ['Australia', 'Queensland']
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
            const client = await this.pool.connect();
            
            const result = await client.query('SELECT * FROM locations ORDER BY country, region');
            
            client.release();
            return result.rows;
        } catch (error) {
            console.error('Error getting all locations:', error);
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

    async close() {
        await this.pool.end();
    }
}

module.exports = PostgresDatabase;

