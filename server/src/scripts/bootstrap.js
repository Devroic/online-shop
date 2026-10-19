import { getDb } from '../db.js';
import { config } from '../config.js';
import { hashPassword } from '../auth.js';
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
  const db = getDb();
  const lang = getSettings().language === 'en' ? 'en' : 'el';

  if (!db.prepare('SELECT COUNT(*) AS n FROM pages').get().n) {
    const ins = db.prepare('INSERT INTO pages (slug, title, content) VALUES (?, ?, ?)');
    for (const p of PAGES[lang]) ins.run(...p);
  }
  if (!db.prepare('SELECT COUNT(*) AS n FROM shipping_methods').get().n) {
    const ins = db.prepare('INSERT INTO shipping_methods (name, description, price, free_over, requires_address, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    SHIPPING[lang].forEach((m, i) => ins.run(...m, i));
  }
  const hasAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!hasAdmin) {
    if (config.admin.email && config.admin.password) {
      await createAdmin(config.admin.email, config.admin.password);
      console.log(`Created admin account ${config.admin.email}`);
    } else if (!config.isTest) {
      console.warn('No admin account yet. Run: npm run create-admin -- you@example.com YourPassword');
    }
  }
}

export async function createAdmin(email, password, name = 'Admin') {
  const db = getDb();
  const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(hash, existing.id);
    return existing.id;
  }
  return db.prepare("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')").run(email, hash, name).lastInsertRowid;
}
