import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from './config.js';

// PostgreSQL everywhere. In production this is the client's Supabase database
// (DATABASE_URL). Without DATABASE_URL — local development and tests — an
// embedded Postgres (PGlite) stored in data/pglite is used, so nothing needs
// installing.

// Each entry runs once, in order. Never edit one that has shipped: append a
// new entry instead, so existing shops upgrade cleanly on their next start.
const migrations = [
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
  );

  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    address JSONB,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    image TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    search_name TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL CHECK (price >= 0),
    compare_at_price INTEGER,
    sku TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0,
    track_stock BOOLEAN NOT NULL DEFAULT TRUE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    search_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_products_category ON products(category_id);

  CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_product_images_product ON product_images(product_id);

  CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT '',
    price INTEGER,
    stock INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_product_variants_product ON product_variants(product_id);

  CREATE TABLE shipping_methods (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0,
    free_over INTEGER,
    requires_address BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('percent', 'fixed', 'free_shipping')),
    value INTEGER NOT NULL DEFAULT 0,
    min_order INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    customer_name TEXT NOT NULL,
    shipping_address JSONB,
    shipping_method_id INTEGER,
    shipping_name TEXT NOT NULL DEFAULT '',
    shipping_cost INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    payment_fee INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    subtotal INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    coupon_code TEXT,
    total INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    admin_notes TEXT NOT NULL DEFAULT '',
    tracking_number TEXT NOT NULL DEFAULT '',
    stripe_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_orders_user ON orders(user_id);
  CREATE INDEX idx_orders_created ON orders(created_at);

  CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    variant_name TEXT NOT NULL DEFAULT '',
    sku TEXT NOT NULL DEFAULT '',
    image TEXT,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );
  CREATE INDEX idx_order_items_order ON order_items(order_id);

  CREATE TABLE order_events (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_order_events_order ON order_events(order_id);

  CREATE TABLE pages (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    show_in_footer BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- The shop talks to the database only from the server. Row Level Security
  -- with no policies blocks Supabase's public REST API from these tables.
  DO $$ DECLARE t text; BEGIN
    FOREACH t IN ARRAY ARRAY['settings','users','password_resets','categories','products','product_images',
      'product_variants','shipping_methods','coupons','orders','order_items','order_events','pages','messages']
    LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t); END LOOP;
  END $$;
  `,
  // 2: remember the language the customer ordered in, for later emails.
  `ALTER TABLE orders ADD COLUMN language TEXT;`,
  // 3: email confirmation for accounts created with email & password.
  // Accounts that already exist count as confirmed, so nobody is locked out.
  `
  ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
  UPDATE users SET email_verified_at = created_at;
  CREATE TABLE email_verifications (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
  `,
  // 4: contact messages get a subject, so the admin list can show one line per message.
  `ALTER TABLE messages ADD COLUMN subject TEXT NOT NULL DEFAULT '';`,
  // 5: a link where the customer can follow the parcel (the courier's tracking page).
  `ALTER TABLE orders ADD COLUMN tracking_url TEXT NOT NULL DEFAULT '';`,
  // 6: countries each shipping method delivers to (ISO codes); existing methods serve Cyprus.
  `ALTER TABLE shipping_methods ADD COLUMN countries JSONB NOT NULL DEFAULT '["CY"]';`,
  // 7: exactly two shipping methods, "courier" and "pickup". The courier has a price per
  // country (rates: [{ country, price, freeOver }]); each method says whether it takes
  // cash (on delivery / at the store), which used to be a shop-wide setting.
  // The first method with an address becomes the courier and the first without one the
  // pickup; other methods are removed (orders keep their shipping name and cost).
  // Missing ones are created by ensureInitialData, in the shop's language.
  `
  ALTER TABLE shipping_methods
    ADD COLUMN kind TEXT,
    ADD COLUMN rates JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN cod BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN cod_fee INTEGER NOT NULL DEFAULT 0;
  UPDATE shipping_methods SET kind = 'courier'
    WHERE id = (SELECT id FROM shipping_methods WHERE requires_address ORDER BY active DESC, sort_order, id LIMIT 1);
  UPDATE shipping_methods SET kind = 'pickup'
    WHERE id = (SELECT id FROM shipping_methods WHERE NOT requires_address ORDER BY active DESC, sort_order, id LIMIT 1);
  DELETE FROM shipping_methods WHERE kind IS NULL;
  UPDATE shipping_methods m SET rates = (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('country', c, 'price', m.price, 'freeOver', m.free_over)), '[]'::jsonb)
    FROM jsonb_array_elements_text(m.countries) AS c
  ) WHERE kind = 'courier';
  UPDATE shipping_methods SET
    cod = COALESCE((SELECT (value #>> '{payments,cod,enabled}')::boolean FROM settings WHERE key = 'store'), FALSE),
    cod_fee = CASE WHEN kind = 'courier'
      THEN COALESCE((SELECT (value #>> '{payments,cod,fee}')::integer FROM settings WHERE key = 'store'), 0) ELSE 0 END;
  CREATE UNIQUE INDEX shipping_methods_kind ON shipping_methods (kind);
  `,
  // 8: pages have a position (moved with arrows in the admin); existing ones keep the
  // alphabetical order they had in the footer.
  `
  ALTER TABLE pages ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
  UPDATE pages p SET sort_order = r.n
    FROM (SELECT slug, (ROW_NUMBER() OVER (ORDER BY title) - 1)::int AS n FROM pages) r
    WHERE p.slug = r.slug;
  `,
  // 9: a percentage discount per product. The stored price stays the regular one;
  // the shop shows and charges the reduced price (see salePrice in services/catalog.js).
  `ALTER TABLE products ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90);`,
  // 10: "returned": a delivered order the customer sent back.
  `
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'));
  `,
];

/** Wraps a pg client/pool or PGlite instance in one small interface. */
function wrap(conn, kind) {
  const run = async (text, params = []) => {
    const r = await conn.query(text, params);
    return { rows: r.rows, rowCount: kind === 'pglite' ? (r.affectedRows ?? r.rows.length) : r.rowCount };
  };
  return {
    query: run,
    // Multi-statement SQL without parameters (migrations).
    exec: (sql) => (kind === 'pglite' ? conn.exec(sql) : conn.query(sql)),
    all: async (text, params) => (await run(text, params)).rows,
    one: async (text, params) => (await run(text, params)).rows[0] ?? null,
  };
}

let root;
let txRunner;
let closer;

async function connect() {
  if (config.databaseUrl) {
    // int8 (COUNT/SUM) as JS numbers instead of strings.
    pg.types.setTypeParser(20, (v) => Number(v));
    const pool = new pg.Pool({
      connectionString: config.databaseUrl,
      max: config.isVercel ? 1 : 5,
      ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl) ? false : { rejectUnauthorized: false },
    });
    root = wrap(pool, 'pg');
    txRunner = async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrap(client, 'pg'));
        await client.query('COMMIT');
        return out;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    };
    closer = () => pool.end();
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dir = config.pgliteDir;
    let unlock = () => {};
    if (dir !== 'memory://') {
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      unlock = lockLocalDb(dir);
    }
    const db = new PGlite(dir, { parsers: { 20: (v) => Number(v) } });
    await db.waitReady;
    root = wrap(db, 'pglite');
    txRunner = (fn) => db.transaction((tx) => fn(wrap(tx, 'pglite')));
    closer = async () => {
      await db.close();
      unlock();
    };
  }
}

/**
 * The embedded database must only be opened by one process: a second one
 * (e.g. `npm run seed` while `npm run dev` runs) can corrupt it. A lock file
 * with the owner's PID stops that with a clear message.
 */
function lockLocalDb(dir) {
  const lock = `${dir}.lock`;
  try {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = pid !== process.pid;
    } catch {
      /* process is gone: stale lock */
    }
    if (alive) {
      throw new Error(
        `The local database (${dir}) is already in use by another process (PID ${pid}). ` +
          'Stop it first (e.g. the running "npm run dev"), then try again.',
      );
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  fs.writeFileSync(lock, String(process.pid));
  const release = () => fs.rmSync(lock, { force: true });
  process.once('exit', release);
  return release;
}

async function migrate() {
  await tx(async (db) => {
    // Only one instance migrates at a time (several serverless instances may start together).
    await db.query("SELECT pg_advisory_xact_lock(hashtext('shop_migrations'))");
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const done = new Set((await db.all('SELECT version FROM schema_migrations')).map((r) => r.version));
    for (let v = 0; v < migrations.length; v++) {
      if (done.has(v + 1)) continue;
      await db.exec(migrations[v]);
      await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [v + 1]);
    }
  });
}

let ready;
/** Connects and migrates once per process (or serverless instance). */
export function initDb() {
  ready ??= (async () => {
    await connect();
    await migrate();
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

/** The shared connection. Call `initDb()` first. */
export function db() {
  if (!root) throw new Error('Database not initialised');
  return root;
}

/** Runs `fn(tx)` in a transaction; use `tx` (not db()) for every query inside. */
export function tx(fn) {
  return txRunner(fn);
}

export async function closeDb() {
  await closer?.();
  root = txRunner = closer = ready = undefined;
}
