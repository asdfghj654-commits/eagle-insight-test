/**
 * Auth Service — Eagle Insight Local MVP
 *
 * Real local authentication:
 * - Users stored in SQLite with bcrypt-hashed passwords
 * - JWT issued on login, stored in sessions table for revocation
 * - Sessions expire after configurable TTL (default 8h)
 */
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
    permissions: string;
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
export declare const authService: {
    /**
     * Attempt login with personal number + password.
     * Returns JWT on success.
     */
    login(personalNumber: string, password: string): Promise<LoginResult>;
    /**
     * Verify JWT and return user. Returns null if invalid/expired.
     */
    verifyToken(token: string): {
        payload: TokenPayload;
        user: SafeUser;
    } | null;
    /**
     * Invalidate a session (logout).
     */
    logout(sessionId: string): void;
    /**
     * Get user by ID.
     */
    getUserById(userId: string): SafeUser | null;
    /**
     * List all users (no password hashes).
     */
    listUsers(): SafeUser[];
    /**
     * Change a user's password (requires current password OR admin role).
     */
    changePassword(userId: string, newPassword: string): Promise<boolean>;
    /**
     * Hash a plain password (for seeding/admin use).
     */
    hashPassword(plain: string): Promise<string>;
    /**
     * Purge expired sessions (call periodically).
     */
    purgeExpiredSessions(): void;
};
//# sourceMappingURL=auth-service.d.ts.map