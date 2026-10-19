# Νέος πελάτης: στήσιμο βήμα-βήμα

Κάθε πελάτης έχει **δικά του** Supabase (βάση + φωτογραφίες), Resend (email), Stripe (κάρτες),
domain και **ένα δικό του project στο Vercel** από το ίδιο repository. Ο κώδικας είναι ένας για όλους·
αλλάζουν μόνο οι μεταβλητές (Environment Variables) κάθε project.

Χρόνος: ~45 λεπτά την πρώτη φορά, ~20 λεπτά μετά. Πριν ξεκινήσετε, πάρτε απαντήσεις στο
[ερωτηματολόγιο](CLIENT_QUESTIONNAIRE.md).

> Συμβουλή: φτιάξτε ένα email για το κατάστημα (π.χ. `shop@margarita-flowers.gr`) και ανοίξτε **όλους**
> τους λογαριασμούς με αυτό. Κρατήστε τους κωδικούς σε password manager και παραδώστε τους στον πελάτη.

---

## 1. Supabase (βάση δεδομένων + φωτογραφίες)

1. https://supabase.com → **New project**. Region: **Frankfurt (eu-central-1)** (κοντά στην Ελλάδα, GDPR).
   Κρατήστε τον κωδικό της βάσης.
2. **Project Settings → API**: αντιγράψτε
   - `Project URL` → `SUPABASE_URL`
   - `anon` / publishable key → `SUPABASE_ANON_KEY`
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**μυστικό**, μόνο στο Vercel)
3. Πατήστε **Connect** (πάνω) → **Connection string**:
   - **Transaction pooler** (port 6543) → `DATABASE_URL` (αυτό χρησιμοποιεί το κατάστημα)
   - **Session pooler** (port 5432) → κρατήστε το για τα backup (βήμα 8)

   Αντικαταστήστε το `[YOUR-PASSWORD]` με τον κωδικό της βάσης.

Τους πίνακες και τον φάκελο φωτογραφιών (bucket) τους φτιάχνει το script στο βήμα 6 — δεν χρειάζεται τίποτα άλλο εδώ.

## 2. Email (Resend)

1. https://resend.com → λογαριασμός → **Domains → Add domain** → το domain του πελάτη.
2. Προσθέστε τις εγγραφές DNS που σας δείχνει (στον πάροχο του domain) και περιμένετε να γίνει **Verified**.
3. **API Keys → Create** → `RESEND_API_KEY`.
4. `MAIL_FROM="Ανθοπωλείο Μαργαρίτα <orders@margarita-flowers.gr>"`

## 3. Πληρωμές με κάρτα (Stripe) — αν τις θέλει ο πελάτης

1. Ο πελάτης ανοίγει λογαριασμό στο https://stripe.com **στο όνομα της επιχείρησής του** (τα χρήματα πάνε εκεί)
   και συμπληρώνει τα στοιχεία επιχείρησης/τράπεζας.
2. **Developers → API keys** → Secret key → `STRIPE_SECRET_KEY`
   (για δοκιμές πρώτα το `sk_test_…`, στο τέλος το `sk_live_…`).
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://<domain πελάτη>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
   - Signing secret → `STRIPE_WEBHOOK_SECRET`
4. Στο admin του καταστήματος: Ρυθμίσεις → Πληρωμές → ενεργοποίηση «Πιστωτική / χρεωστική κάρτα».

## 4. Vercel (φιλοξενία)

1. https://vercel.com → **Add New → Project** → επιλέξτε το repository `online-shop-template`.
   Όνομα project: π.χ. `shop-margarita`. Framework: **Other** (οι ρυθμίσεις βρίσκονται στο `vercel.json`).
2. **Environment Variables** (πριν το πρώτο Deploy):

   | Μεταβλητή | Τιμή |
   |---|---|
   | `PUBLIC_URL` | `https://margarita-flowers.gr` |
   | `JWT_SECRET` | τυχαίο κείμενο 48+ χαρακτήρων* |
   | `DATABASE_URL` | Supabase transaction pooler (βήμα 1) |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | βήμα 1 |
   | `RESEND_API_KEY`, `MAIL_FROM` | βήμα 2 |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | βήμα 3 (αν υπάρχει) |

   \* `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
3. **Deploy**.
4. **Settings → Domains** → προσθέστε `margarita-flowers.gr` και `www.margarita-flowers.gr` και βάλτε στο DNS
   του domain τις εγγραφές που δείχνει το Vercel. Το HTTPS ενεργοποιείται αυτόματα.

## 5. Σύνδεση με Google / Apple (προαιρετικά)

Οι πελάτες του καταστήματος μπορούν να συνδέονται με Google ή Apple. Γίνεται μέσω του Supabase του πελάτη.

1. Supabase → **Authentication → URL Configuration**:
   - Site URL: `https://margarita-flowers.gr`
   - Redirect URLs: `https://margarita-flowers.gr/auth/callback`
