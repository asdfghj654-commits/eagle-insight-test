/**
 * Auth Middleware — Eagle Insight Local MVP
 *
 * Validates JWT bearer token on protected routes.
 * Attaches user context to req for downstream handlers.
 */
import { Request, Response, NextFunction } from 'express';
import { SafeUser, TokenPayload } from '../services/auth-service';
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
export declare function requireAuth(req: Request, res: Response, next: NextFunction): void;
/**
 * Require one of the specified roles.
 */
export declare function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Require a specific permission.
 */
export declare function requirePermission(permission: string): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth-middleware.d.ts.map