import { db } from '../db.js';
import { config } from '../config.js';
import { hashPassword, normEmail } from '../auth.js';
import { getSettings } from '../settings.js';
import { translator } from '../i18n.js';

// Default content in English; translated to the shop's language (see ../locales).
const PAGES = [
  ['about', 'About us', '## Who we are\n\nTell your story here: what makes the shop special and why people should buy from you.'],
  ['shipping-returns', 'Shipping & Returns', '## Shipping\n\nOrders ship within 1-3 business days.\n\n## Returns\n\nYou can return a product within 14 days of delivery.'],
  ['terms', 'Terms & Conditions', '## Terms & Conditions\n\nFill in your terms (company details, VAT number, payment methods, right of withdrawal, etc.).'],
  ['privacy', 'Privacy Policy', '## Privacy Policy\n\nDescribe what personal data you collect, why, and how customers can exercise their rights (GDPR).'],
];

// [name, description, price, freeOver, requiresAddress, active]
// Store pickup is ready to switch on from the admin, but off by default.
const SHIPPING = [
  ['Courier', 'Delivery in 1-3 business days', 350, 5000, true, true],
  ['Store pickup', 'Free', 0, null, false, false],
];

/** Creates pages, shipping methods and the first admin on a brand-new database. */
export async function ensureInitialData() {
  const t = translator((await getSettings()).language);
  const count = async (table) => (await db().one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n;

  if (!(await count('pages'))) {
    for (const [slug, title, content] of PAGES) {
      await db().query('INSERT INTO pages (slug, title, content) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [slug, t(title), t(content)]);
    }
  }
  if (!(await count('shipping_methods'))) {
    for (const [i, [name, description, price, freeOver, requiresAddress, active]] of SHIPPING.entries()) {
      await db().query(
        'INSERT INTO shipping_methods (name, description, price, free_over, requires_address, active, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [t(name), t(description), price, freeOver, requiresAddress, active, i],
      );
    }
  }
  if (!(await db().one("SELECT id FROM users WHERE role = 'admin' LIMIT 1"))) {
    if (config.admin.email && config.admin.password) {
      await createAdmin(config.admin.email, config.admin.password);
      console.log(`Created admin account ${config.admin.email}`);
    } else if (!config.isTest) {
      console.warn('No admin account yet. Run: npm run create-admin -- you@example.com YourPassword');
    }
  }
}

export async function createAdmin(email, password, name = 'Admin') {
  const hash = await hashPassword(password);
  const row = await db().one(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = excluded.password_hash RETURNING id`,
    [normEmail(email), hash, name],
  );
  return row.id;
}