2. **Google** (δωρεάν):
   - https://console.cloud.google.com → νέο project → **APIs & Services → OAuth consent screen**
     (όνομα καταστήματος, λογότυπο, email υποστήριξης) → **Publish app**.
   - **Credentials → Create credentials → OAuth client ID** → Web application.
     Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
     (το βλέπετε στο Supabase → Authentication → Providers → Google).
   - Client ID + Client Secret → Supabase → **Authentication → Providers → Google → Enable**.
3. **Apple** (απαιτεί **Apple Developer Program, 99 $/έτος**, στο όνομα του πελάτη):
   - Ακολουθήστε τον οδηγό του Supabase: *Authentication → Providers → Apple* (Services ID, Key, Team ID).
4. Στο admin του καταστήματος: Ρυθμίσεις → Πληρωμές → **Σύνδεση πελατών** → ενεργοποιήστε Google/Apple.

## 6. Αρχική ρύθμιση καταστήματος (από τον υπολογιστή σας)

1. `cp clients/example.json clients/margarita.json` και συμπληρώστε το με τις απαντήσεις του πελάτη
   (ποσά σε **λεπτά**: `350` = 3,50 €). Ο φάκελος `clients/` δεν ανεβαίνει στο git.
2. Φτιάξτε `.env.margarita` με τα ίδια `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` του πελάτη.
3. Τρέξτε:
   ```bash
   DOTENV_CONFIG_PATH=.env.margarita npm run configure -- clients/margarita.json
   ```
   Δημιουργεί πίνακες, bucket φωτογραφιών, ρυθμίσεις, αποστολές, κατηγορίες, σελίδες, κουπόνια και τον admin.
   Μπορεί να ξανατρέξει χωρίς πρόβλημα.

## 7. Έλεγχος πριν την παράδοση

- [ ] `https://<domain>/admin` → σύνδεση admin, ανέβασμα λογοτύπου και 1-2 προϊόντων
- [ ] Δοκιμαστική παραγγελία με **κάθε** τρόπο πληρωμής (κάρτα με `4242 4242 4242 4242` σε test mode)
- [ ] Έφτασαν τα email σε πελάτη και admin; (έλεγχος και στα spam)
- [ ] Σύνδεση με Google/Apple (αν ενεργοποιήθηκε)
- [ ] Εμφάνιση σε κινητό, φωτεινό και σκοτεινό θέμα
- [ ] Αλλαγή Stripe σε live κλειδιά, διαγραφή δοκιμαστικών παραγγελιών
- [ ] Ο πελάτης αλλάζει τον κωδικό admin

## 8. Backup

Το δωρεάν Supabase δεν κρατάει backup. Το repository έχει έτοιμο GitHub Action που κάθε βράδυ
αποθηκεύει τη βάση κάθε πελάτη (κρατάει 30 ημέρες):

1. GitHub → repository → **Settings → Secrets and variables → Actions** → secret `BACKUP_DATABASE_URLS`.
2. Μία γραμμή ανά πελάτη: `margarita postgresql://...` (το **Session pooler** string του βήματος 1).
3. **Το repository πρέπει να είναι private** (τα backup περιέχουν στοιχεία πελατών).
4. Δοκιμή: Actions → Nightly backups → Run workflow. Επαναφορά: [`scripts/restore-backup.md`](../scripts/restore-backup.md).

Οι φωτογραφίες μένουν στο Supabase Storage· αν τις σβήσει κάποιος από το admin, δεν επανέρχονται.

## Ενημερώσεις του template

`git push` στο repository → το Vercel κάνει αυτόματα deploy σε **όλα** τα projects (όλους τους πελάτες).
Αλλαγές στη βάση εφαρμόζονται αυτόματα στο πρώτο αίτημα κάθε καταστήματος (migrations).
Δοκιμάστε πρώτα τοπικά (`npm test`, `npm run dev`).

## Όρια δωρεάν πλάνων (ενδεικτικά — ελέγξτε τα τρέχοντα)

| | Δωρεάν | Όταν δεν φτάνει |
|---|---|---|
| Supabase | ~500 MB βάση, 1 GB αρχεία, 2 ενεργά projects ανά λογαριασμό, «παγώνει» μετά από ~1 εβδομάδα χωρίς κίνηση | Pro |
| Resend | ~3.000 email/μήνα, 100/ημέρα | Pro |
| Vercel | Το Hobby είναι μόνο για μη εμπορική χρήση | Pro (~20 $/μήνα για όλα τα projects σας) |
