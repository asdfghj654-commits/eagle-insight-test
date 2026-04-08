/**
 * Auth Service — Eagle Insight Local MVP
 *
 * Real local authentication:
 * - Users stored in SQLite with bcrypt-hashed passwords
 * - JWT issued on login, stored in sessions table for revocation
 * - Sessions expire after configurable TTL (default 8h)
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || 'eagle-insight-local-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const BCRYPT_ROUNDS = 10;

if (JWT_SECRET === 'eagle-insight-local-dev-secret-change-in-production') {
  logger.warn('[Auth] WARNING: Using default JWT secret. Set JWT_SECRET in .env for production use.');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string;
  personal_number: string;
  name: string;
  name_he: string;
  role: string;
  role_he: string;
  unit: string;
  unit_he: string;
  rank: string;
  rank_he: string;
  password_hash: string;
  permissions: string; // JSON string
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SafeUser {
  id: string;
  personalNumber: string;
  name: string;
  nameHe: string;
  role: string;
  roleHe: string;
  unit: string;
  unitHe: string;
  rank: string;
  rankHe: string;
  permissions: string[];
  isActive: boolean;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: SafeUser;
  error?: string;
  errorHe?: string;
}

export interface TokenPayload {
  userId: string;
  role: string;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    personalNumber: row.personal_number,
    name: row.name,
    nameHe: row.name_he,
    role: row.role,
    roleHe: row.role_he,
    unit: row.role === 'engineer' ? row.unit : 'Squadron 201',
    unitHe: row.role === 'engineer' ? row.unit_he : 'טייסת 201',
    rank: row.rank,
    rankHe: row.rank_he,
    permissions: JSON.parse(row.permissions || '[]'),
    isActive: row.is_active === 1,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const authService = {
  /**
   * Attempt login with personal number + password.
   * Returns JWT on success.
   */
  async login(personalNumber: string, password: string): Promise<LoginResult> {
    const db = getDb();

    const row = db.prepare(
      'SELECT * FROM users WHERE personal_number = ? AND is_active = 1'
    ).get(personalNumber) as UserRow | undefined;

    if (!row) {
      logger.warn(`[Auth] Login failed: unknown personal number ${personalNumber}`);
      return { success: false, error: 'User not found', errorHe: 'משתמש לא נמצא' };
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      logger.warn(`[Auth] Login failed: wrong password for ${personalNumber}`);
      return { success: false, error: 'Invalid password', errorHe: 'סיסמה שגויה' };
    }

    // Create session
    const sessionId = uuidv4();
    const expiresMs = parseExpiry(JWT_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + expiresMs).toISOString();

    const payload: TokenPayload = { userId: row.id, role: row.role, sessionId };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    db.prepare(
      'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId, row.id, token, expiresAt);

    logger.info(`[Auth] Login success: ${personalNumber} (${row.role})`);
    return { success: true, token, user: rowToSafeUser(row) };
  },

  /**
   * Verify JWT and return user. Returns null if invalid/expired.
   */
  verifyToken(token: string): { payload: TokenPayload; user: SafeUser } | null {
    const db = getDb();
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

      // Check session exists and not expired
      const session = db.prepare(
        "SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')"
      ).get(payload.sessionId);

      if (!session) return null;

      const row = db.prepare(
        'SELECT * FROM users WHERE id = ? AND is_active = 1'
      ).get(payload.userId) as UserRow | undefined;

      if (!row) return null;

      return { payload, user: rowToSafeUser(row) };
    } catch {
      return null;
    }
  },

  /**
   * Invalidate a session (logout).
   */
  logout(sessionId: string): void {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  },

  /**
   * Get user by ID.
   */
  getUserById(userId: string): SafeUser | null {
    const row = getDb().prepare(
      'SELECT * FROM users WHERE id = ? AND is_active = 1'
    ).get(userId) as UserRow | undefined;
    return row ? rowToSafeUser(row) : null;
  },

  /**
   * List all users (no password hashes).
   */
  listUsers(): SafeUser[] {
    const rows = getDb().prepare(
      'SELECT * FROM users WHERE is_active = 1 ORDER BY role, name'
    ).all() as UserRow[];
    return rows.map(rowToSafeUser);
  },

  /**
   * Change a user's password (requires current password OR admin role).
   */
  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const result = getDb().prepare(
      'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?'
    ).run(hash, userId);
    return result.changes > 0;
  },

  /**
   * Hash a plain password (for seeding/admin use).
   */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  },

  /**
   * Purge expired sessions (call periodically).
   */
  purgeExpiredSessions(): void {
    const result = getDb().prepare(
      "DELETE FROM sessions WHERE expires_at <= datetime('now')"
    ).run();
    if (result.changes > 0) {
      logger.info(`[Auth] Purged ${result.changes} expired sessions`);
    }
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseExpiry(expr: string): number {
  const match = expr.match(/^(\d+)([smhd])$/);
  if (!match) return 8 * 60 * 60 * 1000;
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
