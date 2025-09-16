const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

class QRGenerator {
    constructor() {
        this.qrCodesDir = path.join(__dirname, '..', 'qr-codes');
        this.ensureDirectoryExists();
        this.initializeDatabase();
    }

    async ensureDirectoryExists() {
        if (!fs.existsSync(this.qrCodesDir)) {
            fs.mkdirSync(this.qrCodesDir, { recursive: true });
        }
    }

    initializeDatabase() {
        const dbPath = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'), 'GemStoneNFTManager', 'qr_codes.db');
        
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath);
        this.createTable();
    }

    createTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS qr_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                qr_id TEXT UNIQUE NOT NULL,
                url TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'ready',
                nft_url TEXT,
                estimated_ready_date DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(createTableQuery, (err) => {
            if (err) {
                console.error('Error creating qr_codes table:', err);
            } else {
                console.log('QR codes table ready');
            }
        });
    }

    async generateSimpleQR(url, status = 'ready', nft_url = null, estimated_ready_date = null, notes = null) {
        try {
            const qrId = Date.now().toString();
            const fileName = `qr-${qrId}.png`;
            const filePath = path.join(this.qrCodesDir, fileName);
            
            // Generate QR code that points to our smart redirect endpoint
            const qrUrl = `http://192.168.18.19:3000/qr/${qrId}`;
            
            // Generate QR code in HD
            await QRCode.toFile(filePath, qrUrl, {
                width: 1024,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'H'
            });

            // Store QR info in database
            return new Promise((resolve, reject) => {
                const sql = `
                    INSERT INTO qr_codes (qr_id, url, status, nft_url, estimated_ready_date, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                this.db.run(sql, [qrId, url, status, nft_url, estimated_ready_date, notes], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(qrId);
                    }
                });
            });
        } catch (error) {
            console.error('Error generating QR code:', error);
            throw error;
        }
    }

    async getAllQRs() {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT qr_id as id, url, status, nft_url, estimated_ready_date, notes, created_at,
                       datetime(created_at, 'localtime') as timestamp
                FROM qr_codes 
                ORDER BY created_at DESC
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getQRById(qrId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT qr_id as id, url, status, nft_url, estimated_ready_date, notes, created_at,
                       datetime(created_at, 'localtime') as timestamp
                FROM qr_codes 
                WHERE qr_id = ?
            `, [qrId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateQRCode(qrId, updates) {
        return new Promise((resolve, reject) => {
            const { url, status, nft_url, estimated_ready_date, notes } = updates;
            
            const sql = `
                UPDATE qr_codes 
                SET url = ?, status = ?, nft_url = ?, estimated_ready_date = ?, notes = ?
                WHERE qr_id = ?
            `;
            
            this.db.run(sql, [url, status, nft_url, estimated_ready_date, notes, qrId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }
}

module.exports = QRGenerator;