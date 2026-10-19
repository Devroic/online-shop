import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const dataDir = path.resolve(ROOT_DIR, env.DATA_DIR || 'data');

export const config = {
  isProd,
  isTest: env.NODE_ENV === 'test',
  port: Number(env.PORT || 4000),
  // Public URL of the shop, used in emails and payment redirects.
  publicUrl: (env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  dataDir,
  dbFile: env.DB_FILE || path.join(dataDir, 'shop.db'),
  uploadsDir: path.join(dataDir, 'uploads'),
  clientDist: path.resolve(ROOT_DIR, 'client', 'dist'),
  jwtSecret: env.JWT_SECRET || (isProd ? '' : 'dev-secret-change-me'),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  smtp: {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
};

if (isProd && (!config.jwtSecret || config.jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
}
