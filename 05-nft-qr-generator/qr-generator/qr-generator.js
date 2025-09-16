const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

class QRGenerator {
    constructor() {
        // In Vercel, we can't create local directories, so we'll skip this
        if (process.env.VERCEL) {
            this.qrCodesDir = '/tmp/qr-codes';
        } else {
            this.qrCodesDir = path.join(__dirname, '..', 'qr-codes');
            this.ensureDirectoryExists();
        }
        this.initializeDatabase();
    }

    async ensureDirectoryExists() {
        if (!process.env.VERCEL && !fs.existsSync(this.qrCodesDir)) {
            fs.mkdirSync(this.qrCodesDir, { recursive: true });
        }
    }

    initializeDatabase() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        this.createTable();
    }

    async createTable() {
        const client = await this.pool.connect();
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS qr_codes (
                    id SERIAL PRIMARY KEY,
                    qr_id VARCHAR(50) UNIQUE NOT NULL,
                    url TEXT NOT NULL,
                    status VARCHAR(20) DEFAULT 'ready',
                    nft_url TEXT,
                    estimated_ready_date TIMESTAMP WITH TIME ZONE,
                    notes TEXT,
                    qr_data TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `;

            await client.query(createTableQuery);
            
            // Add qr_data column if it doesn't exist (for existing tables)
            try {
                await client.query('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS qr_data TEXT');
            } catch (err) {
                // Column might already exist, ignore error
            }
            
            console.log('QR codes table ready');
        } catch (err) {
            console.error('Error creating qr_codes table:', err);
        } finally {
            client.release();
        }
    }

    async generateSimpleQR(url, status = 'ready', nft_url = null, estimated_ready_date = null, notes = null) {
        try {
            const qrId = Date.now().toString();
            const fileName = `qr-${qrId}.png`;
            
            // In Vercel, we'll generate QR as base64 and store in database
            // Generate QR code that points to our smart redirect endpoint
            const qrUrl = `https://qr-generator-nine-delta.vercel.app/qr/${qrId}`;
            
            let qrCodeData;
            if (process.env.VERCEL) {
                // Generate QR as base64 for Vercel
                qrCodeData = await QRCode.toDataURL(qrUrl, {
                    width: 1024,
                    margin: 4,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    },
                    errorCorrectionLevel: 'H'
                });
            } else {
                // Generate QR as file for local development
                const filePath = path.join(this.qrCodesDir, fileName);
                await QRCode.toFile(filePath, qrUrl, {
                    width: 1024,
                    margin: 4,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    },
                    errorCorrectionLevel: 'H'
                });
            }

            // Store QR info in database
            const client = await this.pool.connect();
            try {
                const sql = `
                    INSERT INTO qr_codes (qr_id, url, status, nft_url, estimated_ready_date, notes, qr_data)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING qr_id
                `;
                
                const result = await client.query(sql, [qrId, url, status, nft_url, estimated_ready_date, notes, qrCodeData]);
                return result.rows[0].qr_id;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw error;
        }
    }

    async getAllQRs() {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT qr_id as id, url, status, nft_url, estimated_ready_date, notes, qr_data, created_at,
                       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as timestamp
                FROM qr_codes 
                ORDER BY created_at DESC
            `);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getQRById(qrId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT qr_id as id, url, status, nft_url, estimated_ready_date, notes, qr_data, created_at,
                       to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as timestamp
                FROM qr_codes 
                WHERE qr_id = $1
            `, [qrId]);
            return result.rows[0];
        } finally {
            client.release();
        }
    }

    async updateQRCode(qrId, updates) {
        const client = await this.pool.connect();
        try {
            const { url, status, nft_url, estimated_ready_date, notes } = updates;
            
            const sql = `
                UPDATE qr_codes 
                SET url = $1, status = $2, nft_url = $3, estimated_ready_date = $4, notes = $5
                WHERE qr_id = $6
            `;
            
            const result = await client.query(sql, [url, status, nft_url, estimated_ready_date, notes, qrId]);
            return { changes: result.rowCount };
        } finally {
            client.release();
        }
    }
}

module.exports = QRGenerator;