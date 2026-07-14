import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { UserRole, Language } from '@prisma/client';

interface RegisterGarageDto {
  garageName: string;
  garageNameAr?: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  country?: string;
  currency?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

export class AuthService {
  // ─── Register a new Garage (Tenant) ─────────────────────────────────────────
  async registerGarage(data: RegisterGarageDto) {
    const normalizedEmail = data.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }

    const existingTenant = await prisma.tenant.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingTenant) {
      throw new AppError('Garage email already exists', 409, 'GARAGE_EXISTS');
    }

    const slug = await this.generateUniqueSlug(data.garageName);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Get Basic plan config
    const basicPlan = await prisma.subscriptionPlanConfig.findUnique({
      where: { name: 'BASIC' },
    });

    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: data.garageName,
          nameAr: data.garageNameAr,
          slug,
          email: normalizedEmail,
          phone: data.phone,
          status: 'TRIAL',
          trialEndsAt,
          country: data.country || 'KW',
          currency: data.currency || 'KWD',
        },
      });

      // Create subscription (trial)
      if (basicPlan) {
        await tx.tenantSubscription.create({
          data: {
            tenantId: tenant.id,
            planId: basicPlan.id,
            billingCycle: 'MONTHLY',
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndsAt,
          },
        });
      }

      // Create main branch
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: data.garageName,
          nameAr: data.garageNameAr,
          phone: data.phone,
          isActive: true,
          dailyCapacity: 10,
        },
      });

      // Create owner user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          email: normalizedEmail,
          passwordHash,
          name: data.ownerName,
          role: 'GARAGE_OWNER',
          isActive: true,
          emailVerifiedAt: new Date(),
        },
      });

      return { tenant, branch, user };
    });

    const tokens = this.generateTokens(result.user.id, result.tenant.id, result.user.role);

    await this.saveRefreshToken(result.user.id, tokens.refreshToken);

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
        status: result.tenant.status,
        trialEndsAt: result.tenant.trialEndsAt,
      },
      tokens,
    };
  }

  // ─── Login ────────────────────────────────────────────────────────────────────
  async login(data: LoginDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        tenant: true,
        branch: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Contact your manager.', 403, 'ACCOUNT_INACTIVE');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (user.tenant.status === 'SUSPENDED') {
      throw new AppError('Account suspended. Contact support.', 403, 'ACCOUNT_SUSPENDED');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.generateTokens(user.id, user.tenantId, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken, userAgent, ipAddress);

    return {
      user: {
        id: user.id,
        name: user.name,
        nameAr: user.nameAr,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        preferredLanguage: user.preferredLanguage,
        branchId: user.branchId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        nameAr: user.tenant.nameAr,
        slug: user.tenant.slug,
        status: user.tenant.status,
        trialEndsAt: user.tenant.trialEndsAt,
        country: user.tenant.country,
        currency: user.tenant.currency,
        logo: user.tenant.logo,
      },
      branch: user.branch ? {
        id: user.branch.id,
        name: user.branch.name,
      } : null,
      tokens,
    };
  }

  // ─── Super Admin Login ────────────────────────────────────────────────────────
  async superAdminLogin(data: LoginDto) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!superAdmin || !superAdmin.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(data.password, superAdmin.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = jwt.sign(
      { superAdminId: superAdmin.id, isSuperAdmin: true },
      env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      superAdmin: { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email },
      accessToken: token,
      token,
    };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────────
  async refreshToken(refreshToken: string) {
    let decoded: { userId: string; type: string };

    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as any;
    } catch {
      throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || new Date() > storedToken.expiresAt) {
      throw new AppError('Refresh token expired', 401, 'TOKEN_EXPIRED');
    }

    if (!storedToken.user.isActive) {
      throw new AppError('Account inactive', 403, 'ACCOUNT_INACTIVE');
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const tokens = this.generateTokens(
      storedToken.user.id,
      storedToken.user.tenantId,
      storedToken.user.role
    );
    await this.saveRefreshToken(storedToken.user.id, tokens.refreshToken);

    return tokens;
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────
  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return true;
  }

  // ─── Change Password ──────────────────────────────────────────────────────────
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('User not found', 404);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError('Current password is incorrect', 400, 'WRONG_PASSWORD');

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    return true;
  }

  // ─── Impersonate Tenant ──────────────────────────────────────────────────────
  async impersonate(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Find the first user who is a GARAGE_OWNER, otherwise any active user
    let user = tenant.users.find((u) => u.role === 'GARAGE_OWNER');
    if (!user && tenant.users.length > 0) {
      user = tenant.users[0];
    }

    if (!user) {
      throw new AppError('No active users found for this garage', 400);
    }

    const tokens = this.generateTokens(user.id, tenant.id, user.role);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // Get the default active branch if any
    const branch = await prisma.branch.findFirst({
      where: { tenantId: tenant.id, isActive: true },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        nameAr: user.nameAr,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        preferredLanguage: user.preferredLanguage,
        branchId: user.branchId,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        nameAr: tenant.nameAr,
        slug: tenant.slug,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt,
        country: tenant.country,
        currency: tenant.currency,
        logo: tenant.logo,
      },
      branch: branch ? {
        id: branch.id,
        name: branch.name,
      } : null,
      tokens,
    };
  }

  // ─── Reset Password Without Authentication ────────────────────────────────────
  async resetPasswordWithoutAuth(email: string, newPassword: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      throw new AppError('المستخدم غير موجود', 404, 'USER_NOT_FOUND');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    return true;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────
  private generateTokens(userId: string, tenantId: string, role: UserRole) {
    const accessToken = jwt.sign(
      { userId, tenantId, role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
    );

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
    userAgent?: string,
    ipAddress?: string
  ) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { userId, token, expiresAt, userAgent, ipAddress },
    });
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    let slug = baseSlug;
    let count = 0;

    while (true) {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (!existing) break;
      count++;
      slug = `${baseSlug}-${count}`;
    }

    return slug;
  }
}

export const authService = new AuthService();
