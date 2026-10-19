// Fills an empty shop with demo data so the template can be tried out:
//   npm run seed            (adds demo data if there are no products)
//   npm run seed -- --reset (wipes catalog + orders first)
import { closeDb, db, initDb } from '../db.js';
import { updateSettings } from '../settings.js';
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

const categories = [
  ['Ρούχα', 'Άνετα και ποιοτικά ρούχα για κάθε μέρα.'],
  ['Αξεσουάρ', 'Τσάντες, καπέλα και μικρές λεπτομέρειες που κάνουν τη διαφορά.'],
  ['Σπίτι', 'Αντικείμενα που κάνουν το σπίτι πιο ζεστό.'],
  ['Δώρα', 'Ιδέες για δώρα για όλους.'],
];

const sizes = ['S', 'M', 'L', 'XL'];
const products = [
  ['Βαμβακερό T-shirt', 0, 1990, 2490, true, sizes, 'Μαλακό t-shirt από 100% οργανικό βαμβάκι. Κλασική γραμμή που ταιριάζει με τα πάντα.'],
  ['Φούτερ με κουκούλα', 0, 4490, null, true, sizes, 'Ζεστό φούτερ με εσωτερικό fleece και μεγάλη τσέπη καγκουρό.'],
  ['Λινό πουκάμισο', 0, 3990, null, false, sizes, 'Δροσερό λινό πουκάμισο, ιδανικό για το καλοκαίρι.'],
  ['Τζιν παντελόνι', 0, 5490, 6990, false, ['28', '30', '32', '34', '36'], 'Straight fit τζιν από ανθεκτικό denim.'],
  ['Πάνινη τσάντα', 1, 1490, null, true, null, 'Ανθεκτική tote bag για ψώνια, παραλία και καθημερινή χρήση.'],
  ['Καπέλο jockey', 1, 1790, null, false, null, 'Ρυθμιζόμενο καπέλο από βαμβάκι.'],
  ['Δερμάτινο πορτοφόλι', 1, 3490, null, false, null, 'Λεπτό πορτοφόλι από γνήσιο δέρμα με θήκες για 6 κάρτες.'],
  ['Κεραμική κούπα', 2, 1290, null, true, null, 'Χειροποίητη κούπα 350ml. Κατάλληλη για πλυντήριο πιάτων.'],
  ['Αρωματικό κερί', 2, 1890, 2290, true, ['Λεβάντα', 'Βανίλια', 'Σανδαλόξυλο'], 'Κερί σόγιας με διάρκεια καύσης 40 ωρών.'],
  ['Βαμβακερή κουβέρτα', 2, 4990, null, false, null, 'Ελαφριά κουβέρτα για τον καναπέ, 130x170cm.'],
  ['Κάρτα δώρου', 3, 2500, null, false, null, 'Δώστε την επιλογή! Η κάρτα αποστέλλεται με email.'],
  ['Σετ δώρου Relax', 3, 3990, 4590, true, null, 'Κερί, κούπα και τσάι βοτάνων σε όμορφο κουτί δώρου.'],
];

updateSettings({
  storeName: 'Demo Store',
  tagline: 'Όμορφα πράγματα για κάθε μέρα',
  announcement: 'Δωρεάν αποστολή για παραγγελίες άνω των 50€ · Κωδικός WELCOME10 για -10%',
  hero: {
    title: 'Η νέα συλλογή έφτασε',
    subtitle: 'Ποιοτικά προϊόντα, προσεκτικά επιλεγμένα. Γρήγορη αποστολή σε όλη την Ελλάδα.',
    ctaText: 'Δείτε τα προϊόντα',
    ctaLink: '/products',
  },
  contact: { email: 'info@example.com', phone: '210 000 0000', address: 'Οδός Παραδείγματος 1, Αθήνα', hours: 'Δευ-Παρ 9:00-17:00' },
  payments: { bank: { details: 'Τράπεζα: Demo Bank\nIBAN: GR00 0000 0000 0000 0000 0000 000\nΔικαιούχος: Demo Store' } },
});
if (!(await db().one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))) {
  await createAdmin('admin@example.com', 'admin1234');
  console.log('Demo admin: admin@example.com / admin1234  (change it!)');
}
await ensureInitialData();

const catIds = [];
for (const [i, [name, description]] of categories.entries()) {
  catIds.push((await saveCategory(null, { name, description, image: null, sortOrder: i, active: true })).id);
}

for (const [i, [name, cat, price, compare, featured, variants, description]] of products.entries()) {
  const images = [];
  for (let k = 0; k < 3; k++) images.push(await placeholder(i, k));
  const p = await saveProduct(null, {
    name,
    description,
    price,
    compareAtPrice: compare,
    sku: `SKU-${100 + i}`,
    stock: variants ? 0 : 5 + ((i * 7) % 30),
    trackStock: true,
    categoryId: catIds[cat],
    featured,
    active: true,
    images,
    variants: (variants || []).map((v, k) => ({ name: v, sku: `SKU-${100 + i}-${v}`, price: null, stock: k === 0 ? 0 : 3 + k * 2 })),
  });
  // Spread creation times so "newest" ordering looks natural.
  await db().query("UPDATE products SET created_at = now() - make_interval(hours => $1) WHERE id = $2", [i, p.id]);
}

await db().query("INSERT INTO coupons (code, type, value, min_order) VALUES ('WELCOME10', 'percent', 10, 0) ON CONFLICT DO NOTHING");
console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
await closeDb();
