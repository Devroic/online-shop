import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-test-'));

const { default: request } = await import('supertest');
const { openDb, setDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { createAdmin, ensureInitialData } = await import('../src/scripts/bootstrap.js');

let app;
let db;
let admin;
let productId;
let variantProductId;
let variantId;
let courierId;

before(async () => {
  db = openDb(':memory:');
  setDb(db);
  await ensureInitialData();
  await createAdmin('admin@test.dev', 'password123');
  app = createApp();
  admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email: 'admin@test.dev', password: 'password123' }).expect(200);
  courierId = db.prepare("SELECT id FROM shipping_methods WHERE requires_address = 1").get().id;
});

const address = { street: 'Ermou 1', city: 'Athens', postalCode: '10563' };
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
  const cat = await admin.post('/api/admin/categories').send({ name: 'Ρούχα' }).expect(201);
  assert.equal(cat.body.slug, 'roucha');

  const p = await admin
    .post('/api/admin/products')
    .send({ name: 'Κούπα', price: 1000, stock: 2, categoryId: cat.body.id })
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
  const res = await request(app).get('/api/products?q=κουπ').expect(200);
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
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock, 0);
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId).stock, 0);

  // Guest can view with token, not without.
  await request(app).get(`/api/orders/${o.number}`).expect(404);
  const view = await request(app).get(`/api/orders/${o.number}?token=${o.accessToken}`).expect(200);
  assert.equal(view.body.order.adminNotes, undefined);

  // Out of stock now.
  const again = await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }] })).expect(409);
  assert.equal(again.body.details.problems[0].code, 'out_of_stock');

  // Cancelling restores stock.
  await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'cancelled' }).expect(200);
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock, 2);
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(variantId).stock, 1);
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
