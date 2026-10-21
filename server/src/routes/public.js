import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { config } from '../config.js';
import { getSettings } from '../settings.js';
import { notFound, paginate, validate } from '../utils.js';
import { getProduct, listProducts, relatedProducts, serializeCategory } from '../services/catalog.js';
import { availablePaymentMethods, quoteCart } from '../services/orders.js';
import { stripeReady } from '../services/payments.js';
import { background, sendContactMessage } from '../email.js';

const router = Router();

/** Settings that are safe for anyone to see (no internal notification email). */
export async function publicSettings() {
  const s = await getSettings();
  const { notifications, ...rest } = s;
  const oauthReady = !!(config.supabase.url && config.supabase.anonKey);
  return {
    ...rest,
    login: { google: oauthReady && s.login.google, facebook: oauthReady && s.login.facebook },
    // Public by design (Supabase "anon" key); used only for Google/Facebook sign-in.
    supabase: oauthReady ? { url: config.supabase.url, anonKey: config.supabase.anonKey } : null,
    paymentMethods: availablePaymentMethods(s, stripeReady()),
  };
}

router.get('/settings', async (_req, res) => {
  const pages = await db().all('SELECT slug, title, show_in_footer FROM pages ORDER BY title');
  res.json({
    settings: await publicSettings(),
    pages: pages.map((p) => ({ slug: p.slug, title: p.title, showInFooter: p.show_in_footer })),
  });
});

router.get('/categories', async (_req, res) => {
  const rows = await db().all(
    `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.active) AS product_count
     FROM categories c WHERE c.active ORDER BY c.sort_order, c.name`,
  );
  res.json(rows.map(serializeCategory));
});

router.get('/products', async (req, res) => {
  const { limit, page, offset } = paginate(req.query);
  const settings = await getSettings();
  const ids = req.query.ids ? String(req.query.ids).split(',').map(Number).filter(Boolean).slice(0, 100) : undefined;
  const { items, total } = await listProducts(
    {
      q: req.query.q,
      category: req.query.category,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      sort: req.query.sort,
      inStock: req.query.inStock === '1',
      featured: req.query.featured === '1',
      ids,
      limit,
      offset,
    },
    { hideOutOfStock: settings.inventory.hideOutOfStock },
  );
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.get('/products/:slug', async (req, res) => {
  const product = await getProduct({ slug: req.params.slug });
  if (!product) throw notFound('Product not found');
  res.json({ product, related: await relatedProducts(product) });
});

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive().nullish(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(100),
  couponCode: z.string().max(50).optional(),
  shippingMethodId: z.number().int().nullish(),
  paymentMethod: z.string().optional(),
});

/** Re-prices a cart with live data. Used by the cart and checkout pages. */
router.post('/cart/quote', async (req, res) => {
  res.json(await quoteCart(validate(cartSchema, req.body)));
});

router.get('/pages/:slug', async (req, res) => {
  const page = await db().one('SELECT * FROM pages WHERE slug = $1', [req.params.slug]);
  if (!page) throw notFound('Page not found');
  res.json({ slug: page.slug, title: page.title, content: page.content, updatedAt: page.updated_at });
});

const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 1000 : 5, standardHeaders: true, legacyHeaders: false });
const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().min(5).max(5000),
});

router.post('/contact', contactLimiter, async (req, res) => {
  const msg = validate(contactSchema, req.body);
  await db().query('INSERT INTO messages (name, email, phone, message) VALUES ($1, $2, $3, $4)', [msg.name, msg.email, msg.phone, msg.message]);
  background(sendContactMessage(msg));
  res.status(201).json({ ok: true });
});

export default router;
