// Puts the shop back to how a brand-new shop starts: deletes every product,
// category, order, coupon, message, page, customer and setting, and the
// uploaded photos; then recreates the default pages, the courier / store pickup
// methods, the default settings and the admin from ADMIN_EMAIL / ADMIN_PASSWORD.
//
//   npm run reset-shop            shows what would be deleted, deletes nothing
//   npm run reset-shop -- --yes   does it (cannot be undone: take a backup first)
//
// The database it works on is the one in .env (DATABASE_URL), printed first.
import { closeDb, db, initDb } from '../db.js';
import { config } from '../config.js';
import { supabaseAdmin } from '../storage.js';
import { ensureInitialData } from './bootstrap.js';
import fs from 'node:fs';

// Every table except schema_migrations, which records the database structure.
const TABLES = [
  'order_items', 'order_events', 'orders',
  'product_images', 'product_variants', 'products', 'categories',
  'coupons', 'messages', 'pages', 'shipping_methods',
  'password_resets', 'email_verifications', 'users', 'settings',
];

const confirmed = process.argv.includes('--yes');

/** Where this will write, without printing the password. */
function target() {
  if (!config.databaseUrl) return `local database (${config.pgliteDir})`;
  try {
    const u = new URL(config.databaseUrl);
    return `${u.username}@${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
  } catch {
    return 'DATABASE_URL (could not read it)';
  }
}

/** Every file path in the Supabase bucket, walking into folders. */
async function bucketFiles(sb, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(config.supabase.bucket).list(prefix, { limit: 1000, offset });
    if (error) {
      if (/not found/i.test(error.message)) return out; // no bucket yet: nothing to delete
      throw error;
    }
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(path);
      else out.push(...(await bucketFiles(sb, path))); // a folder
    }
    if (data.length < 1000) return out;
  }
}

if (!config.admin.email || !config.admin.password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env: they create the admin after the reset.');
  console.error('Without them nobody could sign in to the admin. Nothing was deleted.');
  process.exit(1);
}

await initDb();
const sb = supabaseAdmin();
const counts = [];
for (const table of TABLES) counts.push([table, (await db().one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n]);
const files = sb
  ? await bucketFiles(sb)
  : fs.existsSync(config.uploadsDir)
    ? fs.readdirSync(config.uploadsDir, { recursive: true }).filter((f) => fs.statSync(`${config.uploadsDir}/${f}`).isFile())
    : [];

console.log(`\nDatabase: ${target()}`);
console.log(`Photos:   ${sb ? `Supabase bucket "${config.supabase.bucket}" (${config.supabase.url})` : config.uploadsDir}`);
console.log('\nThis deletes:');
for (const [table, n] of counts) if (n) console.log(`  ${String(n).padStart(6)}  ${table}`);
console.log(`  ${String(files.length).padStart(6)}  photo files`);
console.log(`\nThen it recreates the defaults and the admin ${config.admin.email}.`);

if (!confirmed) {
  console.log('\nNothing was deleted. To do it, run again with --yes:  npm run reset-shop -- --yes\n');
  await closeDb();
  process.exit(0);
}

await db().query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
console.log('\n✔ data deleted');

if (sb) {
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await sb.storage.from(config.supabase.bucket).remove(files.slice(i, i + 100));
    if (error) throw error;
  }
} else if (fs.existsSync(config.uploadsDir)) {
  fs.rmSync(config.uploadsDir, { recursive: true, force: true });
}
console.log('✔ photos deleted');

await ensureInitialData();
console.log(`✔ defaults restored; admin: ${config.admin.email}`);
console.log('\nOpen the site: it starts like a new shop. Browser-side settings (theme, cart) stay in each browser; use a private window to see it as a new visitor.\n');
await closeDb();
