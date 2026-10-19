// Applies a per-client JSON file (see clients/example.json) to the database:
//   npm run configure -- clients/acme.json
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db.js';
import { ROOT_DIR } from '../config.js';
import { updateSettings } from '../settings.js';
import { slugify, uniqueSlug } from '../utils.js';
import { createAdmin, ensureInitialData } from './bootstrap.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run configure -- clients/<client>.json');
  process.exit(1);
}
const conf = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, file), 'utf8'));
const db = getDb();

if (conf.settings) {
  updateSettings(conf.settings);
  console.log('✔ settings');
}
await ensureInitialData();

if (conf.shipping) {
  db.transaction(() => {
    db.prepare('DELETE FROM shipping_methods').run();
    const ins = db.prepare('INSERT INTO shipping_methods (name, description, price, free_over, requires_address, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    conf.shipping.forEach((m, i) => ins.run(m.name, m.description || '', m.price, m.freeOver ?? null, m.requiresAddress === false ? 0 : 1, i));
  })();
  console.log(`✔ ${conf.shipping.length} shipping methods`);
}

if (conf.categories) {
  const ins = db.prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)');
  conf.categories.forEach((c, i) => {
    const name = typeof c === 'string' ? c : c.name;
    const slug = slugify(name);
    if (!db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) ins.run(name, uniqueSlug(db, 'categories', slug), c.description || '', i);
  });
  console.log(`✔ categories`);
}

if (conf.pages) {
  const up = db.prepare(
    `INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = datetime('now')`,
  );
  for (const [slug, p] of Object.entries(conf.pages)) up.run(slug, p.title, p.content);
  console.log(`✔ ${Object.keys(conf.pages).length} pages`);
}

if (conf.coupons) {
  const ins = db.prepare('INSERT OR IGNORE INTO coupons (code, type, value, min_order) VALUES (?, ?, ?, ?)');
  for (const c of conf.coupons) ins.run(c.code.toUpperCase(), c.type, c.value || 0, c.minOrder || 0);
  console.log(`✔ coupons`);
}

if (conf.admin?.email && conf.admin?.password) {
  await createAdmin(conf.admin.email, conf.admin.password, conf.admin.name);
  console.log(`✔ admin ${conf.admin.email}`);
}
console.log('Done.');
