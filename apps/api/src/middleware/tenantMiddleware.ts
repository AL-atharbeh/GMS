import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from './errorHandler';
import { AuthRequest } from './auth';

/**
 * Middleware to verify tenant is active and subscription is valid
 * Must be used after authenticate middleware
 */
export const tenantMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Skip if no user (public routes)
  if (!req.user) return next();

  // Super admin bypasses tenant check
  if (req.user.role === 'SUPER_ADMIN') return next();

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }

    if (tenant.status === 'SUSPENDED') {
      throw new AppError(
        'Your account has been suspended. Please contact support.',
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    if (tenant.status === 'CANCELLED') {
      throw new AppError(
        'Your account has been cancelled.',
        403,
        'ACCOUNT_CANCELLED'
      );
    }

    if (tenant.status === 'TRIAL' && tenant.trialEndsAt) {
      if (new Date() > tenant.trialEndsAt) {
        throw new AppError(
          'Your trial period has ended. Please subscribe to continue.',
          402,
          'TRIAL_EXPIRED'
        );
      }
    }

    (req as any).tenant = tenant;
    next();
  } catch (error) {
    next(error);
  }
};
