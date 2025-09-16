const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const CodeGenerator = require('../src/utils/code-generator');

class NFTDatabase {
    constructor() {
        const dbPath = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'), 'GemStoneNFTManager', 'nft_codes.db');
        
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.codeGenerator = new CodeGenerator();
        this.initializeTables();
    }

    initializeTables() {
        const tableQueries = [
            `CREATE TABLE IF NOT EXISTS nfts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                opensea_url VARCHAR(500) NOT NULL,
                nft_code VARCHAR(50) UNIQUE NOT NULL,
                gemstone_names TEXT NOT NULL,
                location_id INTEGER NOT NULL,
                piece_number INTEGER NOT NULL,
                checksum VARCHAR(10) NOT NULL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS qr_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nft_id INTEGER NOT NULL,
                type VARCHAR(20) NOT NULL,
                qr_data TEXT NOT NULL,
                qr_image_path VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (nft_id) REFERENCES nfts(id)
            )`,
            `CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                country VARCHAR(50) NOT NULL,
                region VARCHAR(100) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        let tablesCompleted = 0;
        tableQueries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                }
                tablesCompleted++;
                if (tablesCompleted === tableQueries.length) {
                    this.createIndexes();
                }
            });
        });
    }

    createIndexes() {
        const indexQueries = [
            `CREATE INDEX IF NOT EXISTS idx_nfts_nft_code ON nfts(nft_code)`,
            `CREATE INDEX IF NOT EXISTS idx_nfts_created_at ON nfts(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_qr_codes_nft_id ON qr_codes(nft_id)`,
            `CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(type)`,
            `CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country)`
        ];

        let indexesCompleted = 0;
        indexQueries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('Error creating index:', err);
                }
                indexesCompleted++;
                if (indexesCompleted === indexQueries.length) {
                    this.insertInitialData();
                }
            });
        });
    }

    insertInitialData() {
        // Insert default locations if they don't exist
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

        locations.forEach(([country, region]) => {
            this.db.run(
                'INSERT OR IGNORE INTO locations (country, region) VALUES (?, ?)',
                [country, region],
                (err) => {
                    if (err) {
                        console.error('Error inserting location:', err);
                    }
                }
            );
        });
    }

    async generateNFTCode(gemstoneNames, month, year) {
        return new Promise((resolve, reject) => {
            const gemstoneNamesStr = JSON.stringify(gemstoneNames);
            this.db.get(`
                SELECT MAX(piece_number) as max_number
                FROM nfts
                WHERE gemstone_names = ? AND strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?
            `, [gemstoneNamesStr, month.toString().padStart(2, '0'), year.toString()], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    const nextNumber = (row.max_number || 0) + 1;
                    const fullCode = this.codeGenerator.generateCode(gemstoneNames, month, year, nextNumber);
                    const checksum = this.codeGenerator.generateChecksum(gemstoneNames.join(','), month, year, nextNumber);
                    
                    resolve({
                        fullCode,
                        pieceNumber: nextNumber,
                        checksum
                    });
                }
            });
        });
    }

    async createNFT(nftData) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO nfts (opensea_url, nft_code, gemstone_names, location_id, piece_number, checksum, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                nftData.opensea_url,
                nftData.nft_code,
                nftData.gemstone_names,
                nftData.location_id,
                nftData.piece_number,
                nftData.checksum,
                nftData.notes || ''
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...nftData });
                }
            });
        });
    }

    async getAllNFTs() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT n.*, l.country, l.region
                FROM nfts n
                LEFT JOIN locations l ON n.location_id = l.id
                ORDER BY n.created_at DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getNFTById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT n.*, l.country, l.region
                FROM nfts n
                LEFT JOIN locations l ON n.location_id = l.id
                WHERE n.id = ?
            `, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getAllLocations() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM locations ORDER BY country, region', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getStats() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT COUNT(*) as totalNFTs FROM nfts', (err, totalNFTs) => {
                if (err) {
                    reject(err);
                    return;
                }

                const thisMonth = new Date().getMonth() + 1;
                const thisYear = new Date().getFullYear();
                
                this.db.get(`
                    SELECT COUNT(*) as thisMonthNFTs FROM nfts 
                    WHERE strftime('%m', created_at) = ? AND strftime('%Y', created_at) = ?
                `, [thisMonth.toString().padStart(2, '0'), thisYear.toString()], (err, thisMonthNFTs) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    this.db.all(`
                        SELECT gemstone_names, COUNT(*) as count
                        FROM nfts
                        GROUP BY gemstone_names
                        ORDER BY count DESC
                    `, (err, gemstoneStats) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        resolve({
                            totalNFTs: totalNFTs.totalNFTs,
                            thisMonthNFTs: thisMonthNFTs.thisMonthNFTs,
                            gemstoneStats: gemstoneStats
                        });
                    });
                });
            });
        });
    }
}

module.exports = NFTDatabase;