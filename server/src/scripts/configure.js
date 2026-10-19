// Sets up a client's shop from a JSON file (see clients/example.json):
//   npm run configure -- clients/acme.json
// Run it with the client's DATABASE_URL / SUPABASE_* in the environment
// (e.g. a .env.<client> file: `DOTENV_CONFIG_PATH=.env.acme npm run configure -- clients/acme.json`).
// It creates the tables, the storage bucket, settings, shipping methods,
// categories, pages, coupons and the admin account. Safe to run again.
import fs from 'node:fs';
import path from 'node:path';
import { closeDb, db, initDb } from '../db.js';
import { ROOT_DIR } from '../config.js';
import { updateSettings } from '../settings.js';
import { ensureBucket } from '../storage.js';
import { createAdmin, ensureInitialData } from './bootstrap.js';
import { saveCategory, upsertPage } from '../routes/admin.js';
import { slugify } from '../utils.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run configure -- clients/<client>.json');
  process.exit(1);
}
const conf = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, file), 'utf8'));

await initDb();
console.log('✔ database tables');
if (await ensureBucket()) console.log('✔ storage bucket');
else console.log('… storage: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set, images will be stored locally');

if (conf.settings) {
  await updateSettings(conf.settings);
  console.log('✔ settings');
}
if (conf.admin?.email && conf.admin?.password) {
  await createAdmin(conf.admin.email, conf.admin.password, conf.admin.name);
  console.log(`✔ admin ${conf.admin.email}`);
}
await ensureInitialData();

if (conf.shipping) {
  await db().query('DELETE FROM shipping_methods');
  for (const [i, m] of conf.shipping.entries()) {
    await db().query(
      'INSERT INTO shipping_methods (name, description, price, free_over, requires_address, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
      [m.name, m.description || '', m.price, m.freeOver ?? null, m.requiresAddress !== false, i],
    );
  }
  console.log(`✔ ${conf.shipping.length} shipping methods`);
}

if (conf.categories) {
  for (const [i, c] of conf.categories.entries()) {
    const name = typeof c === 'string' ? c : c.name;
    if (!(await db().one('SELECT id FROM categories WHERE slug = $1', [slugify(name)]))) {
      await saveCategory(null, { name, description: c.description || '', image: null, sortOrder: i, active: true });
    }
  }
  console.log('✔ categories');
}

if (conf.pages) {
  for (const [slug, p] of Object.entries(conf.pages)) await upsertPage({ slug, title: p.title, content: p.content });
  console.log(`✔ ${Object.keys(conf.pages).length} pages`);
}

if (conf.coupons) {
  for (const c of conf.coupons) {
    await db().query('INSERT INTO coupons (code, type, value, min_order) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING', [
      c.code.toUpperCase(), c.type, c.value || 0, c.minOrder || 0,
    ]);
  }
  console.log('✔ coupons');
}

await closeDb();
console.log('Done.');
