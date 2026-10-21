import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
// Never pick up a developer's .env (it could point at a real shop's database).
process.env.DOTENV_CONFIG_PATH = 'does-not-exist.env';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-test-'));
process.env.PGLITE_DIR = 'memory://';
// TEST_DATABASE_URL runs the suite against a real Postgres (empty database);
// otherwise the embedded one is used.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;

const { default: request } = await import('supertest');
const { initDb, db } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { createAdmin, ensureInitialData } = await import('../src/scripts/bootstrap.js');

// Greek test words, written as escapes so the source stays ASCII:
const GR = {
  clothes: '\u03a1\u03bf\u03cd\u03c7\u03b1', // capitalised, with accent; slug "roucha"
  mug: '\u039a\u03bf\u03cd\u03c0\u03b1', // capitalised, with accent; slug "koupa"
  mugSearch: '\u03ba\u03bf\u03c5\u03c0', // lowercase prefix without accent
  kitchen: '\u039a\u03bf\u03c5\u03b6\u03af\u03bd\u03b1', // capitalised, with accent
  kitchenPlain: '\u03ba\u03bf\u03c5\u03b6\u03b9\u03bd\u03b1', // lowercase, no accent
};

let app;
let admin;
let productId;
let variantProductId;
let variantId;
let courierId;

before(async () => {
  await initDb();
  await ensureInitialData();
  await createAdmin('admin@test.dev', 'password123');
  app = createApp();
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email: 'admin@test.dev', password: 'password123' }).expect(200);
  // Tests pay offline (no Stripe keys here).
  await admin.put('/api/admin/settings').send({ payments: { cod: { enabled: true }, bank: { enabled: true } } }).expect(200);
  courierId = (await db().one('SELECT id FROM shipping_methods WHERE requires_address LIMIT 1')).id;
});

const address = { street: 'Ermou 1', city: 'Athens', postalCode: '10563' };
const stockOf = async (id) => (await db().one('SELECT stock FROM products WHERE id = $1', [id])).stock;
const variantStock = async (id) => (await db().one('SELECT stock FROM product_variants WHERE id = $1', [id])).stock;

const checkout = (extra) => ({
  email: 'buyer@test.dev',
  name: 'Test Buyer',
  phone: '6900000000',
  address,
  shippingMethodId: courierId,
  paymentMethod: 'cod',
  acceptTerms: true,
  ...extra,
});

test('admin endpoints reject anonymous users', async () => {
  await request(app).get('/api/admin/stats').expect(401);
});

test('admin creates category and products', async () => {
  const cat = await admin.post('/api/admin/categories').send({ name: GR.clothes }).expect(201);
  assert.equal(cat.body.slug, 'roucha');

  const p = await admin
    .post('/api/admin/products')
    .send({ name: GR.mug, price: 1000, stock: 2, categoryId: cat.body.id })
    .expect(201);
  productId = p.body.id;
  assert.equal(p.body.slug, 'koupa');

  const v = await admin
    .post('/api/admin/products')
    .send({ name: 'T-shirt', price: 2000, variants: [{ name: 'M', stock: 1 }, { name: 'L', stock: 0, price: 2500 }] })
    .expect(201);
  variantProductId = v.body.id;
  variantId = v.body.variants[0].id;
  assert.equal(v.body.maxPrice, 2500);
  assert.equal(v.body.inStock, true);
});

test('catalog lists active products with search', async () => {
  const res = await request(app).get(`/api/products?q=${encodeURIComponent(GR.mugSearch)}`).expect(200);
  assert.equal(res.body.total, 1);
  await request(app).get('/api/products/koupa').expect(200);
});

test('quote reports stock problems and applies free shipping threshold', async () => {
  const res = await request(app)
    .post('/api/cart/quote')
    .send({ items: [{ productId, quantity: 3 }], shippingMethodId: courierId })
    .expect(200);
  assert.equal(res.body.problems[0].code, 'insufficient_stock');
  assert.equal(res.body.subtotal, 3000);
  assert.equal(res.body.shippingCost, 350);

  const missingVariant = await request(app).post('/api/cart/quote').send({ items: [{ productId: variantProductId, quantity: 1 }] });
  assert.equal(missingVariant.body.problems[0].code, 'variant_required');
});

