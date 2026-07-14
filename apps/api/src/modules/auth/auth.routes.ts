import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';

const router = Router();

// ─── Register New Garage ──────────────────────────────────────────────────────
const registerSchema = z.object({
  body: z.object({
    garageName: z.string().min(2).max(100),
    garageNameAr: z.string().max(100).optional(),
    ownerName: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
    phone: z.string().optional(),
    country: z.string().length(2).default('KW'),
    currency: z.string().length(3).default('KWD'),
  }),
});

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const result = await authService.registerGarage(req.body);
  res.status(201).json({
    success: true,
    message: 'Garage registered successfully',
    data: result,
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

router.post('/login', authRateLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const result = await authService.login(
    req.body,
    req.ip,
    req.headers['user-agent']
  );

  // Set refresh token as httpOnly cookie
  res.cookie('refreshToken', result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      tenant: result.tenant,
      branch: result.branch,
      accessToken: result.tokens.accessToken,
    },
  });
});

// ─── Super Admin Login ────────────────────────────────────────────────────────
router.post('/super-admin/login', authRateLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  const result = await authService.superAdminLogin(req.body);
  res.json({
    success: true,
    message: 'Super admin login successful',
    data: result,
  });
});

// ─── Refresh Token ────────────────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required',
    });
  }

  const tokens = await authService.refreshToken(refreshToken);

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: { accessToken: tokens.accessToken },
  });
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

// ─── Me (Current User) ───────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await import('../../config/database').then(({ prisma }) =>
    prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        tenant: {
          include: { subscription: { include: { plan: true } } },
        },
        branch: true,
        technician: true,
      },
    })
  );

  res.json({ success: true, data: user });
});

// ─── Change Password ──────────────────────────────────────────────────────────
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user!.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password changed successfully' });
});

// ─── Reset Password Without Auth ──────────────────────────────────────────────
const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
  }),
});

router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;
  await authService.resetPasswordWithoutAuth(email, password);
  res.json({ success: true, message: 'Password reset successfully' });
});

export default router;
