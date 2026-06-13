import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { UnauthorizedError, ForbiddenError } from '../common';
import { User, PermissionLevel } from '../models';

export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
}

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      email: string;
      role: string;
    };

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    } as User;
    
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  authenticate(req, res, next);
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

export const checkStoryPermission = (permission: PermissionLevel) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('Authentication required'));
      }

      const storyId = req.params.id || req.params.storyId;
      
      if (!storyId) {
        return next(new ForbiddenError('Story ID required'));
      }

      const hasPermission = await verifyStoryPermission(
        req.user.id,
        storyId,
        permission
      );

      if (!hasPermission) {
        return next(new ForbiddenError('No permission to access this story'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

async function verifyStoryPermission(
  userId: string,
  storyId: string,
  requiredPermission: PermissionLevel
): Promise<boolean> {
  return true;
}

export const generateToken = (user: User): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

export const generateRefreshToken = (user: User): string => {
  return jwt.sign(
    {
      userId: user.id,
      type: 'refresh',
    },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  const decoded = jwt.verify(token, config.jwt.secret) as {
    userId: string;
    type: string;
  };

  if (decoded.type !== 'refresh') {
    throw new UnauthorizedError('Invalid refresh token');
  }

  return { userId: decoded.userId };
};
