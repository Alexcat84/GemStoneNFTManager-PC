const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PostgresDatabase = require('../database/postgres-database');

class AdminAuth {
    constructor() {
        const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
        if (isProd && !process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is required in production (set in Vercel / hosting env)');
        }
        this.secretKey = process.env.JWT_SECRET || 'GemSpots2025!@#MainWebsite$%^&()+{}|:<>?[]\\;\',./~-=_+{}|:<>?[]\\;\',./~-=_';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessions = new Map();
        this.database = new PostgresDatabase();
        
        console.log('AdminAuth initialized; JWT_SECRET:', process.env.JWT_SECRET ? 'from env' : 'using dev fallback only');
    }

    async login(username, password) {
        try {
            console.log('🔐 Login attempt for user:', username || '(empty)');
            
            const user = await this.database.getAdminByUsername(username);
            console.log('🔐 User found:', user ? 'YES' : 'NO');
            if (user) {
                console.log('🔐 User details:', { id: user.id, username: user.username, role: user.role });
            }
            
            if (!user) {
                console.log('❌ User not found:', username);
                return null;
            }

            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            console.log('🔐 Password validation result:', isValidPassword);
            
            if (!isValidPassword) {
                console.log('❌ Invalid password for user:', username);
                return null;
            }

            const sessionId = this.generateSessionId();
            const token = this.generateToken(user, sessionId);
            
            this.sessions.set(sessionId, {
                userId: user.id,
                username: user.username,
                role: user.role,
                loginTime: Date.now()
            });

            console.log('Login successful for user:', username);
            return {
                token: token,
                sessionId: sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            };
        } catch (error) {
            console.error('Error in login:', error);
            return null;
        }
    }

    async changePassword(username, oldPassword, newPassword) {
        try {
            const user = await this.database.getAdminByUsername(username);
            if (!user) {
                return false;
            }

            const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);
            if (!isValidPassword) {
                return false;
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            await this.database.updateAdminPassword(username, newPasswordHash);
            
            return true;
        } catch (error) {
            console.error('Error changing password:', error);
            return false;
        }
    }

    generateToken(user, sessionId) {
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            sessionId: sessionId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
        };

        return jwt.sign(payload, this.secretKey);
    }

    // Align with pre-unification (05): verify only JWT (signature + exp). Do not require
    // in-memory session, so auth works on serverless (Vercel) where each request may hit a different instance.
    verifyToken(token) {
        try {
            return jwt.verify(token, this.secretKey);
        } catch (error) {
            console.log('Token verification failed:', error.message);
            return null;
        }
    }

    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    logout(sessionId) {
        this.sessions.delete(sessionId);
    }

    // Clean up expired sessions
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.loginTime > this.sessionTimeout) {
                this.sessions.delete(sessionId);
            }
        }
    }
}

module.exports = AdminAuth;
