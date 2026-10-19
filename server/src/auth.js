import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError } from './utils.js';

const COOKIE = 'shop_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => (hash ? bcrypt.compare(pw, hash) : Promise.resolve(false));

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    address: u.address ?? null,
    provider: u.auth_provider,
    hasPassword: !!u.password_hash,
    createdAt: u.created_at,
  };
}

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: Math.floor(MAX_AGE_MS / 1000) });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attaches `req.user` when a valid session cookie is present. Never rejects. */
export async function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  req.user = null;
  if (token) {
    let sub;
    try {
      ({ sub } = jwt.verify(token, config.jwtSecret));
    } catch {
      /* expired or tampered: treat as signed out */
    }
    if (sub) req.user = await db().one('SELECT * FROM users WHERE id = $1', [sub]);
  }
  next();
}

/** Emails are stored lowercase so lookups are case-insensitive. */
export const normEmail = (email) => String(email).trim().toLowerCase();

export function requireUser(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admins only');
  next();
}
