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
            
            client.release();
            console.log('PostgreSQL database initialized successfully');
        } catch (error) {
            console.error('Error initializing PostgreSQL database:', error);
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

    async close() {
        await this.pool.end();
    }
}

module.exports = PostgresDatabase;

