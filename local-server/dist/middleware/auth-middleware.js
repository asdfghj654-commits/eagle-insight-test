"use strict";
/**
 * Auth Middleware — Eagle Insight Local MVP
 *
 * Validates JWT bearer token on protected routes.
 * Attaches user context to req for downstream handlers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
exports.requirePermission = requirePermission;
const auth_service_1 = require("../services/auth-service");
/**
 * Require a valid JWT. Returns 401 if missing or invalid.
 */
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized', errorHe: 'נדרשת הזדהות' });
        return;
    }
    const token = header.slice(7);
    const result = auth_service_1.authService.verifyToken(token);
    if (!result) {
        res.status(401).json({ error: 'Invalid or expired token', errorHe: 'סשן פג תוקף — יש להתחבר מחדש' });
        return;
    }
    req.authUser = result.user;
    req.authSession = result.payload;
    next();
}
/**
 * Require one of the specified roles.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.authUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (!roles.includes(req.authUser.role)) {
            res.status(403).json({ error: 'Forbidden', errorHe: 'אין הרשאה לפעולה זו' });
            return;
        }
        next();
    };
}
/**
 * Require a specific permission.
 */
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.authUser) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const perms = req.authUser.permissions;
        if (!perms.includes(permission) && !perms.includes('view_all')) {
            res.status(403).json({ error: 'Forbidden', errorHe: 'אין הרשאה לפעולה זו' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth-middleware.js.map