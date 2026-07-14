import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';
import { env } from '../config/env';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId?: string | null;
    email: string;
    role: UserRole;
    name: string;
  };
  tenantId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required', 401, 'NO_TOKEN');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      tenantId: string;
      role: UserRole;
    };

    if (!decoded.userId) {
      throw new AppError('Authentication required', 401, 'INVALID_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        tenantId: true,
        branchId: true,
      },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
    }

    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    } else {
      next(error);
    }
  }
};

export const authenticateSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Authentication required', 401, 'NO_TOKEN');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      superAdminId: string;
      isSuperAdmin: boolean;
    };

    if (!decoded.isSuperAdmin) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: decoded.superAdminId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!superAdmin || !superAdmin.isActive) {
      throw new AppError('Super admin not found', 401, 'UNAUTHORIZED');
    }

    (req as any).superAdmin = superAdmin;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    } else {
      next(error);
    }
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(
        `Access denied. Required roles: ${roles.join(', ')}`,
        403,
        'FORBIDDEN'
      );
    }
    next();
  };
};

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
}
