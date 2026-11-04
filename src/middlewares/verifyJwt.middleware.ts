import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyJwtMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  let authHeader: string | undefined;
  let apiSignToken: string | string[] | undefined;
  let token: string;
  let decoded: any;

  try {
    apiSignToken = req.headers['x-api-sign-token'];
    if (env.X_API_SIGN_TOKEN && apiSignToken === env.X_API_SIGN_TOKEN) {
      req.user = { role: 'internal_service' };
      next();
      return;
    }

    authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        error: 'Authorization header missing or invalid format (Bearer token required)',
      });
      return;
    }

    token = authHeader.split(' ')[1];
    decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('[verifyJwtMiddleware] Error verifying JWT:', error?.message || error);
    res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      error: 'Token expired or invalid',
    });
  }
};
