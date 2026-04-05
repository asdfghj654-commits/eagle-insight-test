/**
 * Auth Routes — Eagle Insight Local MVP
 *
 * POST /api/auth/login    — Login with personal number + password
 * POST /api/auth/logout   — Invalidate session
 * GET  /api/auth/me       — Return current user
 * PATCH /api/auth/password — Change own password
 */

import { Router, Request, Response } from 'express';
import { authService } from '../services/auth-service';
import { requireAuth } from '../middleware/auth-middleware';
import { auditService } from '../services/audit-service';
import { logger } from '../utils/logger';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { personalNumber, password } = req.body;

  if (!personalNumber || !password) {
    return res.status(400).json({
      error: 'personalNumber and password are required',
      errorHe: 'נדרש מספר אישי וסיסמה'
    });
  }

  try {
    const result = await authService.login(String(personalNumber), String(password));

    if (!result.success) {
      return res.status(401).json({ error: result.error, errorHe: result.errorHe });
    }

    auditService.write({
      actorId: result.user?.id,
      actorRole: result.user?.role,
      action: 'auth.login',
      entityType: 'session',
      newValue: { personalNumber },
    });

    return res.json({ token: result.token, user: result.user });
  } catch (err) {
    logger.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, (req: Request, res: Response) => {
  if (req.authSession) {
    authService.logout(req.authSession.sessionId);

    auditService.write({
      actorId: req.authUser?.id,
      actorRole: req.authUser?.role,
      action: 'auth.logout',
      entityType: 'session',
    });
  }
  return res.json({ success: true });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  return res.json({ user: req.authUser });
});

// PATCH /api/auth/password
authRouter.patch('/password', requireAuth, async (req: Request, res: Response) => {
  const { newPassword } = req.body;

  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({
      error: 'newPassword must be at least 6 characters',
      errorHe: 'הסיסמה חייבת להכיל לפחות 6 תווים'
    });
  }

  try {
    const ok = await authService.changePassword(req.authUser!.id, String(newPassword));
    if (!ok) return res.status(404).json({ error: 'User not found' });

    auditService.write({
      actorId: req.authUser?.id,
      actorRole: req.authUser?.role,
      action: 'auth.password_changed',
      entityType: 'user',
      entityId: req.authUser?.id,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error('[Auth] Password change error:', err);
    return res.status(500).json({ error: 'Password change failed' });
  }
});

// GET /api/auth/users  (engineer/commander only)
authRouter.get('/users', requireAuth, (req: Request, res: Response) => {
  const role = req.authUser?.role;
  if (!['engineer', 'commander', 'admin'].includes(role ?? '')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json({ users: authService.listUsers() });
});