test('checkout creates order, decrements stock, ignores client prices', async () => {
  const res = await request(app)
    .post('/api/orders')
    .send(checkout({ items: [{ productId, quantity: 2, price: 1 }, { productId: variantProductId, variantId, quantity: 1 }] }))
    .expect(201);
  const o = res.body.order;
  assert.equal(o.subtotal, 4000);
  assert.equal(o.total, 4350);
  assert.equal(o.number, String(1000 + o.id));
  assert.equal(await stockOf(productId), 0);
  assert.equal(await variantStock(variantId), 0);

  // Guest can view with token, not without.
  await request(app).get(`/api/orders/${o.number}`).expect(404);
  const view = await request(app).get(`/api/orders/${o.number}?token=${o.accessToken}`).expect(200);
  assert.equal(view.body.order.adminNotes, undefined);

  // Out of stock now.
  const again = await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }] })).expect(409);
  assert.equal(again.body.details.problems[0].code, 'out_of_stock');

  // Cancelling restores stock.
  await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'cancelled' }).expect(200);
  assert.equal(await stockOf(productId), 2);
  assert.equal(await variantStock(variantId), 1);
});

test('coupons apply and respect limits', async () => {
  await admin.post('/api/admin/coupons').send({ code: 'save10', type: 'percent', value: 10, maxUses: 1 }).expect(201);
  const res = await request(app)
    .post('/api/orders')
    .send(checkout({ items: [{ productId, quantity: 1 }], couponCode: 'SAVE10' }))
    .expect(201);
  assert.equal(res.body.order.discount, 100);
  const used = await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }], couponCode: 'save10' })).expect(409);
  assert.equal(used.body.details.coupon, 'coupon_used_up');
});

test('checkout validation', async () => {
  const res = await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }], acceptTerms: false, email: 'nope' })).expect(400);
  assert.ok(res.body.details.email);
  assert.ok(res.body.details.acceptTerms);
  await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }], paymentMethod: 'card' })).expect(400);
});

test('customer registers, sees linked guest orders', async () => {
  const user = request.agent(app);
  await user.post('/api/auth/register').send({ email: 'BUYER@test.dev', password: 'password123', name: 'Buyer' }).expect(201);
  const mine = await user.get('/api/orders/mine').expect(200);
  assert.ok(mine.body.length >= 2);
  await user.get('/api/admin/stats').expect(403);
});

test('default payment settings: card on, offline methods off', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/settings.js');
  assert.deepEqual(
    [DEFAULT_SETTINGS.payments.card.enabled, DEFAULT_SETTINGS.payments.cod.enabled, DEFAULT_SETTINGS.payments.bank.enabled],
    [true, false, false],
  );
});

test('settings are public except notification email', async () => {
  await admin.put('/api/admin/settings').send({ storeName: 'Acme', notifications: { orderEmail: 'secret@acme.dev' } }).expect(200);
  const res = await request(app).get('/api/settings').expect(200);
  assert.equal(res.body.settings.storeName, 'Acme');
  assert.equal(res.body.settings.notifications, undefined);
  assert.deepEqual(res.body.settings.paymentMethods, ['cod', 'bank']);
  await admin.put('/api/admin/settings').send({ theme: { primary: 'red' } }).expect(400);
});

test('stats and csv export', async () => {
  const stats = await admin.get('/api/admin/stats').expect(200);
  assert.equal(stats.body.series.length, 30);
  assert.ok(stats.body.allTime.orders >= 1);
  const csv = await admin.get('/api/admin/orders.csv').expect(200);
  assert.match(csv.text, /number,date,customer/);
});

