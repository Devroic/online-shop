import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { checkPassword, clearSession, hashPassword, publicUser, requireUser, setSession } from '../auth.js';
import { HttpError, badRequest, randomToken, sha256, validate } from '../utils.js';
import { sendPasswordReset } from '../email.js';
import { config } from '../config.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const addressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  region: z.string().trim().max(100).optional().default(''),
  country: z.string().trim().max(100).optional().default(''),
});
export { addressSchema };

const password = z.string().min(8, 'Password must be at least 8 characters').max(200);

const registerSchema = z.object({
  email: z.email().max(200),
  password,
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(40).optional().default(''),
});

router.post('/register', limiter, async (req, res) => {
  const data = validate(registerSchema, req.body);
  const db = getDb();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(data.email)) {
    throw badRequest('An account with this email already exists', { email: 'exists' });
  }
  const info = db
    .prepare('INSERT INTO users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)')
    .run(data.email, await hashPassword(data.password), data.name, data.phone);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  // Link earlier guest orders placed with the same email.
  db.prepare('UPDATE orders SET user_id = ? WHERE user_id IS NULL AND email = ? COLLATE NOCASE').run(user.id, user.email);
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', limiter, async (req, res) => {
  const { email, password: pw } = validate(z.object({ email: z.string().max(200), password: z.string().max(200) }), req.body);
  const user = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (!user || !(await checkPassword(pw, user.password_hash))) {
    throw new HttpError(401, 'Wrong email or password');
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
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

router.put('/me', requireUser, (req, res) => {
  const data = validate(profileSchema, req.body);
  const db = getDb();
  db.prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?').run(
    data.name,
    data.phone,
    data.address ? JSON.stringify(data.address) : null,
    req.user.id,
  );
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

router.put('/me/password', requireUser, limiter, async (req, res) => {
  const data = validate(z.object({ currentPassword: z.string(), newPassword: password }), req.body);
  if (!(await checkPassword(data.currentPassword, req.user.password_hash))) {
    throw badRequest('Current password is wrong', { currentPassword: 'wrong' });
  }
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(data.newPassword), req.user.id);
  res.json({ ok: true });
});

router.post('/forgot', limiter, (req, res) => {
  const { email } = validate(z.object({ email: z.string().max(200) }), req.body);
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (user) {
    const token = randomToken(32);
    db.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))").run(
      sha256(token),
      user.id,
    );
    sendPasswordReset(user, token);
  }
  // Same answer either way so emails can't be enumerated.
  res.json({ ok: true });
});

router.post('/reset', limiter, async (req, res) => {
  const data = validate(z.object({ token: z.string().min(10).max(200), password }), req.body);
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > datetime('now')")
    .get(sha256(data.token));
  if (!row) throw badRequest('This link is invalid or has expired');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(data.password), row.user_id);
  db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

export default router;
