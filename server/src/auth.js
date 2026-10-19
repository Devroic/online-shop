import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { getDb } from './db.js';
import { HttpError } from './utils.js';

const COOKIE = 'shop_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    address: u.address ? JSON.parse(u.address) : null,
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
export function loadUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, config.jwtSecret);
      req.user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(sub) || null;
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireUser(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Please sign in');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admins only');
  next();
}
