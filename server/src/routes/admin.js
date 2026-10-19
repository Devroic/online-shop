import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { getSettings, updateSettings } from '../settings.js';
import { requireAdmin, publicUser } from '../auth.js';
import { badRequest, notFound, paginate, slugify, uniqueSlug, validate } from '../utils.js';
import { getProduct, listProducts, serializeCategory } from '../services/catalog.js';
import { ORDER_STATUSES, PAYMENT_STATUSES, getOrder, serializeOrder, updateOrder } from '../services/orders.js';
import { deleteUpload, saveImage, upload } from '../uploads.js';
import { sendStatusUpdate } from '../email.js';

const router = Router();
router.use(requireAdmin);

const money = z.number().int().min(0).max(100_000_000);
const optMoney = money.nullish();

/* ----------------------------------------------------------------- stats */

router.get('/stats', (req, res) => {
  const db = getDb();
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
  const valid = "status != 'cancelled'";
  const sum = (where, ...p) =>
    db.prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE ${valid} AND ${where}`).get(...p);

  const byDay = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS day, COUNT(*) AS orders, SUM(total) AS revenue FROM orders
       WHERE ${valid} AND created_at >= datetime('now', ?) GROUP BY day ORDER BY day`,
    )
    .all(`-${days} days`);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = byDay.find((r) => r.day === key);
    series.push({ day: key, orders: row?.orders || 0, revenue: row?.revenue || 0 });
  }

  const threshold = getSettings().inventory.lowStockThreshold;
  res.json({
    today: sum("date(created_at, 'localtime') = date('now', 'localtime')"),
    period: sum('created_at >= datetime(?, ?)', 'now', `-${days} days`),
    allTime: sum('1 = 1'),
    statusCounts: Object.fromEntries(
      db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all().map((r) => [r.status, r.n]),
    ),
    series,
    topProducts: db
      .prepare(
        `SELECT oi.product_id AS id, oi.name, SUM(oi.quantity) AS quantity, SUM(oi.price * oi.quantity) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.${valid} AND o.created_at >= datetime('now', ?)
         GROUP BY oi.product_id, oi.name ORDER BY quantity DESC LIMIT 5`,
      )
      .all(`-${days} days`),
    lowStock: db
      .prepare(
        `SELECT p.id, p.name, p.stock, NULL AS variant FROM products p
           WHERE p.track_stock = 1 AND p.active = 1 AND p.stock <= ?
             AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
         UNION ALL
         SELECT p.id, p.name, v.stock, v.name AS variant FROM product_variants v JOIN products p ON p.id = v.product_id
           WHERE p.track_stock = 1 AND p.active = 1 AND v.stock <= ?
         ORDER BY stock LIMIT 10`,
      )
      .all(threshold, threshold),
    recentOrders: db
      .prepare(`SELECT o.*, (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count FROM orders o ORDER BY id DESC LIMIT 8`)
      .all()
      .map((o) => serializeOrder(o)),
    unreadMessages: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE read = 0').get().n,
    customers: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").get().n,
    products: db.prepare('SELECT COUNT(*) AS n FROM products').get().n,
  });
});

/* --------------------------------------------------------------- uploads */

router.post('/uploads', upload.array('files', 20), async (req, res) => {
  if (!req.files?.length) throw badRequest('No files uploaded');
  const maxSize = req.query.kind === 'logo' ? 600 : 1600;
  const urls = [];
  for (const file of req.files) urls.push(await saveImage(file, { maxSize }));
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
  images: z.array(z.string().max(500)).max(20).default([]),
  variants: z.array(variantSchema).max(100).default([]),
});

router.get('/products', (req, res) => {
  const { limit, page, offset } = paginate(req.query, { defaultLimit: 50, maxLimit: 200 });
  const { items, total } = listProducts(
    { q: req.query.q, category: req.query.category, sort: req.query.sort || 'newest', limit, offset },
    { admin: true },
  );
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});

