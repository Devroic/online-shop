import { Router } from 'express';
import { z } from 'zod';
import { db, tx } from '../db.js';
import { config } from '../config.js';
import { getSettings, updateSettings } from '../settings.js';
import { requireAdmin, publicUser } from '../auth.js';
import { badRequest, normalizeSearch, notFound, paginate, params, slugify, uniqueSlug, validate } from '../utils.js';
import { getProduct, listProducts, productSearchText, serializeCategory } from '../services/catalog.js';
import { ORDER_STATUSES, PAYMENT_STATUSES, getOrder, serializeOrder, updateOrder } from '../services/orders.js';
import { stripeReady } from '../services/payments.js';
import { deleteFile, saveFile, storageMode, upload } from '../storage.js';
import { background, emailConfigured, sendStatusUpdate } from '../email.js';

const router = Router();
router.use(requireAdmin);

const money = z.number().int().min(0).max(100_000_000);
const optMoney = money.nullish();
const TZ = config.timezone;

/* ----------------------------------------------------------------- stats */

router.get('/stats', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
  const q = (sql, vals) => db().one(sql, vals);
  const sum = (where, vals = []) =>
    q(`SELECT COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::int AS revenue FROM orders WHERE status <> 'cancelled' AND ${where}`, vals);
  const localDay = `(created_at AT TIME ZONE '${TZ}')::date`;
  const today = `(now() AT TIME ZONE '${TZ}')::date`;
  const since = `created_at >= now() - make_interval(days => $1)`;

  const series = await db().all(
    `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(o.orders, 0)::int AS orders, COALESCE(o.revenue, 0)::int AS revenue
     FROM generate_series(${today} - ($1::int - 1), ${today}, interval '1 day') d
     LEFT JOIN (SELECT ${localDay} AS day, COUNT(*) AS orders, SUM(total) AS revenue FROM orders
                WHERE status <> 'cancelled' GROUP BY 1) o ON o.day = d::date
     ORDER BY d`,
    [days],
  );
  const threshold = (await getSettings()).inventory.lowStockThreshold;

  res.json({
    today: await sum(`${localDay} = ${today}`),
    period: await sum(since, [days]),
    allTime: await sum('TRUE'),
    statusCounts: Object.fromEntries(
      (await db().all('SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status')).map((r) => [r.status, r.n]),
    ),
    series,
    topProducts: await db().all(
      `SELECT oi.product_id AS id, oi.name, SUM(oi.quantity)::int AS quantity, SUM(oi.price * oi.quantity)::int AS revenue
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status <> 'cancelled' AND o.${since}
       GROUP BY oi.product_id, oi.name ORDER BY quantity DESC LIMIT 5`,
      [days],
    ),
    lowStock: await db().all(
      `SELECT * FROM (
         SELECT p.id, p.name, p.stock, NULL AS variant FROM products p
           WHERE p.track_stock AND p.active AND p.stock <= $1
             AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
         UNION ALL
         SELECT p.id, p.name, v.stock, v.name AS variant FROM product_variants v JOIN products p ON p.id = v.product_id
           WHERE p.track_stock AND p.active AND v.stock <= $1
       ) s ORDER BY stock LIMIT 10`,
      [threshold],
    ),
    recentOrders: (
      await db().all(
        'SELECT o.*, (SELECT SUM(quantity)::int FROM order_items WHERE order_id = o.id) AS item_count FROM orders o ORDER BY id DESC LIMIT 8',
      )
    ).map((o) => serializeOrder(o)),
    unreadMessages: (await q('SELECT COUNT(*)::int AS n FROM messages WHERE NOT read')).n,
    customers: (await q("SELECT COUNT(*)::int AS n FROM users WHERE role = 'customer'")).n,
    products: (await q('SELECT COUNT(*)::int AS n FROM products')).n,
  });
});

/* --------------------------------------------------------------- uploads */

