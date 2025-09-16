const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PostgresDatabase = require('../database/postgres-database');

class AdminAuth {
    constructor() {
        this.secretKey = process.env.JWT_SECRET || 'GemSpots2025!@#MainWebsite$%^&()+{}|:<>?[]\\;\',./~-=_+{}|:<>?[]\\;\',./~-=_';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessions = new Map();
        this.database = new PostgresDatabase();
        
        console.log('AdminAuth initialized with JWT_SECRET:', this.secretKey ? 'SET' : 'NOT SET');
    }

    async login(username, password) {
        try {
            console.log('🔐 Login attempt for user:', username);
            console.log('🔐 Password provided:', password);
            
            const user = await this.database.getAdminByUsername(username);
            console.log('🔐 User found:', user ? 'YES' : 'NO');
            if (user) {
                console.log('🔐 User details:', { id: user.id, username: user.username, role: user.role });
                console.log('🔐 Stored hash:', user.password_hash);
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

    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.secretKey);
            
            // Check if session exists and is not expired
            const session = this.sessions.get(decoded.sessionId);
            if (!session) {
                console.log('Session not found for token');
                return null;
            }

            // Check session timeout
            if (Date.now() - session.loginTime > this.sessionTimeout) {
                console.log('Session expired');
                this.sessions.delete(decoded.sessionId);
                return null;
            }

            return decoded;
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
