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
  // Tests pay offline (no Stripe keys here): the courier takes cash on delivery.
  courierId = (await db().one("SELECT id FROM shipping_methods WHERE kind = 'courier'")).id;
  await admin
    .put('/api/admin/shipping')
    .send({ methods: [{ id: courierId, name: 'Courier', active: true, cod: true, rates: [{ country: 'CY', price: 350, freeOver: 5000 }] }] })
    .expect(200);
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

  // Status and payment status must fit together: an open order cannot have a failed payment.
  const bad = await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'shipped', paymentStatus: 'failed' }).expect(400);
  assert.equal(bad.body.details.paymentStatus, 'status_combination');

  // The tracking link must be a web address; a valid one is shown to the customer.
  const badLink = await admin.put(`/api/admin/orders/${o.id}`).send({ trackingUrl: 'acs tracking' }).expect(400);
  assert.equal(badLink.body.details.trackingUrl, 'url');
  await admin.put(`/api/admin/orders/${o.id}`).send({ trackingUrl: 'https://www.acscourier.net/?p=123' }).expect(200);
  const tracked = await request(app).get(`/api/orders/${o.number}?token=${o.accessToken}`).expect(200);
  assert.equal(tracked.body.order.trackingUrl, 'https://www.acscourier.net/?p=123');

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

  // Cancelling the order gives the use back, so the code works again.
  await admin.put(`/api/admin/orders/${res.body.order.id}`).send({ status: 'cancelled' }).expect(200);
  await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }], couponCode: 'save10' })).expect(201);
});

test('checkout validation', async () => {
  const res = await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }], acceptTerms: false, email: 'nope' })).expect(400);
  assert.equal(res.body.details.email, 'email');
  assert.equal(res.body.details.acceptTerms, 'accept_terms');
  await request(app).post('/api/orders').send(checkout({ items: [{ productId, quantity: 1 }], paymentMethod: 'card' })).expect(400);
});

test('validation errors come back as short codes the UI translates', async () => {
  const reg = await request(app).post('/api/auth/register').send({ email: '', password: 'short', name: ' ' }).expect(400);
  assert.deepEqual(reg.body.details, { email: 'required', password: 'min_length:8', name: 'required' });
  const coupon = await admin.post('/api/admin/coupons').send({ code: 'X', type: 'percent', value: 0 }).expect(400);
  assert.equal(coupon.body.details.code, 'min_length:2');
  const zero = await admin.post('/api/admin/coupons').send({ code: 'ZERO', type: 'percent', value: 0 }).expect(400);
  assert.equal(zero.body.details.value, 'min:1');
  const settings = await admin.put('/api/admin/settings').send({ contact: { email: 'nope' }, social: { instagram: 'instagram' }, theme: { primary: 'red' } }).expect(400);
  assert.deepEqual(settings.body.details, { 'contact.email': 'email', 'social.instagram': 'url', 'theme.primary': 'colour' });
  await admin.put('/api/admin/settings').send({ contact: { email: '' }, social: { instagram: '' } }).expect(200);
});

test('guest orders join an account only after the email is confirmed', async () => {
  const { sha256 } = await import('../src/utils.js');
  const user = request.agent(app);
  const reg = await user.post('/api/auth/register').send({ email: 'BUYER@test.dev', password: 'password123', name: 'Buyer' }).expect(201);
  assert.equal(reg.body.user.emailVerified, false);
  // Anyone could sign up with this email: its guest orders must stay hidden until it is confirmed.
  assert.equal((await user.get('/api/orders/mine').expect(200)).body.length, 0);
  await user.post('/api/auth/verify/resend').expect(200);
  await request(app).post('/api/auth/verify').send({ token: 'not-a-real-token' }).expect(400);

  // The real link is only in the email; use a known token instead.
  await db().query("INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [
    sha256('known-test-token'),
    reg.body.user.id,
  ]);
  const ok = await request(app).post('/api/auth/verify').send({ token: 'known-test-token' }).expect(200);
  assert.equal(ok.body.user.emailVerified, true);
  assert.ok((await user.get('/api/orders/mine').expect(200)).body.length >= 2);
  await request(app).post('/api/auth/verify').send({ token: 'known-test-token' }).expect(400); // single use
  await user.get('/api/admin/stats').expect(403);
});