router.post('/uploads', upload.array('files', 20), async (req, res) => {
  if (!req.files?.length) throw badRequest('No files uploaded');
  const urls = [];
  for (const file of req.files) urls.push(await saveFile(file.buffer, file.mimetype));
  res.status(201).json({ urls });
});

/* -------------------------------------------------------------- products */

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(100).optional().default(''),
  price: optMoney,
  stock: z.number().int().min(0).max(1_000_000).default(0),
});

const productSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(100).optional(),
  description: z.string().max(20000).optional().default(''),
  price: money,
  compareAtPrice: optMoney,
  sku: z.string().trim().max(100).optional().default(''),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  trackStock: z.boolean().default(true),
  categoryId: z.number().int().positive().nullish(),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  images: z.array(z.string().max(1000)).max(20).default([]),
  variants: z.array(variantSchema).max(100).default([]),
});

router.get('/products', async (req, res) => {
  const { limit, page, offset } = paginate(req.query, { defaultLimit: 50, maxLimit: 200 });
  const { items, total } = await listProducts(
    { q: req.query.q, category: req.query.category, sort: req.query.sort || 'newest', limit, offset },
    { admin: true },
  );
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.get('/products/:id', async (req, res) => {
  const product = await getProduct({ id: Number(req.params.id) }, { admin: true });
  if (!product) throw notFound();
  res.json(product);
});

/** Creates or updates a product with its images and variants in one transaction. */
export async function saveProduct(id, data) {
  let removedImages = [];
  const savedId = await tx(async (t) => {
    const slug = await uniqueSlug(t, 'products', slugify(data.slug || data.name), id);
    const row = [
      data.name,
      slug,
      data.description,
      data.price,
      data.compareAtPrice ?? null,
      data.sku,
      data.stock,
      data.trackStock,
      data.categoryId ?? null,
      data.featured,
      data.active,
      productSearchText(data),
    ];
    if (id) {
      await t.query(
        `UPDATE products SET name=$1, slug=$2, description=$3, price=$4, compare_at_price=$5, sku=$6, stock=$7,
           track_stock=$8, category_id=$9, featured=$10, active=$11, search_text=$12, updated_at=now() WHERE id=$13`,
        [...row, id],
      );
    } else {
      ({ id } = await t.one(
        `INSERT INTO products (name, slug, description, price, compare_at_price, sku, stock, track_stock, category_id,
           featured, active, search_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        row,
      ));
    }

    const old = (await t.all('SELECT url FROM product_images WHERE product_id = $1', [id])).map((r) => r.url);
    removedImages = old.filter((u) => !data.images.includes(u));
    await t.query('DELETE FROM product_images WHERE product_id = $1', [id]);
    for (const [i, url] of data.images.entries()) {
      await t.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)', [id, url, i]);
    }

    const keep = data.variants.filter((v) => v.id).map((v) => v.id);
    await t.query('DELETE FROM product_variants WHERE product_id = $1 AND NOT (id = ANY($2::int[]))', [id, keep]);
    for (const [i, v] of data.variants.entries()) {
      if (v.id) {
        await t.query('UPDATE product_variants SET name=$1, sku=$2, price=$3, stock=$4, sort_order=$5 WHERE id=$6 AND product_id=$7', [
          v.name, v.sku, v.price ?? null, v.stock, i, v.id, id,
        ]);
      } else {
        await t.query('INSERT INTO product_variants (product_id, name, sku, price, stock, sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [
          id, v.name, v.sku, v.price ?? null, v.stock, i,
        ]);
      }
    }
    return id;
  });
  background(Promise.all(removedImages.map(deleteFile)));
  return getProduct({ id: savedId }, { admin: true });
}

router.post('/products', async (req, res) => {
  res.status(201).json(await saveProduct(null, validate(productSchema, req.body)));
});

router.put('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await getProduct({ id }, { admin: true }))) throw notFound();
  res.json(await saveProduct(id, validate(productSchema, req.body)));
});

/** Quick inline edits from the product list (stock, price, active, featured). */
router.patch('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = validate(
    z.object({ stock: z.number().int().min(0).optional(), price: money.optional(), active: z.boolean().optional(), featured: z.boolean().optional() }),
    req.body,
  );
  const { list, p } = params();
  const sets = Object.entries(data).map(([k, v]) => `${k} = ${p(v)}`);
  if (sets.length) await db().query(`UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = ${p(id)}`, list);
  const product = await getProduct({ id }, { admin: true });
  if (!product) throw notFound();
  res.json(product);
});

router.delete('/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  const images = await db().all('SELECT url FROM product_images WHERE product_id = $1', [id]);
  const r = await db().query('DELETE FROM products WHERE id = $1', [id]);
  if (!r.rowCount) throw notFound();
  background(Promise.all(images.map((i) => deleteFile(i.url))));
  res.json({ ok: true });
});

/* ------------------------------------------------------------ categories */

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().max(2000).optional().default(''),
  image: z.string().max(1000).nullish(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

router.get('/categories', async (_req, res) => {
  const rows = await db().all(
    'SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c ORDER BY sort_order, name',
  );
  res.json(rows.map(serializeCategory));
});

export async function saveCategory(id, data, conn = db()) {
  const slug = await uniqueSlug(conn, 'categories', slugify(data.slug || data.name), id);
  const vals = [data.name, slug, data.description, data.image ?? null, data.sortOrder, data.active, normalizeSearch(data.name)];
  const row = id
    ? await conn.one(
        'UPDATE categories SET name=$1, slug=$2, description=$3, image=$4, sort_order=$5, active=$6, search_name=$7 WHERE id=$8 RETURNING *',
        [...vals, id],
      )
    : await conn.one(
        'INSERT INTO categories (name, slug, description, image, sort_order, active, search_name) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        vals,
      );
  return serializeCategory(row);
}

router.post('/categories', async (req, res) => res.status(201).json(await saveCategory(null, validate(categorySchema, req.body))));
router.put('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!(await db().one('SELECT id FROM categories WHERE id = $1', [id]))) throw notFound();
  res.json(await saveCategory(id, validate(categorySchema, req.body)));
});
router.delete('/categories/:id', async (req, res) => {
  if (!(await db().query('DELETE FROM categories WHERE id = $1', [Number(req.params.id)])).rowCount) throw notFound();
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- orders */

function orderFilters(query) {
  const where = [];
  const { list, p } = params();
  if (query.status && ORDER_STATUSES.includes(query.status)) where.push(`o.status = ${p(query.status)}`);
  if (query.payment && PAYMENT_STATUSES.includes(query.payment)) where.push(`o.payment_status = ${p(query.payment)}`);
  if (query.q) {
    const like = p(`%${String(query.q).trim().toLowerCase()}%`);
    where.push(`(lower(o.number) LIKE ${like} OR o.email LIKE ${like} OR lower(o.customer_name) LIKE ${like} OR o.phone LIKE ${like})`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.from || '')) where.push(`(o.created_at AT TIME ZONE '${TZ}')::date >= ${p(query.from)}::date`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.to || '')) where.push(`(o.created_at AT TIME ZONE '${TZ}')::date <= ${p(query.to)}::date`);
  if (query.customer) where.push(`o.user_id = ${p(Number(query.customer))}`);
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', list, p };
}

router.get('/orders', async (req, res) => {
  const { limit, page, offset } = paginate(req.query, { defaultLimit: 25, maxLimit: 200 });
  const { sql, list, p } = orderFilters(req.query);
  const { n: total } = await db().one(`SELECT COUNT(*)::int AS n FROM orders o ${sql}`, list);
  const rows = await db().all(
    `SELECT o.*, (SELECT SUM(quantity)::int FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o ${sql} ORDER BY o.id DESC LIMIT ${p(limit)} OFFSET ${p(offset)}`,
    list,
  );
  res.json({ items: rows.map((o) => serializeOrder(o)), total, page, pages: Math.ceil(total / limit) });
});

router.get('/orders.csv', async (req, res) => {
  const { sql, list } = orderFilters(req.query);
  const rows = await db().all(`SELECT o.* FROM orders o ${sql} ORDER BY o.id DESC`, list);
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['number', 'date', 'customer', 'email', 'phone', 'address', 'shipping', 'payment', 'payment_status', 'status', 'subtotal', 'discount', 'shipping_cost', 'total'];
  const lines = rows.map((o) => {
    const a = o.shipping_address;
    return [
      o.number, new Date(o.created_at).toISOString(), o.customer_name, o.email, o.phone,
      a ? `${a.street}, ${a.postalCode} ${a.city}` : '', o.shipping_name, o.payment_method, o.payment_status, o.status,
      (o.subtotal / 100).toFixed(2), (o.discount / 100).toFixed(2), (o.shipping_cost / 100).toFixed(2), (o.total / 100).toFixed(2),
    ].map(cell).join(',');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send('﻿' + [head.join(','), ...lines].join('\n'));
});

router.get('/orders/:id', async (req, res) => {
  const order = await getOrder({ id: Number(req.params.id) });
  if (!order) throw notFound();
  res.json(order);
});

const orderUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  trackingNumber: z.string().trim().max(200).optional(),
  adminNotes: z.string().max(5000).optional(),
  notifyCustomer: z.boolean().optional(),
});

router.put('/orders/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { notifyCustomer, ...patch } = validate(orderUpdateSchema, req.body);
  const before = await getOrder({ id });
  if (!before) throw notFound();
  const order = await updateOrder(id, patch);
  const changed = order.status !== before.status || (patch.trackingNumber && patch.trackingNumber !== before.trackingNumber);
  if (notifyCustomer && changed) background(sendStatusUpdate(order));
  res.json(order);
});

/* ------------------------------------------------------------- customers */

router.get('/customers', async (req, res) => {
  const { limit, page, offset } = paginate(req.query, { defaultLimit: 50 });
  const where = [];
  const { list, p } = params();
  if (req.query.q) {
    const like = p(`%${String(req.query.q).toLowerCase()}%`);
    where.push(`(u.email LIKE ${like} OR lower(u.name) LIKE ${like} OR u.phone LIKE ${like})`);
  }
  if (['customer', 'admin'].includes(req.query.role)) where.push(`u.role = ${p(req.query.role)}`);
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { n: total } = await db().one(`SELECT COUNT(*)::int AS n FROM users u ${sql}`, list);
  const rows = await db().all(
    `SELECT u.*, COUNT(o.id)::int AS order_count, COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0)::int AS spent
     FROM users u LEFT JOIN orders o ON o.user_id = u.id ${sql} GROUP BY u.id ORDER BY u.id DESC LIMIT ${p(limit)} OFFSET ${p(offset)}`,
    list,
  );
  res.json({
    items: rows.map((u) => ({ ...publicUser(u), orderCount: u.order_count, spent: u.spent })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

router.put('/customers/:id/role', async (req, res) => {
  const { role } = validate(z.object({ role: z.enum(['customer', 'admin']) }), req.body);
  const id = Number(req.params.id);
  if (id === req.user.id && role !== 'admin') throw badRequest('You cannot remove your own admin access');
  if (!(await db().query('UPDATE users SET role = $1 WHERE id = $2', [role, id])).rowCount) throw notFound();
  res.json({ ok: true });
});

/* --------------------------------------------------------------- coupons */

const couponSchema = z.object({
  code: z.string().trim().min(2).max(50).transform((s) => s.toUpperCase()),
  type: z.enum(['percent', 'fixed', 'free_shipping']),
  value: z.number().int().min(0).default(0),
  minOrder: money.default(0),
  maxUses: z.number().int().positive().nullish(),
  expiresAt: z.string().max(40).nullish(),
  active: z.boolean().default(true),
});

const serializeCoupon = (c) => ({
  id: c.id, code: c.code, type: c.type, value: c.value, minOrder: c.min_order, maxUses: c.max_uses,
  usedCount: c.used_count, expiresAt: c.expires_at, active: c.active, createdAt: c.created_at,
});

router.get('/coupons', async (_req, res) => {
  res.json((await db().all('SELECT * FROM coupons ORDER BY id DESC')).map(serializeCoupon));
});

async function saveCoupon(id, d) {
  if (d.type === 'percent' && d.value > 100) throw badRequest('Validation failed', { value: 'max 100' });
  const clash = await db().one('SELECT id FROM coupons WHERE code = $1', [d.code]);
  if (clash && clash.id !== id) throw badRequest('Validation failed', { code: 'exists' });
  const vals = [d.code, d.type, d.value, d.minOrder, d.maxUses ?? null, d.expiresAt || null, d.active];
  const row = id
    ? await db().one(
        'UPDATE coupons SET code=$1, type=$2, value=$3, min_order=$4, max_uses=$5, expires_at=$6, active=$7 WHERE id=$8 RETURNING *',
        [...vals, id],
      )
    : await db().one('INSERT INTO coupons (code, type, value, min_order, max_uses, expires_at, active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', vals);
  if (!row) throw notFound();
  return serializeCoupon(row);
}

router.post('/coupons', async (req, res) => res.status(201).json(await saveCoupon(null, validate(couponSchema, req.body))));
router.put('/coupons/:id', async (req, res) => res.json(await saveCoupon(Number(req.params.id), validate(couponSchema, req.body))));
router.delete('/coupons/:id', async (req, res) => {
  await db().query('DELETE FROM coupons WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- shipping */

const shippingSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  price: money,
  freeOver: optMoney,
  requiresAddress: z.boolean().default(true),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const serializeShipping = (m) => ({
  id: m.id, name: m.name, description: m.description, price: m.price, freeOver: m.free_over,
  requiresAddress: m.requires_address, active: m.active, sortOrder: m.sort_order,
});

router.get('/shipping', async (_req, res) => {
  res.json((await db().all('SELECT * FROM shipping_methods ORDER BY sort_order, id')).map(serializeShipping));
});

async function saveShipping(id, d) {
  const vals = [d.name, d.description, d.price, d.freeOver ?? null, d.requiresAddress, d.active, d.sortOrder];
  const row = id
    ? await db().one(
        'UPDATE shipping_methods SET name=$1, description=$2, price=$3, free_over=$4, requires_address=$5, active=$6, sort_order=$7 WHERE id=$8 RETURNING *',
        [...vals, id],
      )
    : await db().one(
        'INSERT INTO shipping_methods (name, description, price, free_over, requires_address, active, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        vals,
      );
  if (!row) throw notFound();
  return serializeShipping(row);
}

router.post('/shipping', async (req, res) => res.status(201).json(await saveShipping(null, validate(shippingSchema, req.body))));
router.put('/shipping/:id', async (req, res) => res.json(await saveShipping(Number(req.params.id), validate(shippingSchema, req.body))));
router.delete('/shipping/:id', async (req, res) => {
  await db().query('DELETE FROM shipping_methods WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- pages */

const pageSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100000).default(''),
  showInFooter: z.boolean().default(true),
});

router.get('/pages', async (_req, res) => {
  res.json(
    (await db().all('SELECT * FROM pages ORDER BY title')).map((p) => ({
      slug: p.slug, title: p.title, content: p.content, showInFooter: p.show_in_footer, updatedAt: p.updated_at,
    })),
  );
});

export async function upsertPage(d, conn = db()) {
  await conn.query(
    `INSERT INTO pages (slug, title, content, show_in_footer) VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET title = excluded.title, content = excluded.content,
       show_in_footer = excluded.show_in_footer, updated_at = now()`,
    [d.slug, d.title, d.content, d.showInFooter ?? true],
  );
}

router.put('/pages/:slug', async (req, res) => {
  const d = validate(pageSchema, { ...req.body, slug: slugify(req.body.slug || req.params.slug) });
  await tx(async (t) => {
    if (d.slug !== req.params.slug) await t.query('DELETE FROM pages WHERE slug = $1', [req.params.slug]);
    await upsertPage(d, t);
  });
  res.json(d);
});

router.delete('/pages/:slug', async (req, res) => {
  await db().query('DELETE FROM pages WHERE slug = $1', [req.params.slug]);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- messages */

router.get('/messages', async (_req, res) => {
  res.json(
    (await db().all('SELECT * FROM messages ORDER BY id DESC LIMIT 500')).map((m) => ({
      id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, read: m.read, createdAt: m.created_at,
    })),
  );
});

router.put('/messages/:id', async (req, res) => {
  const { read } = validate(z.object({ read: z.boolean() }), req.body);
  await db().query('UPDATE messages SET read = $1 WHERE id = $2', [read, Number(req.params.id)]);
  res.json({ ok: true });
});

router.delete('/messages/:id', async (req, res) => {
  await db().query('DELETE FROM messages WHERE id = $1', [Number(req.params.id)]);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- settings */

router.get('/settings', async (_req, res) =>
  res.json({
    ...(await getSettings()),
    _meta: {
      stripeConfigured: stripeReady(),
      emailConfigured: emailConfigured(),
      storage: storageMode(),
      socialLoginConfigured: !!(config.supabase.url && config.supabase.anonKey),
      supabaseUrl: config.supabase.url || '',
    },
  }),
);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const optHex = z.union([hex, z.literal('')]);
const settingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(100),
    tagline: z.string().max(200),
    logoUrl: z.string().max(1000),
    faviconUrl: z.string().max(1000),
    language: z.enum(['el', 'en']),
    currency: z.string().length(3),
    locale: z.string().max(20),
    theme: z
      .object({
        primary: hex, accent: hex, background: hex, surface: hex, text: hex,
        radius: z.number().min(0).max(32),
        font: z.string().max(60),
        mode: z.enum(['auto', 'light', 'dark']),
        dark: z.object({ primary: optHex, accent: optHex, background: optHex, surface: optHex, text: optHex }).partial(),
      })
      .partial(),
    announcement: z.string().max(300),
    hero: z.object({ title: z.string().max(200), subtitle: z.string().max(400), imageUrl: z.string().max(1000), ctaText: z.string().max(60), ctaLink: z.string().max(300) }).partial(),
    contact: z.object({ email: z.string().max(200), phone: z.string().max(60), address: z.string().max(300), hours: z.string().max(300) }).partial(),
    social: z.object({ facebook: z.string().max(300), instagram: z.string().max(300), tiktok: z.string().max(300) }).partial(),
    login: z.object({ google: z.boolean(), apple: z.boolean() }).partial(),
    payments: z
      .object({
        cod: z.object({ enabled: z.boolean(), fee: money }).partial(),
        bank: z.object({ enabled: z.boolean(), details: z.string().max(2000) }).partial(),
        card: z.object({ enabled: z.boolean() }).partial(),
      })
      .partial(),
    checkout: z.object({ requirePhone: z.boolean(), allowGuest: z.boolean(), pricesIncludeTax: z.boolean(), termsPage: z.string().max(80) }).partial(),
    inventory: z.object({ lowStockThreshold: z.number().int().min(0), hideOutOfStock: z.boolean() }).partial(),
    notifications: z.object({ orderEmail: z.string().max(200) }).partial(),
    seo: z.object({ title: z.string().max(200), description: z.string().max(500) }).partial(),
    orderPrefix: z.string().max(10),
  })
  .partial();

router.put('/settings', async (req, res) => {
  res.json(await updateSettings(validate(settingsSchema, req.body)));
});

export default router;
