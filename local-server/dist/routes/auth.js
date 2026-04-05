"use strict";
/**
 * Auth Routes — Eagle Insight Local MVP
 *
 * POST /api/auth/login    — Login with personal number + password
 * POST /api/auth/logout   — Invalidate session
 * GET  /api/auth/me       — Return current user
 * PATCH /api/auth/password — Change own password
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const auth_service_1 = require("../services/auth-service");
const auth_middleware_1 = require("../middleware/auth-middleware");
const audit_service_1 = require("../services/audit-service");
const logger_1 = require("../utils/logger");
exports.authRouter = (0, express_1.Router)();
// POST /api/auth/login
exports.authRouter.post('/login', async (req, res) => {
    const { personalNumber, password } = req.body;
    if (!personalNumber || !password) {
        return res.status(400).json({
            error: 'personalNumber and password are required',
            errorHe: 'נדרש מספר אישי וסיסמה'
        });
    }
    try {
        const result = await auth_service_1.authService.login(String(personalNumber), String(password));
        if (!result.success) {
            return res.status(401).json({ error: result.error, errorHe: result.errorHe });
        }
        audit_service_1.auditService.write({
            actorId: result.user?.id,
            actorRole: result.user?.role,
            action: 'auth.login',
            entityType: 'session',
            newValue: { personalNumber },
        });
        return res.json({ token: result.token, user: result.user });
    }
    catch (err) {
        logger_1.logger.error('[Auth] Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
});
// POST /api/auth/logout
exports.authRouter.post('/logout', auth_middleware_1.requireAuth, (req, res) => {
    if (req.authSession) {
        auth_service_1.authService.logout(req.authSession.sessionId);
        audit_service_1.auditService.write({
            actorId: req.authUser?.id,
            actorRole: req.authUser?.role,
            action: 'auth.logout',
            entityType: 'session',
        });
    }
    return res.json({ success: true });
});
// GET /api/auth/me
exports.authRouter.get('/me', auth_middleware_1.requireAuth, (req, res) => {
    return res.json({ user: req.authUser });
});
// PATCH /api/auth/password
exports.authRouter.patch('/password', auth_middleware_1.requireAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
        return res.status(400).json({
            error: 'newPassword must be at least 6 characters',
            errorHe: 'הסיסמה חייבת להכיל לפחות 6 תווים'
        });
    }
    try {
        const ok = await auth_service_1.authService.changePassword(req.authUser.id, String(newPassword));
        if (!ok)
            return res.status(404).json({ error: 'User not found' });
        audit_service_1.auditService.write({
            actorId: req.authUser?.id,
            actorRole: req.authUser?.role,
            action: 'auth.password_changed',
            entityType: 'user',
            entityId: req.authUser?.id,
        });
        return res.json({ success: true });
    }
    catch (err) {
        logger_1.logger.error('[Auth] Password change error:', err);
        return res.status(500).json({ error: 'Password change failed' });
    }
});
// GET /api/auth/users  (engineer/commander only)
exports.authRouter.get('/users', auth_middleware_1.requireAuth, (req, res) => {
    const role = req.authUser?.role;
    if (!['engineer', 'commander', 'admin'].includes(role ?? '')) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({ users: auth_service_1.authService.listUsers() });
});
//# sourceMappingURL=auth.js.map