const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AdminAuth {
    constructor() {
        this.secretKey = process.env.JWT_SECRET || 'GemSpots2025!@#QRGenerator$%^&()+{}|:<>?[]\\;\',./~-=_+{}|:<>?[]\\;\',./~-=_';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessions = new Map();
        
        // Initialize database connection for admin credentials
        this.initializeDatabase();
        
        console.log('AdminAuth initialized with JWT_SECRET:', this.secretKey ? 'SET' : 'NOT SET');
    }

    initializeDatabase() {
        const { Pool } = require('pg');
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
        this.createAdminTable();
    }

    async createAdminTable() {
        const client = await this.pool.connect();
        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS admin_users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role VARCHAR(20) DEFAULT 'admin',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `;

            await client.query(createTableQuery);
            
            // Insert default admin if not exists
            const checkAdmin = await client.query('SELECT * FROM admin_users WHERE username = $1', ['admin']);
            if (checkAdmin.rows.length === 0) {
                const defaultPassword = process.env.ADMIN_PASSWORD_HASH || '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
                await client.query(
                    'INSERT INTO admin_users (username, password_hash, role) VALUES ($1, $2, $3)',
                    ['admin', defaultPassword, 'admin']
                );
                console.log('Default admin user created');
            }
            
            console.log('Admin users table ready');
        } catch (err) {
            console.error('Error creating admin_users table:', err);
        } finally {
            client.release();
        }
    }

    async hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }

    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    generateToken(user) {
        const payload = {
            id: user.id || 1,
            username: user.username,
            role: user.role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
        };
        
        return jwt.sign(payload, this.secretKey);
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            return null;
        }
    }

    async login(username, password) {
        try {
            console.log('Login attempt:', { username, passwordLength: password ? password.length : 0 });
            
            // Get user from database
            const client = await this.pool.connect();
            let user;
            try {
                const result = await client.query('SELECT * FROM admin_users WHERE username = $1', [username]);
                if (result.rows.length === 0) {
                    console.log('User not found:', username);
                    return null;
                }
                user = result.rows[0];
            } finally {
                client.release();
            }

            // Verify password
            const isValidPassword = await this.verifyPassword(password, user.password_hash);
            console.log('Password verification result:', isValidPassword);
            if (!isValidPassword) {
                console.log('Invalid password for user:', username);
                return null;
            }

            // Generate token
            const token = this.generateToken(user);
            
            // Store session
            const sessionId = crypto.randomUUID();
            this.sessions.set(sessionId, {
                userId: 1,
                username: username,
                role: 'admin',
                loginTime: new Date(),
                lastActivity: new Date(),
                token: token
            });

            return {
                token: token,
                sessionId: sessionId,
                user: {
                    id: 1,
                    username: username,
                    role: 'admin'
                }
            };
        } catch (error) {
            console.error('Error in login:', error);
            return null;
        }
    }

    async logout(sessionId) {
        try {
            if (this.sessions.has(sessionId)) {
                this.sessions.delete(sessionId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error in logout:', error);
            return false;
        }
    }

    async validateSession(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                return null;
            }

            // Check if session has expired
            const now = new Date();
            const timeSinceLastActivity = now - session.lastActivity;
            
            if (timeSinceLastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
                return null;
            }

            // Update last activity
            session.lastActivity = now;
            this.sessions.set(sessionId, session);

            return session;
        } catch (error) {
            console.error('Error validating session:', error);
            return null;
        }
    }

    async validateToken(token) {
        try {
            const decoded = this.verifyToken(token);
            if (!decoded) {
                return null;
            }

            // Check if token is expired
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp < now) {
                return null;
            }

            return decoded;
        } catch (error) {
            console.error('Error validating token:', error);
            return null;
        }
    }

    async refreshToken(sessionId) {
        try {
            const session = this.sessions.get(sessionId);
            if (!session) {
                return null;
            }

            // Generate new token
            const newToken = this.generateToken({
                id: session.userId,
                username: session.username,
                role: session.role
            });

            // Update session
            session.token = newToken;
            session.lastActivity = new Date();
            this.sessions.set(sessionId, session);

            return newToken;
        } catch (error) {
            console.error('Error refreshing token:', error);
            return null;
        }
    }

    async changePassword(username, oldPassword, newPassword) {
        try {
            // Get user from database
            const client = await this.pool.connect();
            let user;
            try {
                const result = await client.query('SELECT * FROM admin_users WHERE username = $1', [username]);
                if (result.rows.length === 0) {
                    return false;
                }
                user = result.rows[0];
            } finally {
                client.release();
            }

            // Verify old password
            const isValidPassword = await this.verifyPassword(oldPassword, user.password_hash);
            if (!isValidPassword) {
                return false;
            }

            // Hash new password
            const hashedNewPassword = await this.hashPassword(newPassword);
            
            // Update password in database
            const updateClient = await this.pool.connect();
            try {
                await updateClient.query(
                    'UPDATE admin_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2',
                    [hashedNewPassword, username]
                );
                console.log('Password updated successfully for user:', username);
                return true;
            } finally {
                updateClient.release();
            }
        } catch (error) {
            console.error('Error changing password:', error);
            return false;
        }
    }

    async getActiveSessions() {
        try {
            const activeSessions = [];
            for (const [sessionId, session] of this.sessions) {
                activeSessions.push({
                    sessionId: sessionId,
                    username: session.username,
                    role: session.role,
                    loginTime: session.loginTime,
                    lastActivity: session.lastActivity
                });
            }
            return activeSessions;
        } catch (error) {
            console.error('Error getting active sessions:', error);
            return [];
        }
    }

    async terminateSession(sessionId) {
        try {
            if (this.sessions.has(sessionId)) {
                this.sessions.delete(sessionId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error terminating session:', error);
            return false;
        }
    }

    // Cleanup expired sessions
    cleanupExpiredSessions() {
        const now = new Date();
        for (const [sessionId, session] of this.sessions) {
            const timeSinceLastActivity = now - session.lastActivity;
            if (timeSinceLastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
            }
        }
    }

    // Start cleanup interval
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Cleanup every 5 minutes
    }
}

module.exports = AdminAuth;