test('default payment settings: card on; cash is set per shipping method', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/settings.js');
  assert.deepEqual(Object.keys(DEFAULT_SETTINGS.payments), ['card']);
  assert.equal(DEFAULT_SETTINGS.payments.card.enabled, true);
});

test('settings are public except notification email', async () => {
  await admin.put('/api/admin/settings').send({ storeName: 'Acme', notifications: { orderEmail: 'secret@acme.dev' } }).expect(200);
  const res = await request(app).get('/api/settings').expect(200);
  assert.equal(res.body.settings.storeName, 'Acme');
  assert.equal(res.body.settings.notifications, undefined);
  assert.deepEqual(res.body.settings.paymentMethods, ['cod']);
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

test('import with only some columns leaves the other fields of existing products alone', async () => {
  const { parseSheet } = await import('../../client/src/lib/productImport.js');
  const full = (
    await admin
      .post('/api/admin/products')
      .send({
        name: 'Partial Tee', price: 1990, compareAtPrice: 2490, description: 'Soft cotton', sku: 'PT-1', optionName: 'Size',
        variants: ['S', 'M', 'L', 'XL'].map((name, i) => ({ name, sku: `PT-${name}`, stock: i + 1 })),
      })
      .expect(201)
  ).body;

  // What the browser sends for a sheet with just Name, Price, Stock.
  const { products, errors, kept } = parseSheet([['Name', 'Price', 'Stock'], ['Partial Tee', 17.5, 7]]);
  assert.equal(errors.length, 0);
  assert.ok(kept.includes('Description') && kept.includes('Option'));
  assert.deepEqual(Object.keys(products[0]).sort(), ['name', 'price', 'row', 'stock', 'trackStock']);
  const { row: _row, ...item } = products[0];
  assert.equal((await admin.post('/api/admin/products/import').send({ products: [item] }).expect(200)).body.updated, 1);

  const after = (await admin.get(`/api/admin/products/${full.id}`).expect(200)).body;
  assert.equal(after.regularPrice, 1750); // the sheet's price
  assert.equal(after.description, 'Soft cotton');
  assert.equal(after.regularCompareAtPrice, 2490);
  assert.equal(after.sku, 'PT-1');
  assert.equal(after.optionName, 'Size');
  assert.deepEqual(after.variants.map((v) => [v.name, v.sku, v.stock]), [['S', 'PT-S', 1], ['M', 'PT-M', 2], ['L', 'PT-L', 3], ['XL', 'PT-XL', 4]]);

  // With an "Option" column the options are the sheet's; stock of a listed size changes, codes stay.
  const withOptions = parseSheet([['Name', 'Option', 'Price', 'Stock'], ['Partial Tee', 'S', 17.5, 9], ['Partial Tee', 'M', 17.5, 2]]).products[0];
  const { row: _r, ...item2 } = withOptions;
  await admin.post('/api/admin/products/import').send({ products: [item2] }).expect(200);
  const after2 = (await admin.get(`/api/admin/products/${full.id}`).expect(200)).body;
  assert.deepEqual(after2.variants.map((v) => [v.name, v.sku, v.stock]), [['S', 'PT-S', 9], ['M', 'PT-M', 2]]);
  assert.equal(after2.description, 'Soft cotton');

  // The preview's dry run lists the current options, so it can warn about removed ones.
  const dry = await admin.post('/api/admin/products/import').send({ dryRun: true, products: [item2] }).expect(200);
  assert.deepEqual(dry.body.options, { 'Partial Tee': ['S', 'M'] });
});

test('a new product from a sheet without a "Stock" column is always available', async () => {
  const { parseSheet } = await import('../../client/src/lib/productImport.js');
  const { row: _row, ...item } = parseSheet([['Name', 'Price'], ['No Stock Column', 9.9]]).products[0];
  assert.equal(item.trackStock, undefined);
  assert.equal((await admin.post('/api/admin/products/import').send({ products: [item] }).expect(200)).body.created, 1);
  const p = (await request(app).get('/api/products?q=no stock column').expect(200)).body.items[0];
  assert.equal(p.trackStock, false);
  assert.equal(p.inStock, true);
});

test('orders remember the visitor language; store pickup starts disabled', async () => {
  const p = await admin.post('/api/admin/products').send({ name: 'Lang test', price: 100, stock: 5 }).expect(201);
  const en = await request(app).post('/api/orders').set('X-Shop-Lang', 'en').send(checkout({ items: [{ productId: p.body.id, quantity: 1 }] })).expect(201);
  assert.equal(en.body.order.language, 'en');
  const def = await request(app).post('/api/orders').set('X-Shop-Lang', 'xx').send(checkout({ items: [{ productId: p.body.id, quantity: 1 }] })).expect(201);
  assert.equal(def.body.order.language, 'el'); // unknown → shop default
  // A new shop: empty names (customers see the defaults), default descriptions, pickup off.
  const pickup = await db().one("SELECT name, description, active FROM shipping_methods WHERE kind = 'pickup'");
  assert.deepEqual(pickup, { name: '', description: 'Χωρίς χρέωση', active: false });
  const courier = await db().one("SELECT name, description FROM shipping_methods WHERE kind = 'courier'");
  assert.equal(courier.description, '2-7 εργάσιμες μέρες');
});

test('two shipping methods: courier priced per country, pickup; the shop stays sellable', async () => {
  const p = await admin.post('/api/admin/products').send({ name: 'Country test', price: 100, stock: 9 }).expect(201);
  const items = [{ productId: p.body.id, quantity: 1 }];
  const list = (await admin.get('/api/admin/shipping').expect(200)).body;
  assert.deepEqual(list.map((m) => m.kind), ['courier', 'pickup']);
  const pickupId = list[1].id;
  await admin.post('/api/admin/shipping').send({ name: 'Extra' }).expect(404);

  // Courier: an address without a country gets Cyprus; Greece only once it has a rate.
  const plain = await request(app).post('/api/orders').send(checkout({ items })).expect(201);
  assert.equal(plain.body.order.address.country, 'CY');
  const gr = await request(app).post('/api/orders').send(checkout({ items, address: { ...address, country: 'GR' } })).expect(400);
  assert.equal(gr.body.details['address.country'], 'country');
  const rates = [{ country: 'CY', price: 350, freeOver: 5000 }, { country: 'GR', price: 800, freeOver: null }];
  // An empty name shows the default one.
  await admin.put('/api/admin/shipping').send({ methods: [{ id: courierId, name: '', cod: true, rates }] }).expect(200);
  const pub = await request(app).get('/api/settings').expect(200);
  assert.deepEqual(pub.body.settings.deliveryCountries, ['CY', 'GR']);
  const quote = await request(app).post('/api/cart/quote').send({ items, shippingMethodId: courierId, country: 'GR' }).expect(200);
  assert.equal(quote.body.shippingCost, 800);
  assert.equal(quote.body.shipping.name, 'Courier');
  const ok = await request(app).post('/api/orders').send(checkout({ items, address: { ...address, country: 'GR' } })).expect(201);
  assert.equal(ok.body.order.shippingCost, 800);
  await admin.put('/api/admin/shipping').send({ methods: [{ id: courierId, name: 'Courier', cod: true, rates: [] }] }).expect(400);

  // Pickup: no address; cash only if the pickup allows paying at the store.
  await admin.put('/api/admin/shipping').send({ methods: [{ id: pickupId, name: 'Pickup', active: true, cod: false }] }).expect(200);
  const cash = await request(app).post('/api/orders').send(checkout({ items, shippingMethodId: pickupId, address: null })).expect(400);
  assert.equal(cash.body.details.paymentMethod, 'invalid');
  await admin.put('/api/admin/shipping').send({ methods: [{ id: pickupId, name: 'Pickup', active: true, cod: true }] }).expect(200);
  const picked = await request(app).post('/api/orders').send(checkout({ items, shippingMethodId: pickupId, address: null })).expect(201);
  assert.equal(picked.body.order.address, null);
  assert.equal(picked.body.order.shippingCost, 0);

  // Never all shipping off, and never no way to pay (with card payments off, some method must take cash).
  await admin.put('/api/admin/shipping').send({ methods: [{ id: pickupId, name: 'Pickup', active: false }] }).expect(200);
  const last = await admin.put('/api/admin/shipping').send({ methods: [{ id: courierId, name: 'Courier', active: false, cod: true, rates }] }).expect(400);
  assert.equal(last.body.details.active, 'last_shipping');
  await admin.put('/api/admin/settings').send({ payments: { card: { enabled: false } } }).expect(200); // courier still takes cash
  const nopay = await admin.put('/api/admin/shipping').send({ methods: [{ id: courierId, name: 'Courier', cod: false, rates }] }).expect(400);
  assert.equal(nopay.body.details.cod, 'last_payment');
  await admin.put('/api/admin/settings').send({ payments: { card: { enabled: true } } }).expect(200);
});

test('categories keep distinct places: new ones go last, the order is saved as a list', async () => {
  const a = (await admin.post('/api/admin/categories').send({ name: 'Order A' }).expect(201)).body;
  const b = (await admin.post('/api/admin/categories').send({ name: 'Order B' }).expect(201)).body;
  assert.ok(b.sortOrder > a.sortOrder);
  await admin.put('/api/admin/categories/order').send({ ids: [b.id, a.id] }).expect(200);
  const list = (await admin.get('/api/admin/categories').expect(200)).body.filter((c) => [a.id, b.id].includes(c.id));
  assert.deepEqual(list.map((c) => c.id), [b.id, a.id]);
  // Editing keeps the place.
  await admin.put(`/api/admin/categories/${a.id}`).send({ name: 'Order A2' }).expect(200);
  assert.equal((await db().one('SELECT sort_order FROM categories WHERE id = $1', [a.id])).sort_order, 1);
  // Visible on/off from the list.
  const hidden = await admin.patch(`/api/admin/categories/${a.id}`).send({ active: false }).expect(200);
  assert.equal(hidden.body.active, false);
});

test('pages keep the order set in the admin, also after a rename', async () => {
  const slugsOf = async () => (await request(app).get('/api/settings').expect(200)).body.pages.map((p) => p.slug);
  const before = await slugsOf();
  await admin.put('/api/admin/pages/zz-new').send({ title: 'AAA first by name', content: 'x' }).expect(200);
  assert.equal((await slugsOf()).at(-1), 'zz-new'); // new pages go last, whatever the title
  const order = ['zz-new', ...before];
  await admin.put('/api/admin/pages-order').send({ slugs: order }).expect(200);
  assert.deepEqual(await slugsOf(), order);
  await admin.put('/api/admin/pages/zz-new').send({ slug: 'renamed', title: 'Renamed', content: 'x' }).expect(200);
  assert.equal((await slugsOf())[0], 'renamed');
  await admin.delete('/api/admin/pages/renamed').expect(200);
});

test('percentage discount: shown and charged reduced, regular price kept, bulk by category', async () => {
  const cat = (await admin.post('/api/admin/categories').send({ name: 'Sale cat' }).expect(201)).body;
  const mk = async (name, price) => (await admin.post('/api/admin/products').send({ name, price, stock: 10, categoryId: cat.id }).expect(201)).body;
  const a = await mk('Sale A', 1000);
  const b = await mk('Sale B', 2550);
  // One product, from its form.
  await admin.put(`/api/admin/products/${a.id}`).send({ ...a, categoryId: cat.id, discountPercent: 20, variants: [] }).expect(200);
  const shown = (await request(app).get(`/api/products/${a.slug}`).expect(200)).body;
  const pa = shown.product || shown;
  assert.deepEqual([pa.price, pa.compareAtPrice, pa.discountPercent, pa.regularPrice], [800, 1000, 20, 1000]);
  const quote = await request(app).post('/api/cart/quote').send({ items: [{ productId: a.id, quantity: 2 }] }).expect(200);
  assert.equal(quote.body.subtotal, 1600);
  // A whole category at once, then removed with 0.
  const bulk = await admin.post('/api/admin/products/discount').send({ categoryId: cat.id, percent: 10 }).expect(200);
  assert.equal(bulk.body.updated, 2);
  const pb = (await admin.get(`/api/admin/products/${b.id}`).expect(200)).body;
  assert.deepEqual([pb.price, pb.regularPrice], [2295, 2550]); // 2550 − 10%, rounded to the cent
  await admin.post('/api/admin/products/discount').send({ ids: [a.id, b.id], percent: 0 }).expect(200);
  const back = (await admin.get(`/api/admin/products/${a.id}`).expect(200)).body;
  assert.deepEqual([back.price, back.compareAtPrice, back.discountPercent], [1000, null, 0]);
  await admin.post('/api/admin/products/discount').send({ percent: 10 }).expect(400);
});

test('returned: only after delivery, puts stock back, not counted as revenue', async () => {
  const p = (await admin.post('/api/admin/products').send({ name: 'Return test', price: 1000, stock: 5 }).expect(201)).body;
  const o = (await request(app).post('/api/orders').send(checkout({ items: [{ productId: p.id, quantity: 2 }] })).expect(201)).body.order;
  assert.equal(await stockOf(p.id), 3);
  const early = await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'returned', paymentStatus: 'paid' }).expect(400);
  assert.equal(early.body.details.status, 'return_not_delivered');
  await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'delivered', paymentStatus: 'paid' }).expect(200);
  const revenue = async () => (await admin.get('/api/admin/stats?days=7').expect(200)).body.allTime.revenue;
  const withIt = await revenue();
  await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'returned', paymentStatus: 'refunded' }).expect(200);
  assert.equal(await stockOf(p.id), 5);
  assert.equal(await revenue(), withIt - o.total);
  // Back to delivered (a mistake): the stock is taken again.
  await admin.put(`/api/admin/orders/${o.id}`).send({ status: 'delivered', paymentStatus: 'paid' }).expect(200);
  assert.equal(await stockOf(p.id), 3);
});

