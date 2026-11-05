import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

// Reads the repository's .env (or another file: DOTENV_CONFIG_PATH=.env.acme),
// whatever folder the command runs from. Real environment variables win.
dotenv.config({ path: path.resolve(ROOT_DIR, process.env.DOTENV_CONFIG_PATH || '.env'), quiet: true });

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
  isVercel: !!env.VERCEL,
  // Postgres connection string (Supabase → Project Settings → Database →
  // Connection pooling, "Transaction" mode, port 6543).
  databaseUrl: env.DATABASE_URL,
  // Used only without DATABASE_URL (local development / tests).
  pgliteDir: env.PGLITE_DIR || path.join(dataDir, 'pglite'),
  uploadsDir: path.join(dataDir, 'uploads'),
  timezone: env.SHOP_TIMEZONE || 'Europe/Athens',
  supabase: {
    // Only the origin: a URL copied with /rest/v1/ breaks storage and sign-in.
    url: env.SUPABASE_URL ? new URL(env.SUPABASE_URL).origin : undefined,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_BUCKET || 'shop',
  },
  resendKey: env.RESEND_API_KEY,
  clientDist: path.resolve(ROOT_DIR, 'client', 'dist'),
  jwtSecret: env.JWT_SECRET || (isProd ? '' : 'dev-secret-change-me'),
  cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  smtp: {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  mailFrom: env.MAIL_FROM,
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
};

if (!/^[A-Za-z0-9_/+-]+$/.test(config.timezone)) throw new Error('SHOP_TIMEZONE must be an IANA time zone, e.g. Europe/Athens');

if (isProd && (!config.jwtSecret || config.jwtSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
}

// Supabase's "Direct connection" (db.<ref>.supabase.co) is IPv6-only: most home
// networks and Vercel can't reach it. The Transaction pooler works everywhere.
if (/@db\.[a-z0-9]+\.supabase\.co\b/i.test(config.databaseUrl || '')) {
  throw new Error(
    'DATABASE_URL is Supabase\'s "Direct connection", which only works over IPv6. ' +
      'Use the "Transaction pooler" string instead (Supabase → Connect; host ends in pooler.supabase.com, port 6543).',
  );
}