router.get('/products/:id', (req, res) => {
  const product = getProduct({ id: Number(req.params.id) }, { admin: true });
  if (!product) throw notFound();
  res.json(product);
});

function saveProduct(id, data) {
  const db = getDb();
  return db.transaction(() => {
    const slug = uniqueSlug(db, 'products', slugify(data.slug || data.name), id);
    const row = {
      name: data.name,
      slug,
      description: data.description,
      price: data.price,
      compare_at_price: data.compareAtPrice ?? null,
      sku: data.sku,
      stock: data.stock,
      track_stock: data.trackStock ? 1 : 0,
      category_id: data.categoryId ?? null,
      featured: data.featured ? 1 : 0,
      active: data.active ? 1 : 0,
    };
    if (id) {
      const sets = Object.keys(row).map((k) => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run({ ...row, id });
    } else {
      const cols = Object.keys(row);
      id = Number(db.prepare(`INSERT INTO products (${cols.join(',')}) VALUES (${cols.map((c) => '@' + c).join(',')})`).run(row).lastInsertRowid);
    }

    const oldImages = db.prepare('SELECT url FROM product_images WHERE product_id = ?').all(id).map((r) => r.url);
    db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
    const insImg = db.prepare('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)');
    data.images.forEach((url, i) => insImg.run(id, url, i));
    for (const url of oldImages) if (!data.images.includes(url)) deleteUpload(url);

    const keep = data.variants.filter((v) => v.id).map((v) => v.id);
    db.prepare(`DELETE FROM product_variants WHERE product_id = ? AND id NOT IN (${keep.map(() => '?').join(',') || 'NULL'})`).run(id, ...keep);
    const updV = db.prepare('UPDATE product_variants SET name = ?, sku = ?, price = ?, stock = ?, sort_order = ? WHERE id = ? AND product_id = ?');
    const insV = db.prepare('INSERT INTO product_variants (product_id, name, sku, price, stock, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    data.variants.forEach((v, i) => {
      if (v.id) updV.run(v.name, v.sku, v.price ?? null, v.stock, i, v.id, id);
      else insV.run(id, v.name, v.sku, v.price ?? null, v.stock, i);
    });
    return getProduct({ id }, { admin: true });
  })();
}

router.post('/products', (req, res) => {
  res.status(201).json(saveProduct(null, validate(productSchema, req.body)));
});

router.put('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getProduct({ id }, { admin: true })) throw notFound();
  res.json(saveProduct(id, validate(productSchema, req.body)));
});

