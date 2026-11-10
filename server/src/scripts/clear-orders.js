// Deletes every order (and its items and history), so a tested shop can be handed to
// the client. Products, categories, settings, pages, shipping and accounts stay.
// Stock held by orders that were not cancelled or returned goes back to the products,
// coupon uses go back to 0, and the next order is #1001 again.
//
//   npm run clear-orders            shows what would be deleted, deletes nothing
//   npm run clear-orders -- --yes   does it (cannot be undone: take a backup first)
//
// The database it works on is the one in .env (DATABASE_URL), printed first.
import { closeDb, db, initDb } from '../db.js';
import { config } from '../config.js';
import { clearAllOrders } from '../services/orders.js';

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

await initDb();
const counts = await db().one(
  `SELECT (SELECT COUNT(*)::int FROM orders) AS orders,
          (SELECT COUNT(*)::int FROM orders WHERE status NOT IN ('cancelled', 'returned')) AS holding,
          (SELECT COALESCE(SUM(i.quantity), 0)::int FROM order_items i JOIN orders o ON o.id = i.order_id
             WHERE o.status NOT IN ('cancelled', 'returned')) AS pieces`,
);

console.log(`\nDatabase: ${target()}`);
console.log(`\nThis deletes ${counts.orders} orders, with their items and history.`);
console.log(`${counts.holding} of them still hold stock: ${counts.pieces} pieces go back to the products.`);
console.log('Coupon uses go back to 0; the next order is #1001.');
console.log('Products, categories, settings, pages, shipping and accounts are not touched.');

if (!confirmed) {
  console.log('\nNothing was deleted. To do it, run again with --yes:  npm run clear-orders -- --yes\n');
  await closeDb();
  process.exit(0);
}

const done = await clearAllOrders();
console.log(`\n✔ ${done.orders} orders deleted, ${done.restocked} pieces back in stock.\n`);
await closeDb();