test('phone and postal code must look real', async () => {
  const p = (await admin.post('/api/admin/products').send({ name: 'Phone test', price: 1000, stock: 5 }).expect(201)).body;
  const items = [{ productId: p.id, quantity: 1 }];
  const bad = await request(app).post('/api/orders').send(checkout({ items, phone: 'abc', address: { ...address, postalCode: 'xyz' } })).expect(400);
  assert.equal(bad.body.details.phone, 'phone');
  assert.equal(bad.body.details['address.postalCode'], 'postal_code');
  await request(app).post('/api/orders').send(checkout({ items, phone: '+357 99 123456', address: { ...address, postalCode: 'SW1A 1AA' } })).expect(201);
});

test('greeklish search, option name, guests in customers', async () => {
  const p = (await admin.post('/api/admin/products').send({ name: 'Κούπα θάλασσας δώρου', price: 900, stock: 3, optionName: 'Μέγεθος', variants: [{ name: 'M', stock: 3 }] }).expect(201)).body;
  assert.equal(p.optionName, 'Μέγεθος');
  for (const q of ['koupa', 'kupa', 'thalassas', '8alassas', 'doro']) {
    const found = (await request(app).get(`/api/products?q=${q}`).expect(200)).body.items.map((x) => x.id);
    assert.ok(found.includes(p.id), q);
  }
  await request(app).post('/api/orders').send(checkout({ email: 'guest-list@test.dev', items: [{ productId: p.id, variantId: p.variants[0].id, quantity: 1 }] })).expect(201);
  const guests = (await admin.get('/api/admin/customers?role=guest&q=guest-list').expect(200)).body;
  assert.equal(guests.items.length, 1);
  assert.equal(guests.items[0].guest, true);
  assert.equal(guests.items[0].orderCount, 1);
});

test('language switch is off by default', async () => {
  const { DEFAULT_SETTINGS } = await import('../src/settings.js');
  assert.equal(DEFAULT_SETTINGS.languageSwitch, false);
});
