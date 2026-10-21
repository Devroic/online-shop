# Online Shop

A complete online shop that is customised per client (name, logo, colours, font, light/dark
appearance, products, shipping, payments, pages) **without code changes**. One repository serves
every client: each client is a separate Vercel project with its own Supabase database, so a
`git push` updates all shops at once.

| | |
|---|---|
| Frontend | React 19 + Vite + React Router (storefront + admin; the admin is a separate bundle) |
| Backend | Node.js + Express 5, running as a Vercel Function |
| Database & images | PostgreSQL + Storage in each client's **Supabase** project |
| Email | **Resend** (SMTP also supported) |
| Payments | Card via **Stripe** (on by default), optional cash on delivery (off by default) |
| Customer sign-in | Email & password, **Google**, **Apple** (via Supabase Auth) |
| Languages | Greek / English |

## Local development

Nothing to install or configure: without `DATABASE_URL` an embedded PostgreSQL (PGlite) is used
in `data/`, images are stored in `data/uploads/`, emails are printed to the terminal.

```bash
npm install
npm run seed      # demo products + admin: admin@example.com / admin1234
npm run dev       # shop: http://localhost:5173 · admin: /admin
```

```bash
npm test                                   # API tests (embedded database)
TEST_DATABASE_URL=postgres://… npm test    # same tests against a real, empty PostgreSQL
npm run build                              # build the React app
npm run questionnaire                      # rebuild docs/client-questionnaire.pdf
```

> The embedded database can be opened by one process at a time: stop `npm run dev` before `npm run seed`
> (a second process stops with a clear message instead of damaging it). If it ever gets damaged, delete `data/` and run `npm run seed` again.

To try real services locally, fill in the optional keys in `.env` (copy `.env.example`).

## New client

1. Send the client the fillable [questionnaire](docs/client-questionnaire.pdf).
2. Follow the step-by-step [new client guide](docs/NEW_CLIENT.md) (in Greek):
   Supabase → Resend → Stripe → `npm run configure` → Vercel → domain → checks → backup.
   It includes copy-paste templates for the client's `.env` and `clients/<client>.json`.

Client files (`clients/*.json`, `.env.*`) are **not** committed: they contain emails, IBANs and passwords.

## Features

**Storefront**
- Home page with hero banner, categories, featured and new products
- Catalog with case- and accent-insensitive search (also for Greek), categories, filters, sorting
- Product page: swipeable gallery, options (size/colour…) with their own stock and price, low-stock notice, related products
- Cart re-checks prices and stock on the server; "€X more for free shipping" bar
- One-page checkout, guest checkout, discount codes, shipping methods, payment methods
- Accounts with email or Google/Apple, order history, saved address, password reset
- Light/dark appearance that follows the device, with a switch in the header
- Emails: order confirmation, welcome, shipping updates, password reset

**Admin**
- Dashboard (revenue, chart, best sellers, low stock)
- Orders: one-click status changes, tracking number, customer email, print, CSV export
- Products: drag & drop photos (resized to WebP in the browser), options, sale prices, stock
- Bulk import/update of products from Excel (.xlsx/.csv) with a template and preview
- Categories, discount codes, shipping methods, pages, messages, customers/admins
- Settings: logo, colours (light & dark) with live preview, font, banner, payments, Google/Apple sign-in, SEO

## Security
- Prices, discounts and stock are calculated on the server inside a transaction; two simultaneous
  orders cannot sell the same last item
- Passwords hashed with bcrypt, session in an httpOnly cookie, rate limiting, CSP, input validation with zod
- Row Level Security on every table: Supabase's public API cannot read the shop's data
- Guest order pages open only with a secret link

## Structure

```
api/index.js               Vercel Function (Express app)
vercel.json                build, routing, headers
server/src/
  app.js, index.js         Express app / local server
  db.js                    PostgreSQL (Supabase or PGlite) + migrations
  settings.js              shop settings and defaults
  storage.js               images (Supabase Storage or local)
  email.js                 email (Resend or SMTP)
  services/                catalog, orders (pricing/stock), payments (Stripe)
  routes/                  public, auth (+Google/Apple), orders, admin, stripe
  scripts/                 seed, configure, create-admin
client/src/
  pages/, admin/           storefront, admin panel
  lib/theme.js             colours, light/dark appearance
  lib/productImport.js     Excel import parsing
  lib/locales/el.js        Greek translations (UI text is written in English)
scripts/questionnaire/     builds the client questionnaire PDF
.github/workflows/         nightly database backups
docs/                      questionnaire, new client guide (Greek)
```

## Changing the database

Add a new entry at the end of the `migrations` array in `server/src/db.js` (never edit one that has
shipped). Every shop applies it automatically on its next request after deploy.
