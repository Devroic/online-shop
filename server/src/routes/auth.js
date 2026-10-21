import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db.js';
import { checkPassword, clearSession, hashPassword, normEmail, publicUser, requireUser, setSession } from '../auth.js';
import { HttpError, badRequest, randomToken, sha256, validate } from '../utils.js';
import { background, sendPasswordReset, sendWelcome } from '../email.js';
import { getSettings } from '../settings.js';
import { config } from '../config.js';
import { requestLanguage } from '../i18n.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

export const addressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  region: z.string().trim().max(100).optional().default(''),
  country: z.string().trim().max(100).optional().default(''),
});

const password = z.string().min(8, 'Password must be at least 8 characters').max(200);

const registerSchema = z.object({
  email: z.email().max(200),
  password,
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional().default(''),
});

/** Links earlier guest orders placed with the same email to the account. */
const claimGuestOrders = (user) =>
  db().query('UPDATE orders SET user_id = $1 WHERE user_id IS NULL AND lower(email) = $2', [user.id, user.email]);

router.post('/register', limiter, async (req, res) => {
  const data = validate(registerSchema, req.body);
  const email = normEmail(data.email);
  if (await db().one('SELECT id FROM users WHERE email = $1', [email])) {
    throw badRequest('An account with this email already exists', { email: 'exists' });
  }
  const user = await db().one('INSERT INTO users (email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING *', [
    email,
    await hashPassword(data.password),
    data.name,
    data.phone,
  ]);
  await claimGuestOrders(user);
  background(sendWelcome(user, requestLanguage(req, await getSettings())));
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password: pw } = validate(z.object({ email: z.string().max(200), password: z.string().max(200) }), req.body);
  const user = await db().one('SELECT * FROM users WHERE email = $1', [normEmail(email)]);
  if (user && !user.password_hash) {
    // Account created with Google/Apple and no password set yet.
    throw new HttpError(401, 'Use social sign-in', { provider: user.auth_provider });
  }
  if (!user || !(await checkPassword(pw, user.password_hash))) throw new HttpError(401, 'Wrong email or password');
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

/**
 * Google / Apple sign-in. The browser signs in with Supabase Auth and sends
 * us the Supabase access token; we verify it with Supabase, then find or
 * create our own user and start our normal session.
 */
router.post('/oauth', limiter, async (req, res) => {
  const { accessToken } = validate(z.object({ accessToken: z.string().min(20).max(5000) }), req.body);
  const { url, anonKey } = config.supabase;
  if (!url || !anonKey) throw badRequest('Social sign-in is not configured');
  const sb = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.getUser(accessToken);
  const sbUser = data?.user;
  if (error || !sbUser?.email) throw new HttpError(401, 'Sign-in failed');

  const provider = sbUser.app_metadata?.provider || 'oauth';
  const settings = await getSettings();
  if (!settings.login[provider]) throw new HttpError(403, 'This sign-in method is not enabled');
  if (!sbUser.email_confirmed_at) throw new HttpError(401, 'Email not verified by provider');

  const email = normEmail(sbUser.email);
  const meta = sbUser.user_metadata || {};
  let user = await db().one('SELECT * FROM users WHERE email = $1', [email]);
  let created = false;
  if (!user) {
    user = await db().one('INSERT INTO users (email, name, auth_provider) VALUES ($1, $2, $3) RETURNING *', [
      email,
      String(meta.full_name || meta.name || email.split('@')[0]).slice(0, 100),
      provider,
    ]);
    await claimGuestOrders(user);
    created = true;
    background(sendWelcome(user, requestLanguage(req, settings)));
  }
  setSession(res, user);
  res.status(created ? 201 : 200).json({ user: publicUser(user), created });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional().default(''),
  address: addressSchema.nullish(),
});

router.put('/me', requireUser, async (req, res) => {
  const data = validate(profileSchema, req.body);
  const user = await db().one('UPDATE users SET name = $1, phone = $2, address = $3 WHERE id = $4 RETURNING *', [
    data.name,
    data.phone,
    data.address ? JSON.stringify(data.address) : null,
    req.user.id,
  ]);
  res.json({ user: publicUser(user) });
});

router.put('/me/password', requireUser, limiter, async (req, res) => {
  const data = validate(z.object({ currentPassword: z.string().optional().default(''), newPassword: password }), req.body);
  // Social accounts without a password can set one directly.
  if (req.user.password_hash && !(await checkPassword(data.currentPassword, req.user.password_hash))) {
    throw badRequest('Current password is wrong', { currentPassword: 'wrong' });
  }
  const user = await db().one('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *', [
    await hashPassword(data.newPassword),
    req.user.id,
  ]);
  res.json({ ok: true, user: publicUser(user) });
});

router.post('/forgot', limiter, async (req, res) => {
  const { email } = validate(z.object({ email: z.string().max(200) }), req.body);
  const user = await db().one('SELECT * FROM users WHERE email = $1', [normEmail(email)]);
  if (user) {
    const token = randomToken(32);
    await db().query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [
      sha256(token),
      user.id,
    ]);
    background(sendPasswordReset(user, token, requestLanguage(req, await getSettings())));
  }
  // Same answer either way so emails can't be enumerated.
  res.json({ ok: true });
});

router.post('/reset', limiter, async (req, res) => {
  const data = validate(z.object({ token: z.string().min(10).max(200), password }), req.body);
  const row = await db().one('SELECT * FROM password_resets WHERE token_hash = $1 AND expires_at > now()', [sha256(data.token)]);
  if (!row) throw badRequest('This link is invalid or has expired');
  const user = await db().one('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *', [
    await hashPassword(data.password),
    row.user_id,
  ]);
  await db().query('DELETE FROM password_resets WHERE user_id = $1', [row.user_id]);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

export default router;
