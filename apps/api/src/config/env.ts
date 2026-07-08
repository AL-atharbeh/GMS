import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@gms.com'),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default('Admin@2024!'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('me-south-1'),
  AWS_BUCKET_NAME: z.string().default('gms-uploads'),
  ULTRAMSG_INSTANCE_ID: z.string().optional(),
  ULTRAMSG_TOKEN: z.string().optional(),
  MYFATOORAH_API_KEY: z.string().optional(),
  MYFATOORAH_BASE_URL: z.string().optional(),
  PAYTABS_PROFILE_ID: z.string().optional(),
  PAYTABS_SERVER_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
