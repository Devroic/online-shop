# Online Shop Template

Πλήρες ηλεκτρονικό κατάστημα που προσαρμόζεται σε κάθε πελάτη (όνομα, λογότυπο, χρώματα,
γραμματοσειρά, φωτεινό/σκοτεινό θέμα, προϊόντα, αποστολές, πληρωμές, σελίδες) **χωρίς αλλαγές στον κώδικα**.
Ένα repository για όλους τους πελάτες· κάθε πελάτης είναι ένα ξεχωριστό project στο Vercel με δική του βάση.

| | |
|---|---|
| Frontend | React 19 + Vite + React Router (κατάστημα + admin, το admin φορτώνει ξεχωριστά) |
| Backend | Node.js + Express 5, ως Vercel Function |
| Βάση & φωτογραφίες | PostgreSQL + Storage στο **Supabase** του κάθε πελάτη |
| Email | **Resend** (ή SMTP) |
| Πληρωμές | Κάρτα μέσω **Stripe** (προεπιλογή), προαιρετικά αντικαταβολή / τραπεζική κατάθεση |
| Σύνδεση πελατών | Email/κωδικός, **Google**, **Apple** (μέσω Supabase Auth) |
| Γλώσσες | Ελληνικά / Αγγλικά |

## Τοπική ανάπτυξη

Δεν χρειάζεται να εγκαταστήσετε βάση ή λογαριασμούς: χωρίς `DATABASE_URL` χρησιμοποιείται ενσωματωμένη
PostgreSQL (PGlite) στον φάκελο `data/`, και οι φωτογραφίες αποθηκεύονται στο `data/uploads/`.

```bash
npm install
npm run seed      # demo προϊόντα + admin: admin@example.com / admin1234
npm run dev       # κατάστημα: http://localhost:5173 · admin: /admin
```

```bash
npm test                                   # tests του API (ενσωματωμένη βάση)
TEST_DATABASE_URL=postgres://… npm test    # τα ίδια tests σε πραγματική, κενή PostgreSQL
npm run build                              # build του React app
```

> Η ενσωματωμένη βάση ανοίγει από ένα πρόγραμμα τη φορά: σταματήστε το `npm run dev` πριν τρέξετε `npm run seed`.

## Νέος πελάτης

1. [Ερωτηματολόγιο](docs/CLIENT_QUESTIONNAIRE.md) στον πελάτη.
2. [Οδηγός «νέος πελάτης»](docs/NEW_CLIENT.md): Supabase → Resend → Stripe → Vercel → domain →
   `npm run configure -- clients/<πελάτης>.json` → έλεγχοι → backup.

Τα αρχεία `clients/*.json` και `.env.*` των πελατών **δεν** ανεβαίνουν στο git (περιέχουν IBAN, email, κωδικούς).

## Λειτουργίες

**Κατάστημα**
- Αρχική με banner, κατηγορίες, προτεινόμενα και νέα προϊόντα
- Κατάλογος με αναζήτηση χωρίς τόνους («κουπα» → «Κούπα»), κατηγορίες, φίλτρα, ταξινόμηση
- Σελίδα προϊόντος: gallery (swipe στο κινητό), επιλογές με δικό τους απόθεμα/τιμή, χαμηλό απόθεμα, σχετικά προϊόντα
- Καλάθι που επανελέγχει τιμές/απόθεμα στον server, μπάρα «τόσα € για δωρεάν αποστολή»
- Checkout σε μία σελίδα, αγορά χωρίς λογαριασμό, κουπόνια, αποστολές, πληρωμές
- Λογαριασμός με email ή Google/Apple, ιστορικό παραγγελιών, αποθηκευμένη διεύθυνση, επαναφορά κωδικού
- Φωτεινό/σκοτεινό θέμα: ακολουθεί τη συσκευή, με διακόπτη στην κορυφή
- Email: επιβεβαίωση παραγγελίας, καλωσόρισμα, ενημέρωση αποστολής, επαναφορά κωδικού

**Admin**
- Dashboard (έσοδα, γράφημα, δημοφιλέστερα, χαμηλό απόθεμα)
- Παραγγελίες: κατάσταση με ένα κλικ, αριθμός αποστολής, email στον πελάτη, εκτύπωση, CSV
- Προϊόντα: φωτογραφίες με drag & drop (σμίκρυνση σε WebP στον browser), επιλογές, προσφορές, απόθεμα
- Μαζική εισαγωγή/ενημέρωση προϊόντων από Excel (.xlsx/.csv) με έτοιμο πρότυπο και προεπισκόπηση
- Κατηγορίες, κουπόνια, αποστολές, σελίδες, μηνύματα, πελάτες/διαχειριστές
- Ρυθμίσεις: λογότυπο, χρώματα (φωτεινά & σκοτεινά) με ζωντανή προεπισκόπηση, γραμματοσειρά, banner,
  πληρωμές, σύνδεση με Google/Apple, SEO

## Ασφάλεια
- Τιμές, εκπτώσεις και απόθεμα υπολογίζονται μόνο στον server, σε transaction· δύο ταυτόχρονες
  παραγγελίες δεν μπορούν να πουλήσουν το ίδιο τελευταίο τεμάχιο
- Κωδικοί με bcrypt, session σε httpOnly cookie, rate limiting, CSP, έλεγχος εισόδων με zod
- Row Level Security στη βάση: το δημόσιο API του Supabase δεν έχει πρόσβαση στους πίνακες
- Οι σελίδες παραγγελιών επισκεπτών ανοίγουν μόνο με μυστικό σύνδεσμο

## Δομή

```
api/index.js               Vercel Function (Express app)
vercel.json                build, routing, headers
server/src/
  app.js, index.js         Express app / τοπικός server
  db.js                    PostgreSQL (Supabase ή PGlite) + migrations
  settings.js              ρυθμίσεις καταστήματος
  storage.js               φωτογραφίες (Supabase Storage ή τοπικά)
  email.js                 email (Resend ή SMTP)
  services/                catalog, orders (τιμές/απόθεμα), payments (Stripe)
  routes/                  public, auth (+Google/Apple), orders, admin, stripe
  scripts/                 seed, configure, create-admin
client/src/
  pages/, admin/           κατάστημα, admin panel
  lib/theme.js             χρώματα, φωτεινό/σκοτεινό θέμα
  lib/locales/el.js        ελληνικές μεταφράσεις
.github/workflows/         νυχτερινά backup
docs/                      ερωτηματολόγιο, οδηγός νέου πελάτη
```

Εναλλακτικά (χωρίς Vercel) το κατάστημα τρέχει και με Docker σε δικό σας server: `docker compose up -d --build`
με `DATABASE_URL` στο `.env`.