test('concurrent checkouts cannot oversell the last item', async () => {
  const p = await admin.post('/api/admin/products').send({ name: 'Last one', price: 500, stock: 1 }).expect(201);
  const results = await Promise.all(
    [1, 2, 3].map(() => request(app).post('/api/orders').send(checkout({ items: [{ productId: p.body.id, quantity: 1 }] }))),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.ok(results.filter((r) => r.status === 409).length === 2);
  assert.equal(await stockOf(p.body.id), 0);
});

test('login is case-insensitive and social-only accounts get a clear error', async () => {
  await request(app).post('/api/auth/login').send({ email: 'ADMIN@test.dev', password: 'password123' }).expect(200);
  await db().query("INSERT INTO users (email, name, auth_provider) VALUES ('g@test.dev', 'G', 'google')");
  const r = await request(app).post('/api/auth/login').send({ email: 'g@test.dev', password: 'whatever1' }).expect(401);
  assert.equal(r.body.details.provider, 'google');
});

test('image upload stores file and returns a URL', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  const r = await admin.post('/api/admin/uploads').attach('files', svg, { filename: 'a.svg', contentType: 'image/svg+xml' }).expect(201);
  assert.match(r.body.urls[0], /^\/uploads\/.+\.svg$/);
  await admin.post('/api/admin/uploads').attach('files', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
});

test('bulk import creates and updates products, categories and options', async () => {
  const batch = [
    { name: 'Import Mug', price: 1290, stock: 20, trackStock: true, categoryName: GR.kitchen, variants: [] },
    {
      name: 'Import Tee', price: 1990, stock: 0, trackStock: true, categoryName: GR.kitchenPlain,
      variants: [{ name: 'S', price: null, stock: 5 }, { name: 'M', price: 2190, stock: 2 }],
    },
  ];
  const dry = await admin.post('/api/admin/products/import').send({ products: batch, dryRun: true }).expect(200);
  assert.deepEqual(dry.body.existing, []);
  const r1 = await admin.post('/api/admin/products/import').send({ products: batch }).expect(200);
  assert.deepEqual([r1.body.created, r1.body.updated, r1.body.errors.length], [2, 0, 0]);
  // One category despite different case/accents.
  assert.equal((await db().one('SELECT COUNT(*)::int AS n FROM categories WHERE search_name = $1', [GR.kitchenPlain])).n, 1);

  const tee = (await request(app).get('/api/products?q=import tee').expect(200)).body.items[0];
  await admin.put(`/api/admin/products/${tee.id}`).send({ ...tee, images: ['/uploads/x.svg'], variants: tee.variants.map((v) => ({ id: v.id, name: v.name, price: v.priceOverride, stock: v.stock })) }).expect(200);

  const r2 = await admin
    .post('/api/admin/products/import')
    .send({ products: [{ ...batch[1], name: 'import tee', variants: [{ name: 's', price: null, stock: 9 }] }] })
    .expect(200);
  assert.equal(r2.body.updated, 1);
  const after = (await request(app).get(`/api/products/${tee.slug}`).expect(200)).body.product;
  assert.deepEqual(after.images, ['/uploads/x.svg']); // photos kept
  assert.equal(after.variants.length, 1);
  assert.equal(after.variants[0].id, tee.variants.find((v) => v.name === 'S').id); // option kept its id
  assert.equal(after.variants[0].stock, 9);

  await admin.post('/api/admin/products/import').send({ products: [{ name: '', price: 1 }] }).expect(400);
});

test('orders remember the visitor language; store pickup starts disabled', async () => {
  const p = await admin.post('/api/admin/products').send({ name: 'Lang test', price: 100, stock: 5 }).expect(201);
  const en = await request(app).post('/api/orders').set('X-Shop-Lang', 'en').send(checkout({ items: [{ productId: p.body.id, quantity: 1 }] })).expect(201);
  assert.equal(en.body.order.language, 'en');
  const def = await request(app).post('/api/orders').set('X-Shop-Lang', 'xx').send(checkout({ items: [{ productId: p.body.id, quantity: 1 }] })).expect(201);
  assert.equal(def.body.order.language, 'el'); // unknown → shop default
  const pickup = await db().one('SELECT active FROM shipping_methods WHERE NOT requires_address');
  assert.equal(pickup.active, false);
});
