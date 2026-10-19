import crypto from 'node:crypto';
import { transliterate } from './i18n.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

/** Parses `data` with a zod schema, throwing a 400 with field errors on failure. */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    throw badRequest('Validation failed', fields);
  }
  return result.data;
}

/** URL-friendly slug; non-Latin letters are transliterated so product URLs stay readable. */
export function slugify(text) {
  return transliterate(String(text).toLowerCase())
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Lowercase + strip accents, so "cafe" finds "Café" (and the same for Greek). */
export function normalizeSearch(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u03c2/g, '\u03c3'); // Greek final sigma → sigma
}

/** Returns `base` or `base-2`, `base-3`… so it is unique in `table.slug`. */
export async function uniqueSlug(conn, table, base, excludeId) {
  let slug = base;
  for (let i = 2; ; i++) {
    const row = await conn.one(`SELECT id FROM ${table} WHERE slug = $1`, [slug]);
    if (!row || row.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export const toBool = (v) => v === true || v === 1 || v === '1' || v === 'true';

export function parseJson(value, fallback = null) {
  if (value == null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Collects positional parameters for dynamic SQL: `where.push(\`x = ${p(v)}\`)`. */
export function params() {
  const list = [];
  const p = (value) => {
    list.push(value);
    return `$${list.length}`;
  };
  return { list, p };
}

export function formatMoney(cents, settings) {
  return new Intl.NumberFormat(settings.locale || 'el-GR', {
    style: 'currency',
    currency: settings.currency || 'EUR',
  }).format(cents / 100);
}

export function paginate(query, { defaultLimit = 24, maxLimit = 100 } = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
}
