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
const valueAt = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * Zod issue → short error code the client translates (client/src/lib/validation.js):
 * required, email, url, min_length:8, max_length:200, min:0, max:100, integer, number…
 * A schema can also set its own code as the message, e.g. z.literal(true, { message: 'accept_terms' }).
 */
function issueCode(issue, data) {
  if (/^[a-z_]+(:[\w.-]+)?$/.test(issue.message)) return issue.message;
  const value = valueAt(data, issue.path);
  const blank = value === undefined || value === null || (typeof value === 'string' && !value.trim());
  switch (issue.code) {
    case 'invalid_type':
      return blank ? 'required' : issue.expected === 'number' || issue.expected === 'int' ? 'number' : 'invalid';
    case 'too_small':
      if (issue.origin === 'string') return blank || issue.minimum <= 1 ? 'required' : `min_length:${issue.minimum}`;
      if (issue.origin === 'array' || issue.origin === 'set') return 'required';
      return `min:${issue.inclusive === false ? Number(issue.minimum) + 1 : issue.minimum}`;
    case 'too_big':
      if (issue.origin === 'string') return `max_length:${issue.maximum}`;
      if (issue.origin === 'array' || issue.origin === 'set') return `max_items:${issue.maximum}`;
      return `max:${issue.inclusive === false ? Number(issue.maximum) - 1 : issue.maximum}`;
    case 'invalid_format':
      return blank ? 'required' : issue.format === 'email' ? 'email' : issue.format === 'url' ? 'url' : 'invalid';
    case 'invalid_value':
    case 'invalid_union':
      return blank ? 'required' : 'invalid';
    default:
      return 'invalid';
  }
}

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issueCode(issue, data);
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
