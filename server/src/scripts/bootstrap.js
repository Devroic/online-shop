import { db } from '../db.js';
import { config } from '../config.js';
import { hashPassword, normEmail } from '../auth.js';
import { getSettings } from '../settings.js';

const PAGES = {
  el: [
    ['about', 'Σχετικά με εμάς', '## Ποιοι είμαστε\n\nΓράψτε εδώ την ιστορία του καταστήματος, τι σας κάνει ξεχωριστούς και γιατί να ψωνίσει κάποιος από εσάς.'],
    ['shipping-returns', 'Αποστολές & Επιστροφές', '## Αποστολές\n\nΟι παραγγελίες αποστέλλονται εντός 1-3 εργάσιμων ημερών.\n\n## Επιστροφές\n\nΜπορείτε να επιστρέψετε ένα προϊόν εντός 14 ημερών από την παραλαβή.'],
    ['terms', 'Όροι χρήσης', '## Όροι χρήσης\n\nΣυμπληρώστε τους όρους χρήσης του καταστήματος (στοιχεία επιχείρησης, ΑΦΜ, τρόποι πληρωμής, δικαίωμα υπαναχώρησης κ.λπ.).'],
    ['privacy', 'Πολιτική απορρήτου', '## Πολιτική απορρήτου\n\nΠεριγράψτε ποια προσωπικά δεδομένα συλλέγετε, για ποιο σκοπό και πώς μπορεί ο πελάτης να ασκήσει τα δικαιώματά του (GDPR).'],
  ],
  en: [
    ['about', 'About us', '## Who we are\n\nTell your story here: what makes the shop special and why people should buy from you.'],
    ['shipping-returns', 'Shipping & Returns', '## Shipping\n\nOrders ship within 1-3 business days.\n\n## Returns\n\nYou can return a product within 14 days of delivery.'],
    ['terms', 'Terms & Conditions', '## Terms & Conditions\n\nFill in your terms (company details, VAT number, payment methods, right of withdrawal, etc.).'],
    ['privacy', 'Privacy Policy', '## Privacy Policy\n\nDescribe what personal data you collect, why, and how customers can exercise their rights (GDPR).'],
  ],
};

const SHIPPING = {
  el: [
    ['Courier', 'Παράδοση σε 1-3 εργάσιμες', 350, 5000, 1],
    ['Παραλαβή από το κατάστημα', 'Χωρίς χρέωση', 0, null, 0],
  ],
  en: [
    ['Courier', 'Delivery in 1-3 business days', 350, 5000, 1],
    ['Store pickup', 'Free', 0, null, 0],
  ],
};

/** Creates pages, shipping methods and the first admin on a brand-new database. */
export async function ensureInitialData() {
  const lang = (await getSettings()).language === 'en' ? 'en' : 'el';
  const count = async (table) => (await db().one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n;

  if (!(await count('pages'))) {
    for (const [slug, title, content] of PAGES[lang]) {
      await db().query('INSERT INTO pages (slug, title, content) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [slug, title, content]);
    }
  }
  if (!(await count('shipping_methods'))) {
    for (const [i, [name, description, price, freeOver, requiresAddress]] of SHIPPING[lang].entries()) {
      await db().query(
        'INSERT INTO shipping_methods (name, description, price, free_over, requires_address, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [name, description, price, freeOver, !!requiresAddress, i],
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
