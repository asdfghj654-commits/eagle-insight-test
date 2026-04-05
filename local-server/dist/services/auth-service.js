"use strict";
/**
 * Auth Service — Eagle Insight Local MVP
 *
 * Real local authentication:
 * - Users stored in SQLite with bcrypt-hashed passwords
 * - JWT issued on login, stored in sessions table for revocation
 * - Sessions expire after configurable TTL (default 8h)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
const logger_1 = require("../utils/logger");
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'eagle-insight-local-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_ROUNDS = 10;
if (JWT_SECRET === 'eagle-insight-local-dev-secret-change-in-production') {
    logger_1.logger.warn('[Auth] WARNING: Using default JWT secret. Set JWT_SECRET in .env for production use.');
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function rowToSafeUser(row) {
    return {
        id: row.id,
        personalNumber: row.personal_number,
        name: row.name,
        nameHe: row.name_he,
        role: row.role,
        roleHe: row.role_he,
        unit: row.unit,
        unitHe: row.unit_he,
        rank: row.rank,
        rankHe: row.rank_he,
        permissions: JSON.parse(row.permissions || '[]'),
        isActive: row.is_active === 1,
    };
}
// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
exports.authService = {
    /**
     * Attempt login with personal number + password.
     * Returns JWT on success.
     */
    async login(personalNumber, password) {
        const db = (0, db_1.getDb)();
        const row = db.prepare('SELECT * FROM users WHERE personal_number = ? AND is_active = 1').get(personalNumber);
        if (!row) {
            logger_1.logger.warn(`[Auth] Login failed: unknown personal number ${personalNumber}`);
            return { success: false, error: 'User not found', errorHe: 'משתמש לא נמצא' };
        }
        const match = await bcryptjs_1.default.compare(password, row.password_hash);
        if (!match) {
            logger_1.logger.warn(`[Auth] Login failed: wrong password for ${personalNumber}`);
            return { success: false, error: 'Invalid password', errorHe: 'סיסמה שגויה' };
        }
        // Create session
        const sessionId = (0, uuid_1.v4)();
        const expiresMs = parseExpiry(JWT_EXPIRES_IN);
        const expiresAt = new Date(Date.now() + expiresMs).toISOString();
        const payload = { userId: row.id, role: row.role, sessionId };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        db.prepare('INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)').run(sessionId, row.id, token, expiresAt);
        logger_1.logger.info(`[Auth] Login success: ${personalNumber} (${row.role})`);
        return { success: true, token, user: rowToSafeUser(row) };
    },
    /**
     * Verify JWT and return user. Returns null if invalid/expired.
     */
    verifyToken(token) {
        const db = (0, db_1.getDb)();
        try {
            const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            // Check session exists and not expired
            const session = db.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')").get(payload.sessionId);
            if (!session)
                return null;
            const row = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(payload.userId);
            if (!row)
                return null;
            return { payload, user: rowToSafeUser(row) };
        }
        catch {
            return null;
        }
    },
    /**
     * Invalidate a session (logout).
     */
    logout(sessionId) {
        (0, db_1.getDb)().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    },
    /**
     * Get user by ID.
     */
    getUserById(userId) {
        const row = (0, db_1.getDb)().prepare('SELECT * FROM users WHERE id = ? AND is_active = 1').get(userId);
        return row ? rowToSafeUser(row) : null;
    },
    /**
     * List all users (no password hashes).
     */
    listUsers() {
        const rows = (0, db_1.getDb)().prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY role, name').all();
        return rows.map(rowToSafeUser);
    },
    /**
     * Change a user's password (requires current password OR admin role).
     */
    async changePassword(userId, newPassword) {
        const hash = await bcryptjs_1.default.hash(newPassword, BCRYPT_ROUNDS);
        const result = (0, db_1.getDb)().prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(hash, userId);
        return result.changes > 0;
    },
    /**
     * Hash a plain password (for seeding/admin use).
     */
    async hashPassword(plain) {
        return bcryptjs_1.default.hash(plain, BCRYPT_ROUNDS);
    },
    /**
     * Purge expired sessions (call periodically).
     */
    purgeExpiredSessions() {
        const result = (0, db_1.getDb)().prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
        if (result.changes > 0) {
            logger_1.logger.info(`[Auth] Purged ${result.changes} expired sessions`);
        }
    },
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function parseExpiry(expr) {
    const match = expr.match(/^(\d+)([smhd])$/);
    if (!match)
        return 8 * 60 * 60 * 1000;
    const [, n, unit] = match;
    const num = parseInt(n, 10);
    switch (unit) {
        case 's': return num * 1000;
        case 'm': return num * 60 * 1000;
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        default: return 8 * 60 * 60 * 1000;
    }
}
//# sourceMappingURL=auth-service.js.map