/** Quick inline edits from the product list (stock, price, active, featured). */
router.patch('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const data = validate(
    z.object({ stock: z.number().int().min(0).optional(), price: money.optional(), active: z.boolean().optional(), featured: z.boolean().optional() }),
    req.body,
  );
  const map = { stock: 'stock', price: 'price', active: 'active', featured: 'featured' };
  const sets = Object.keys(data).map((k) => `${map[k]} = @${k}`);
  if (sets.length) {
    const params = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === 'boolean' ? Number(v) : v]));
    getDb().prepare(`UPDATE products SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...params, id });
  }
  const product = getProduct({ id }, { admin: true });
  if (!product) throw notFound();
  res.json(product);
});

router.delete('/products/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const images = db.prepare('SELECT url FROM product_images WHERE product_id = ?').all(id);
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
  if (!info.changes) throw notFound();
  images.forEach((i) => deleteUpload(i.url));
  res.json({ ok: true });
});

/* ------------------------------------------------------------ categories */

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().max(2000).optional().default(''),
  image: z.string().max(500).nullish(),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

router.get('/categories', (_req, res) => {
  const rows = getDb()
    .prepare('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c ORDER BY sort_order, name')
    .all();
  res.json(rows.map(serializeCategory));
});

function saveCategory(id, data) {
  const db = getDb();
  const slug = uniqueSlug(db, 'categories', slugify(data.slug || data.name), id);
  const params = { name: data.name, slug, description: data.description, image: data.image ?? null, sort_order: data.sortOrder, active: data.active ? 1 : 0 };
  if (id) {
    db.prepare('UPDATE categories SET name=@name, slug=@slug, description=@description, image=@image, sort_order=@sort_order, active=@active WHERE id=@id').run({ ...params, id });
  } else {
    id = db.prepare('INSERT INTO categories (name, slug, description, image, sort_order, active) VALUES (@name, @slug, @description, @image, @sort_order, @active)').run(params).lastInsertRowid;
  }
  return serializeCategory(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
}

router.post('/categories', (req, res) => res.status(201).json(saveCategory(null, validate(categorySchema, req.body))));
router.put('/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getDb().prepare('SELECT id FROM categories WHERE id = ?').get(id)) throw notFound();
  res.json(saveCategory(id, validate(categorySchema, req.body)));
});
router.delete('/categories/:id', (req, res) => {
  if (!getDb().prepare('DELETE FROM categories WHERE id = ?').run(Number(req.params.id)).changes) throw notFound();
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- orders */

function orderFilters(query) {
  const where = [];
  const params = [];
  if (query.status && ORDER_STATUSES.includes(query.status)) {
    where.push('o.status = ?');
    params.push(query.status);
  }
  if (query.payment && PAYMENT_STATUSES.includes(query.payment)) {
    where.push('o.payment_status = ?');
    params.push(query.payment);
  }
  if (query.q) {
    where.push('(o.number LIKE ? OR o.email LIKE ? OR o.customer_name LIKE ? OR o.phone LIKE ?)');
    const like = `%${String(query.q).trim()}%`;
    params.push(like, like, like, like);
  }
  if (query.from) {
    where.push("date(o.created_at, 'localtime') >= date(?)");
    params.push(query.from);
  }
  if (query.to) {
    where.push("date(o.created_at, 'localtime') <= date(?)");
    params.push(query.to);
  }
  if (query.customer) {
    where.push('o.user_id = ?');
    params.push(Number(query.customer));
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/orders', (req, res) => {
  const db = getDb();
  const { limit, page, offset } = paginate(req.query, { defaultLimit: 25, maxLimit: 200 });
  const { sql, params } = orderFilters(req.query);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM orders o ${sql}`).get(...params).n;
  const rows = db
    .prepare(`SELECT o.*, (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count FROM orders o ${sql} ORDER BY o.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  res.json({ items: rows.map((o) => serializeOrder(o)), total, page, pages: Math.ceil(total / limit) });
});

router.get('/orders.csv', (req, res) => {
  const { sql, params } = orderFilters(req.query);
  const rows = getDb().prepare(`SELECT o.* FROM orders o ${sql} ORDER BY o.id DESC`).all(...params);
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['number', 'date', 'customer', 'email', 'phone', 'address', 'shipping', 'payment', 'payment_status', 'status', 'subtotal', 'discount', 'shipping_cost', 'total'];
  const lines = rows.map((o) => {
    const a = o.shipping_address ? JSON.parse(o.shipping_address) : null;
    return [
      o.number, o.created_at, o.customer_name, o.email, o.phone,
      a ? `${a.street}, ${a.postalCode} ${a.city}` : '', o.shipping_name, o.payment_method, o.payment_status, o.status,
      (o.subtotal / 100).toFixed(2), (o.discount / 100).toFixed(2), (o.shipping_cost / 100).toFixed(2), (o.total / 100).toFixed(2),
    ].map(cell).join(',');
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
  res.send('﻿' + [head.join(','), ...lines].join('\n'));
});

router.get('/orders/:id', (req, res) => {
  const order = getOrder({ id: Number(req.params.id) });
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

router.put('/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const { notifyCustomer, ...patch } = validate(orderUpdateSchema, req.body);
  const before = getOrder({ id });
  if (!before) throw notFound();
  const order = updateOrder(id, patch);
  const changed = order.status !== before.status || (patch.trackingNumber && patch.trackingNumber !== before.trackingNumber);
  if (notifyCustomer && changed) sendStatusUpdate(order);
  res.json(order);
});

/* ------------------------------------------------------------- customers */

router.get('/customers', (req, res) => {
  const db = getDb();
  const { limit, page, offset } = paginate(req.query, { defaultLimit: 50 });
  const where = [];
  const params = [];
  if (req.query.q) {
    where.push('(u.email LIKE ? OR u.name LIKE ? OR u.phone LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  if (req.query.role) {
    where.push('u.role = ?');
    params.push(req.query.role);
  }
  const sql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM users u ${sql}`).get(...params).n;
  const rows = db
    .prepare(
      `SELECT u.*, COUNT(o.id) AS order_count, COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total END), 0) AS spent
       FROM users u LEFT JOIN orders o ON o.user_id = u.id ${sql} GROUP BY u.id ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset);
  res.json({
    items: rows.map((u) => ({ ...publicUser(u), orderCount: u.order_count, spent: u.spent })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

router.put('/customers/:id/role', (req, res) => {
  const { role } = validate(z.object({ role: z.enum(['customer', 'admin']) }), req.body);
  const id = Number(req.params.id);
  if (id === req.user.id && role !== 'admin') throw badRequest('You cannot remove your own admin access');
  if (!getDb().prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id).changes) throw notFound();
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
  usedCount: c.used_count, expiresAt: c.expires_at, active: !!c.active, createdAt: c.created_at,
});

router.get('/coupons', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM coupons ORDER BY id DESC').all().map(serializeCoupon));
});

function saveCoupon(id, d) {
  const db = getDb();
  if (d.type === 'percent' && d.value > 100) throw badRequest('Validation failed', { value: 'max 100' });
  const clash = db.prepare('SELECT id FROM coupons WHERE code = ?').get(d.code);
  if (clash && clash.id !== id) throw badRequest('Validation failed', { code: 'exists' });
  const p = { code: d.code, type: d.type, value: d.value, min_order: d.minOrder, max_uses: d.maxUses ?? null, expires_at: d.expiresAt || null, active: d.active ? 1 : 0 };
  if (id) db.prepare('UPDATE coupons SET code=@code, type=@type, value=@value, min_order=@min_order, max_uses=@max_uses, expires_at=@expires_at, active=@active WHERE id=@id').run({ ...p, id });
  else id = db.prepare('INSERT INTO coupons (code, type, value, min_order, max_uses, expires_at, active) VALUES (@code, @type, @value, @min_order, @max_uses, @expires_at, @active)').run(p).lastInsertRowid;
  return serializeCoupon(db.prepare('SELECT * FROM coupons WHERE id = ?').get(id));
}

router.post('/coupons', (req, res) => res.status(201).json(saveCoupon(null, validate(couponSchema, req.body))));
router.put('/coupons/:id', (req, res) => res.json(saveCoupon(Number(req.params.id), validate(couponSchema, req.body))));
router.delete('/coupons/:id', (req, res) => {
  getDb().prepare('DELETE FROM coupons WHERE id = ?').run(Number(req.params.id));
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
  requiresAddress: !!m.requires_address, active: !!m.active, sortOrder: m.sort_order,
});

router.get('/shipping', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM shipping_methods ORDER BY sort_order, id').all().map(serializeShipping));
});

function saveShipping(id, d) {
  const db = getDb();
  const p = { name: d.name, description: d.description, price: d.price, free_over: d.freeOver ?? null, requires_address: d.requiresAddress ? 1 : 0, active: d.active ? 1 : 0, sort_order: d.sortOrder };
  if (id) db.prepare('UPDATE shipping_methods SET name=@name, description=@description, price=@price, free_over=@free_over, requires_address=@requires_address, active=@active, sort_order=@sort_order WHERE id=@id').run({ ...p, id });
  else id = db.prepare('INSERT INTO shipping_methods (name, description, price, free_over, requires_address, active, sort_order) VALUES (@name, @description, @price, @free_over, @requires_address, @active, @sort_order)').run(p).lastInsertRowid;
  return serializeShipping(db.prepare('SELECT * FROM shipping_methods WHERE id = ?').get(id));
}

router.post('/shipping', (req, res) => res.status(201).json(saveShipping(null, validate(shippingSchema, req.body))));
router.put('/shipping/:id', (req, res) => res.json(saveShipping(Number(req.params.id), validate(shippingSchema, req.body))));
router.delete('/shipping/:id', (req, res) => {
  getDb().prepare('DELETE FROM shipping_methods WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- pages */

const pageSchema = z.object({
  slug: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100000).default(''),
  showInFooter: z.boolean().default(true),
});

router.get('/pages', (_req, res) => {
  res.json(
    getDb().prepare('SELECT * FROM pages ORDER BY title').all()
      .map((p) => ({ slug: p.slug, title: p.title, content: p.content, showInFooter: !!p.show_in_footer, updatedAt: p.updated_at })),
  );
});

router.put('/pages/:slug', (req, res) => {
  const d = validate(pageSchema, { ...req.body, slug: slugify(req.body.slug || req.params.slug) });
  const db = getDb();
  if (d.slug !== req.params.slug) db.prepare('DELETE FROM pages WHERE slug = ?').run(req.params.slug);
  db.prepare(
    `INSERT INTO pages (slug, title, content, show_in_footer) VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, content = excluded.content,
       show_in_footer = excluded.show_in_footer, updated_at = datetime('now')`,
  ).run(d.slug, d.title, d.content, d.showInFooter ? 1 : 0);
  res.json(d);
});

router.delete('/pages/:slug', (req, res) => {
  getDb().prepare('DELETE FROM pages WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- messages */

router.get('/messages', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 500').all()
    .map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, read: !!m.read, createdAt: m.created_at })));
});

router.put('/messages/:id', (req, res) => {
  const { read } = validate(z.object({ read: z.boolean() }), req.body);
  getDb().prepare('UPDATE messages SET read = ? WHERE id = ?').run(read ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

router.delete('/messages/:id', (req, res) => {
  getDb().prepare('DELETE FROM messages WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* -------------------------------------------------------------- settings */

router.get('/settings', (_req, res) => res.json(getSettings()));

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const settingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(100),
    tagline: z.string().max(200),
    logoUrl: z.string().max(500),
    faviconUrl: z.string().max(500),
    language: z.enum(['el', 'en']),
    currency: z.string().length(3),
    locale: z.string().max(20),
    theme: z.object({ primary: hex, accent: hex, background: hex, surface: hex, text: hex, radius: z.number().min(0).max(32), font: z.string().max(60) }).partial(),
    announcement: z.string().max(300),
    hero: z.object({ title: z.string().max(200), subtitle: z.string().max(400), imageUrl: z.string().max(500), ctaText: z.string().max(60), ctaLink: z.string().max(300) }).partial(),
    contact: z.object({ email: z.string().max(200), phone: z.string().max(60), address: z.string().max(300), hours: z.string().max(300) }).partial(),
    social: z.object({ facebook: z.string().max(300), instagram: z.string().max(300), tiktok: z.string().max(300) }).partial(),
    payments: z.object({
      cod: z.object({ enabled: z.boolean(), fee: money }).partial(),
      bank: z.object({ enabled: z.boolean(), details: z.string().max(2000) }).partial(),
      card: z.object({ enabled: z.boolean() }).partial(),
    }).partial(),
    checkout: z.object({ requirePhone: z.boolean(), allowGuest: z.boolean(), pricesIncludeTax: z.boolean(), termsPage: z.string().max(80) }).partial(),
    inventory: z.object({ lowStockThreshold: z.number().int().min(0), hideOutOfStock: z.boolean() }).partial(),
    notifications: z.object({ orderEmail: z.string().max(200) }).partial(),
    seo: z.object({ title: z.string().max(200), description: z.string().max(500) }).partial(),
    orderPrefix: z.string().max(10),
  })
  .partial();

router.put('/settings', (req, res) => {
  res.json(updateSettings(validate(settingsSchema, req.body)));
});

export default router;
