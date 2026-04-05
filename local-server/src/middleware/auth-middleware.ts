/**
 * Auth Middleware — Eagle Insight Local MVP
 *
 * Validates JWT bearer token on protected routes.
 * Attaches user context to req for downstream handlers.
 */

import { Request, Response, NextFunction } from 'express';
import { authService, SafeUser, TokenPayload } from '../services/auth-service';

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      authUser?: SafeUser;
      authSession?: TokenPayload;
    }
  }
}

/**
 * Require a valid JWT. Returns 401 if missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', errorHe: 'נדרשת הזדהות' });
    return;
  }

  const token = header.slice(7);
  const result = authService.verifyToken(token);

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
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
