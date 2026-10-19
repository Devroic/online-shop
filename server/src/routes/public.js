import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import { getSettings } from '../settings.js';
import { notFound, paginate, validate } from '../utils.js';
import { getProduct, listProducts, relatedProducts, serializeCategory } from '../services/catalog.js';
import { availablePaymentMethods, quoteCart } from '../services/orders.js';
import { stripeReady } from '../services/payments.js';
import { sendContactMessage } from '../email.js';

const router = Router();

/** Settings that are safe for anyone to see (no internal notification email). */
export function publicSettings() {
  const s = getSettings();
  const { notifications, ...rest } = s;
  return { ...rest, paymentMethods: availablePaymentMethods(s, stripeReady()) };
}

router.get('/settings', (_req, res) => {
  const db = getDb();
  const pages = db.prepare('SELECT slug, title, show_in_footer FROM pages ORDER BY title').all();
  res.json({
    settings: publicSettings(),
    pages: pages.map((p) => ({ slug: p.slug, title: p.title, showInFooter: !!p.show_in_footer })),
  });
});

router.get('/categories', (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
       FROM categories c WHERE c.active = 1 ORDER BY c.sort_order, c.name`,
    )
    .all();
  res.json(rows.map(serializeCategory));
});

router.get('/products', (req, res) => {
  const { limit, page, offset } = paginate(req.query);
  const settings = getSettings();
  const ids = req.query.ids ? String(req.query.ids).split(',').map(Number).filter(Boolean).slice(0, 100) : undefined;
  const { items, total } = listProducts(
    { ...req.query, inStock: req.query.inStock === '1', featured: req.query.featured === '1', ids, limit, offset },
    { hideOutOfStock: settings.inventory.hideOutOfStock },
  );
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.get('/products/:slug', (req, res) => {
  const product = getProduct({ slug: req.params.slug });
  if (!product) throw notFound('Product not found');
  res.json({ product, related: relatedProducts(product) });
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
router.post('/cart/quote', (req, res) => {
  res.json(quoteCart(validate(cartSchema, req.body)));
});

router.get('/pages/:slug', (req, res) => {
  const page = getDb().prepare('SELECT * FROM pages WHERE slug = ?').get(req.params.slug);
  if (!page) throw notFound('Page not found');
  res.json({ slug: page.slug, title: page.title, content: page.content, updatedAt: page.updated_at });
});

const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().min(5).max(5000),
});

router.post('/contact', contactLimiter, (req, res) => {
  const msg = validate(contactSchema, req.body);
  getDb().prepare('INSERT INTO messages (name, email, phone, message) VALUES (?, ?, ?, ?)').run(msg.name, msg.email, msg.phone, msg.message);
  sendContactMessage(msg);
  res.status(201).json({ ok: true });
});

export default router;
