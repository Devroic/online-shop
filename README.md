# Online Shop

A complete online shop for small businesses, customised per client (name, logo, colours, font,
light/dark appearance, products, shipping, payments, pages) **without code changes**. One repository
serves every client: each client is a separate Vercel project with its own Supabase database, so a
`git push` to `main` updates all shops at once.

| | |
|---|---|
| Frontend | React 19 + Vite + React Router (storefront + admin; the admin is a separate bundle) |
| Backend | Node.js + Express 5, running as a Vercel Function in Frankfurt (`fra1`) |
| Database & images | PostgreSQL + Storage in each client's **Supabase** project (Frankfurt) |
| Email | **Resend** (SMTP also supported) |
| Payments | Card, Apple Pay, Google Pay, PayPal via **Stripe Checkout**; cash on delivery / at the store per shipping method |
| Customer sign-in | Email & password; optional **Google** / **Facebook** (Supabase Auth, `LOGIN_PROVIDERS`) |
| Languages | Greek / English (optional switch for visitors) |

## Local development

Nothing to install or configure: without `DATABASE_URL` an embedded PostgreSQL (PGlite) is used
in `data/`, images are stored in `data/uploads/`, emails are printed to the terminal.

```bash
npm install
npm run seed      # demo products + admin: admin@example.com / admin1234
npm run dev       # shop: http://localhost:5173 · admin: /admin · API: http://localhost:4000
```

```bash
npm test                                   # API tests (embedded database)
TEST_DATABASE_URL=postgres://… npm test    # same tests against a real, empty PostgreSQL
npm run build                              # build the React app
```

> The embedded database can be opened by one process at a time: stop `npm run dev` before `npm run seed`
> (a second process stops with a clear message instead of damaging it). If it ever gets damaged, delete `data/` and run `npm run seed` again.

To try real services locally, fill in the optional keys in `.env` (copy `.env.example`).
**Careful:** a `DATABASE_URL` in `.env` makes `npm run dev` and every script below work on that
database. Keep each client's values in its own `.env.<client>` and leave `.env` for development.

Card payments locally: use the Stripe sandbox key and forward webhooks with the Stripe CLI:

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired --forward-to localhost:4000/api/stripe/webhook
```

## New client

1. Send the client the fillable questionnaire (build it with `npm run questionnaire` →
   `docs/client-questionnaire.pdf`).
2. Follow the step-by-step [new client guide](docs/NEW_CLIENT.md) (in Greek):
   domain → Supabase → Resend → Stripe → Vercel (environment variables, domain) → admin settings → checks → backup.
   It includes a copy-paste template for the client's environment variables. The database tables
   and the first admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) are created on the first request.
   Optional: `npm run configure -- clients/<client>.json` pre-fills a shop from a JSON file (see `clients/example.json`).
3. While testing, every shop can share one Stripe sandbox: each gets its own webhook endpoint
   (and secret), and an event only updates the order its Checkout Session was made for. Switch to
   the client's own live keys before going live.

Client files (`clients/*.json`, `.env.*`) are **not** committed: they contain emails, keys and passwords.

### Scripts for a client's shop

They work on the database in `.env`; for another client: `DOTENV_CONFIG_PATH=.env.<client> npm run …`.
The two that delete data only show what they would do until you add `--yes`.

| Command | What it does |
|---|---|
| `npm run clear-orders` | Deletes every order, gives held stock back, resets coupon uses, next order is #1001. Products and settings stay. |
| `npm run reset-shop` | Deletes everything (products, orders, customers, settings, photos) and recreates the defaults and the admin. |
| `npm run create-admin -- email password` | Creates an admin; for an existing account, makes it admin **and sets this password**. Runs at once. |

Backups run nightly from GitHub Actions; see [restoring a backup](scripts/restore-backup.md).

## Features

**Storefront**
- Home page with hero banner, editable info boxes, categories, featured and new products
- Catalog with case- and accent-insensitive search (also Greek typed in Latin letters, e.g. "koupa"), categories, price filter, sorting
- Product page: swipeable gallery with arrows, options (size/colour…) with their own name, stock and price, low-stock notice, related products
- Cart re-checks prices and stock on the server, never lets you add more than is in stock; "€X more for free shipping" bar
- One-page checkout, guest checkout, coupons, courier or store pickup, card or cash; address autofill on phones
- Unfinished card payments don't block the customer: coming back cancels the old order and frees its stock at once (otherwise after 30 minutes)
- Accounts with order history, saved address, password reset; guest orders join the account once the email is confirmed
- Light appearance by default; optionally always dark or following the device, with a switch
- Emails: order confirmation, status changes, tracking, refund, welcome / email confirmation, password reset, contact form
- Responsive from small phones to tablets and desktop

**Admin**
- Dashboard: revenue, chart, best sellers, low stock
- Orders: status tabs, search, date filters, quick status changes (with an email choice and tracking number), refunds and returns, print, CSV export
- Products: drag & drop photos (resized to WebP in the browser), options, percentage discounts (one product, ticked ones or a whole category), stock
- Bulk import/update from Excel (.xlsx/.csv) with a template and preview; columns left out of the file keep their values
- Categories, coupons, contact messages, customers (accounts and guests), admins
- Pages: home page banner, announcement and info boxes, text pages
- Shipping & payments: courier with a default cost and per-country prices for any country, free shipping over an amount, store pickup, cash on delivery with fee
- Appearance: logo, colours (light & dark) with live preview, font
- Store details: name, contact, order emails, stock, SEO
- Warns before leaving a page with unsaved changes

## Security
- Prices, discounts and stock are calculated on the server inside a transaction; two simultaneous
  orders cannot sell the same last item
- Stripe webhooks are verified by signature, and only update the order whose session they belong to
- Passwords hashed with bcrypt, session in an httpOnly cookie, rate limiting, CSP, input validation with zod
  (phone numbers and postal codes too)
- Row Level Security on every table: Supabase's public API cannot read the shop's data
- Guest order pages open only with a secret link

## Structure

```
api/index.js               Vercel Function (Express app)
vercel.json                build, routing, headers, region (fra1)
server/src/
  app.js, index.js         Express app / local server
  db.js                    PostgreSQL (Supabase or PGlite) + migrations
  settings.js              shop settings and defaults (in the shop's language)
  countries.js             countries a shop can ship to
  storage.js               images (Supabase Storage or local)
  email.js                 email (Resend or SMTP)
  services/                catalog (search), orders (pricing, stock, statuses), payments (Stripe)
  routes/                  public, auth (+Google/Facebook), orders, admin, stripe
  scripts/                 seed, configure, create-admin, reset-shop, clear-orders
  locales/el.js            Greek texts for emails and defaults
server/test/               API tests
client/src/
  pages/, admin/           storefront, admin panel
  lib/theme.js             colours, light/dark appearance
  lib/productImport.js     Excel import parsing
  lib/locales/el.js        Greek translations (UI text is written in English; [one, other] for plurals)
scripts/questionnaire/     builds the client questionnaire PDF
scripts/restore-backup.md  restoring a nightly backup
.github/workflows/         nightly database backups
docs/NEW_CLIENT.md         new client guide (Greek)
```

## Changing the database

Add a new entry at the end of the `migrations` array in `server/src/db.js` (never edit one that has
shipped). Every shop applies it automatically on its next request after deploy.
