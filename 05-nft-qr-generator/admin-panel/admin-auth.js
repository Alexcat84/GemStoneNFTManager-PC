const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class AdminAuth {
    constructor() {
        this.secretKey = process.env.JWT_SECRET || 'GemSpots2025!@#QRGenerator$%^&()+{}|:<>?[]\\;\',./~-=_+{}|:<>?[]\\;\',./~-=_';
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessions = new Map();
        
        // Default admin credentials (should be changed in production)
        this.defaultAdmin = {
            username: 'admin',
            password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
            role: 'admin',
            createdAt: new Date()
        };
        
        console.log('AdminAuth initialized with JWT_SECRET:', this.secretKey ? 'SET' : 'NOT SET');
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
            
            // Check if user exists (in production, this would be from database)
            if (username !== this.defaultAdmin.username) {
                console.log('Invalid username:', username);
                return null;
            }

            // Verify password
            const isValidPassword = await this.verifyPassword(password, this.defaultAdmin.password);
            console.log('Password verification result:', isValidPassword);
            if (!isValidPassword) {
                console.log('Invalid password for user:', username);
                return null;
            }

            // Generate token
            const token = this.generateToken(this.defaultAdmin);
            
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
            // Verify old password
            if (username !== this.defaultAdmin.username) {
                return false;
            }

            const isValidPassword = await this.verifyPassword(oldPassword, this.defaultAdmin.password);
            if (!isValidPassword) {
                return false;
            }

            // Hash new password
            const hashedNewPassword = await this.hashPassword(newPassword);
            
            // Update password (in production, this would be in database)
            this.defaultAdmin.password = hashedNewPassword;
            
            return true;
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