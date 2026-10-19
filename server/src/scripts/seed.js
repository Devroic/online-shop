// Fills an empty shop with demo data so the template can be tried out:
//   npm run seed            (adds demo data if there are no products)
//   npm run seed -- --reset (wipes catalog + orders first)
import { closeDb, db, initDb } from '../db.js';
import { getSettings, updateSettings } from '../settings.js';
import { translator } from '../i18n.js';
import { ensureBucket, saveFile } from '../storage.js';
import { createAdmin, ensureInitialData } from './bootstrap.js';
import { saveCategory, saveProduct } from '../routes/admin.js';

await initDb();
await ensureBucket();
const reset = process.argv.includes('--reset');

if (reset) {
  await db().query('TRUNCATE order_items, order_events, orders, product_images, product_variants, products, categories, coupons RESTART IDENTITY CASCADE');
}
if ((await db().one('SELECT COUNT(*)::int AS n FROM products')).n) {
  console.log('Products already exist; use --reset to replace them with demo data.');
  await closeDb();
  process.exit(0);
}

const PALETTES = [
  ['#fde68a', '#f59e0b'], ['#bfdbfe', '#3b82f6'], ['#bbf7d0', '#22c55e'], ['#fecaca', '#ef4444'],
  ['#ddd6fe', '#8b5cf6'], ['#fbcfe8', '#ec4899'], ['#a5f3fc', '#06b6d4'], ['#e5e7eb', '#6b7280'],
];

/** Abstract placeholder product photo (SVG), generated locally. */
function placeholder(seed, i) {
  const [a, b] = PALETTES[(seed + i) % PALETTES.length];
  const cx = 300 + ((seed * 37) % 200);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>
    <circle cx="${cx}" cy="420" r="${190 - i * 20}" fill="${b}" opacity="0.85"/>
    <rect x="${180 + i * 40}" y="${200 + (seed % 3) * 30}" width="200" height="200" rx="36" fill="#ffffff" opacity="0.55"/>
    <ellipse cx="400" cy="690" rx="230" ry="26" fill="#000" opacity="0.06"/></svg>`;
  return saveFile(Buffer.from(svg), 'image/svg+xml');
}

// Demo content in English; translated to the shop's language (see ../locales).
const t = translator((await getSettings()).language);

const categories = [
  ['Clothing', 'Comfortable, quality clothes for every day.'],
  ['Accessories', 'Bags, hats and the small details that make a difference.'],
  ['Home', 'Things that make a home feel warmer.'],
  ['Gifts', 'Gift ideas for everyone.'],
];

const sizes = ['S', 'M', 'L', 'XL'];
// [name, category index, price, compare-at price, featured, options, description]
const products = [
  ['Cotton T-shirt', 0, 1990, 2490, true, sizes, 'Soft t-shirt made of 100% organic cotton. A classic fit that goes with everything.'],
  ['Hooded sweatshirt', 0, 4490, null, true, sizes, 'Warm sweatshirt with fleece lining and a large kangaroo pocket.'],
  ['Linen shirt', 0, 3990, null, false, sizes, 'Cool linen shirt, perfect for summer.'],
  ['Jeans', 0, 5490, 6990, false, ['28', '30', '32', '34', '36'], 'Straight fit jeans made of durable denim.'],
  ['Canvas tote bag', 1, 1490, null, true, null, 'Sturdy tote bag for shopping, the beach and everyday use.'],
  ['Baseball cap', 1, 1790, null, false, null, 'Adjustable cotton cap.'],
  ['Leather wallet', 1, 3490, null, false, null, 'Slim genuine leather wallet with 6 card slots.'],
  ['Ceramic mug', 2, 1290, null, true, null, 'Handmade 350ml mug. Dishwasher safe.'],
  ['Scented candle', 2, 1890, 2290, true, ['Lavender', 'Vanilla', 'Sandalwood'], 'Soy wax candle with a 40-hour burn time.'],
  ['Cotton throw', 2, 4990, null, false, null, 'Lightweight sofa throw, 130x170cm.'],
  ['Gift card', 3, 2500, null, false, null, 'Let them choose! The card is sent by email.'],
  ['Relax gift set', 3, 3990, 4590, true, null, 'Candle, mug and herbal tea in a beautiful gift box.'],
];

await updateSettings({
  storeName: 'Demo Store',
  tagline: t('Beautiful things for every day'),
  announcement: t('Free shipping on orders over 50€ · Code WELCOME10 for -10%'),
  hero: {
    title: t('The new collection is here'),
    subtitle: t('Quality products, carefully selected. Fast delivery nationwide.'),
    ctaText: t('Shop the products'),
    ctaLink: '/products',
  },
  contact: { email: 'info@example.com', phone: '210 000 0000', address: t('1 Example Street, Athens'), hours: t('Mon-Fri 9:00-17:00') },
  // The demo has no Stripe keys, so offer the offline methods too.
  payments: {
    cod: { enabled: true },
    bank: { enabled: true, details: t('Bank: Demo Bank\nIBAN: GR00 0000 0000 0000 0000 0000 000\nAccount holder: Demo Store') },
  },
});
if (!(await db().one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))) {
  await createAdmin('admin@example.com', 'admin1234');
  console.log('Demo admin: admin@example.com / admin1234  (change it!)');
}
await ensureInitialData();

const catIds = [];
for (const [i, [name, description]] of categories.entries()) {
  catIds.push((await saveCategory(null, { name: t(name), description: t(description), image: null, sortOrder: i, active: true })).id);
}

for (const [i, [name, cat, price, compare, featured, variants, description]] of products.entries()) {
  const images = [];
  for (let k = 0; k < 3; k++) images.push(await placeholder(i, k));
  const p = await saveProduct(null, {
    name: t(name),
    description: t(description),
    price,
    compareAtPrice: compare,
    sku: `SKU-${100 + i}`,
    stock: variants ? 0 : 5 + ((i * 7) % 30),
    trackStock: true,
    categoryId: catIds[cat],
    featured,
    active: true,
    images,
    variants: (variants || []).map((v, k) => ({ name: t(v), sku: `SKU-${100 + i}-${v}`, price: null, stock: k === 0 ? 0 : 3 + k * 2 })),
  });
  // Spread creation times so "newest" ordering looks natural.
  await db().query("UPDATE products SET created_at = now() - make_interval(hours => $1) WHERE id = $2", [i, p.id]);
}

await db().query("INSERT INTO coupons (code, type, value, min_order) VALUES ('WELCOME10', 'percent', 10, 0) ON CONFLICT DO NOTHING");
console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
await closeDb();
