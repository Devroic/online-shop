import crypto from 'node:crypto';
import { db } from '../db.js';
import { config } from '../config.js';

/**
 * The shop's own visitor statistics, shown on the admin dashboard. Privacy first:
 * no cookies, no IP addresses stored. A visitor is a hash of their address and
 * browser with a secret and the day, so the same person counts once per day and
 * cannot be followed from one day to the next.
 */

const KEEP_DAYS = 400; // a year and a bit, for "same time last year"
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|monitor|curl|wget|python|axios|node-fetch/i;

/** The shop's day ("2026-11-23") in its own timezone, so counts match the order statistics. */
const shopDay = (when = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(when);

export const visitorId = (ip, userAgent, day = shopDay()) =>
  crypto.createHash('sha256').update(`${config.jwtSecret}|${day}|${ip}|${userAgent}`).digest('hex').slice(0, 16);

export function deviceOf(userAgent = '') {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/** Where a visit came from, by the site that linked to the shop; '' = typed in or a bookmark. */
export function sourceOf(referrer, ownHost) {
  let host;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
  if (!host || host === String(ownHost || '').toLowerCase().replace(/^www\./, '')) return '';
  const known = [
    [/(^|\.)google\./, 'Google'],
    [/(^|\.)bing\.com$/, 'Bing'],
    [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
    [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com)$/, 'Facebook'],
    [/(^|\.)instagram\.com$/, 'Instagram'],
    [/(^|\.)tiktok\.com$/, 'TikTok'],
    [/(^|\.)(twitter\.com|x\.com|t\.co)$/, 'X'],
    [/(^|\.)youtube\.com$/, 'YouTube'],
    [/(^|\.)reddit\.com$/, 'Reddit'],
    [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
    [/(^|\.)(viber\.com)$/, 'Viber'],
    [/(^|\.)(stripe\.com)$/, ''], // coming back from card payment is not a new visit
  ];
  for (const [re, name] of known) if (re.test(host)) return name;
  return host;
}

/**
 * Records one page view. `path` is the page's address without query or #, already
 * cleaned by the shop; admin pages and bots are not counted.
 */
export async function recordView({ path, referrer, ip, userAgent, country, host }) {
  if (!path || BOT.test(userAgent || '') || path === '/admin' || path.startsWith('/admin/')) return false;
  const clean = path.split(/[?#]/)[0].replace(/^\/order\/[^/]+/, '/order/[number]').slice(0, 300);
  await db().query('INSERT INTO page_views (path, visitor, country, device, source) VALUES ($1, $2, $3, $4, $5)', [
    clean,
    visitorId(ip, userAgent),
    /^[A-Z]{2}$/.test(country || '') ? country : '',
    deviceOf(userAgent),
    referrer ? sourceOf(referrer, host) : '',
  ]);
  // Now and then, forget views older than KEEP_DAYS.
  if (Math.random() < 0.01) await db().query(`DELETE FROM page_views WHERE created_at < now() - interval '${KEEP_DAYS} days'`);
  return true;
}

/** Visitor statistics for the last `days` days (the shop's days), for the admin dashboard. */
export async function visitorStats(days) {
  const TZ = config.timezone;
  const localDay = `(created_at AT TIME ZONE '${TZ}')::date`;
  const today = `(now() AT TIME ZONE '${TZ}')::date`;
  const inPeriod = `${localDay} > ${today} - $1::int`;
  const all = (sql) => db().all(sql, [days]);
  const one = async (sql) => (await db().all(sql, [days]))[0];

  // A visitor is counted once per day (the id changes every day).
  const totals = await one(
    `SELECT COUNT(*)::int AS views, COUNT(DISTINCT (visitor, ${localDay}))::int AS visitors FROM page_views WHERE ${inPeriod}`,
  );
  const series = await all(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(v.visitors, 0)::int AS visitors, COALESCE(v.views, 0)::int AS views
     FROM generate_series(${today} - ($1::int - 1), ${today}, interval '1 day') d
     LEFT JOIN (SELECT ${localDay} AS day, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views
                FROM page_views WHERE ${inPeriod} GROUP BY 1) v ON v.day = d::date
     ORDER BY d`,
  );
  // Orders since counting began, so a shop that just started counting shows a true rate.
  const firstView = (await db().one('SELECT MIN(created_at) AS at FROM page_views')).at;
  const orders = firstView
    ? (
        await db().one(
          `SELECT COUNT(*)::int AS n FROM orders
           WHERE status NOT IN ('cancelled', 'returned') AND ${inPeriod} AND created_at >= $2`,
          [days, firstView],
        )
      ).n
    : 0;
  const group = (column, limit) =>
    all(
      `SELECT ${column} AS key, COUNT(DISTINCT (visitor, ${localDay}))::int AS visitors
       FROM page_views WHERE ${inPeriod} GROUP BY 1 ORDER BY visitors DESC, key LIMIT ${limit}`,
    );
  const topProducts = await all(
    `SELECT p.id, p.name, COUNT(*)::int AS views,
       COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')
                   AND (o.created_at AT TIME ZONE '${TZ}')::date > ${today} - $1::int), 0)::int AS sold
     FROM page_views v JOIN products p ON v.path = '/product/' || p.slug
     WHERE ${inPeriod.replace('created_at', 'v.created_at')}
     GROUP BY p.id, p.name ORDER BY views DESC, p.name LIMIT 8`,
  );
  return {
    since: firstView,
    visitors: totals.visitors,
    views: totals.views,
    orders,
    conversion: totals.visitors ? orders / totals.visitors : 0,
    series,
    topProducts,
    sources: await group("COALESCE(NULLIF(source, ''), '')", 8),
    countries: await group('country', 8),
    devices: await group('device', 3),
  };
}
