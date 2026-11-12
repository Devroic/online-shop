# Νέος πελάτης: τι κάνω βήμα-βήμα

Ξεκινάς όταν σου έρθει συμπληρωμένο το ερωτηματολόγιο (PDF, μία σελίδα: όνομα, domain, email, στοιχεία επιχείρησης).
Όλα τα υπόλοιπα (λογότυπο, χρώματα, αποστολές, αντικαταβολή, προϊόντα) τα βάζει ο πελάτης από το admin μετά την παράδοση (Βήμα 9).
Στα παραδείγματα ο πελάτης λέγεται `margarita` και το domain του `margarita.gr`: βάλε τα δικά του.

Χρόνος: ~45 λεπτά την πρώτη φορά, ~20 λεπτά μετά.

**Ποιος έχει ποιον λογαριασμό**

| Υπηρεσία | Λογαριασμός | Γιατί |
|---|---|---|
| Supabase, Resend | εσύ, με email `margarita@devroic.com` | τα τεχνικά email (όρια, πάγωμα, DNS) έρχονται σε εσένα |
| Stripe | ο πελάτης, με το δικό του email | είναι τα χρήματά του· σε προσθέτει ως Developer |
| Vercel | ο δικός σου λογαριασμός | ένα project ανά πελάτη |
| Domain | ο πελάτης (ιδανικά) | εσύ χρειάζεσαι μόνο πρόσβαση στο DNS |

Όλα τα `…@devroic.com` φτάνουν στο email σου μέσω του **Catch-All** του Namecheap: δεν φτιάχνεις
τίποτα ανά πελάτη, απλώς διαλέγεις ένα όνομα (π.χ. το domain του πελάτη χωρίς `.gr`). Κάνε στο email σου
έναν κανόνα «Προς: margarita@devroic.com → φάκελος Margarita» για να ξεχωρίζεις τις ειδοποιήσεις.

---

## Βήμα 0. Προετοιμασία (στον υπολογιστή σου)

- Διάλεξε το email λογαριασμών του πελάτη: `margarita@devroic.com`.
- Άνοιξε έναν φάκελο για τον πελάτη στον password manager σου. Εκεί κρατάς ό,τι κωδικό/κλειδί φτιάχνεις παρακάτω.
- Γράψε τον πελάτη στη λίστα πελατών σου (domain, email λογαριασμών, Vercel project, email Stripe, λήξη domain).
- Στείλε στον πελάτη να ανοίξει **λογαριασμό Stripe** (Βήμα 4), ώστε να είναι έτοιμος όταν φτάσεις εκεί.
- Φτιάξε ένα σημείωμα `.env.margarita` (στον password manager ή στον φάκελο του repository: **δεν**
  ανεβαίνει στο git) με το [template του .env](#template-env) στο τέλος του οδηγού. Εκεί μαζεύεις τις τιμές των επόμενων βημάτων.
- `ADMIN_EMAIL`: το email του πελάτη (από το ερωτηματολόγιο).
- Βγάλε ένα τυχαίο κλειδί για το `JWT_SECRET` και έναν προσωρινό κωδικό για το `ADMIN_PASSWORD`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"
  ```

## Βήμα 1. Domain

- Αν ο πελάτης **έχει** domain: ζήτα του πρόσβαση στις ρυθμίσεις DNS (π.χ. λογαριασμός Papaki).
- Αν **όχι**: αγόρασέ το (π.χ. Papaki) στο όνομα του πελάτη.
- Στο `.env.margarita`: `PUBLIC_URL=https://margarita.gr`

## Βήμα 2. Supabase (βάση δεδομένων + φωτογραφίες)

- Πήγαινε στο https://supabase.com και κάνε εγγραφή με `margarita@devroic.com` (το email επιβεβαίωσης έρχεται σε εσένα).
- Πάτα **New project**:
  - Name: `margarita`
  - Database password: πάτα **Generate** και κράτα τον στον password manager
  - Region: **Central EU (Frankfurt)**. Πάντα αυτή: ο server του site τρέχει κι αυτός στη Φρανκφούρτη (`"regions": ["fra1"]` στο `vercel.json`), δίπλα στη βάση. Σε άλλη περιοχή κάθε σελίδα θα αργούσε.
- Περίμενε 1-2 λεπτά να ετοιμαστεί.
- Πάτα **Connect** (πάνω στη μέση). Αντέγραψε το **Transaction pooler** connection string (port **6543**):
  - Στο `.env.margarita` → `DATABASE_URL=` (βάλε τον κωδικό της βάσης στη θέση του `[YOUR-PASSWORD]`)
- Στο ίδιο παράθυρο αντέγραψε και το **Session pooler** string (port **5432**) στον password manager. Θα το χρειαστείς στο Βήμα 8 (backup).
- Πήγαινε **Project Settings → API**:
  - Project URL → `SUPABASE_URL=`
  - `anon` / publishable key → `SUPABASE_ANON_KEY=`
  - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY=` (**μυστικό**, μην το δώσεις πουθενά αλλού)

Δεν φτιάχνεις τίποτα μέσα στη Supabase: οι πίνακες, οι βασικές σελίδες, οι αποστολές και ο admin
δημιουργούνται μόνα τους με το πρώτο άνοιγμα του site (Βήμα 5), ο φάκελος φωτογραφιών με το πρώτο ανέβασμα.

## Βήμα 3. Resend (email)

- Πήγαινε στο https://resend.com και κάνε εγγραφή με `margarita@devroic.com`.
- **Domains → Add domain** → `margarita.gr`, Region: **Ireland (eu-west-1)**.
- Το Resend σου δείχνει 3-4 εγγραφές DNS. Πρόσθεσέ τες στο DNS του domain (Βήμα 1), ακριβώς όπως τις δείχνει.
- Περίμενε να γίνει **Verified** (συνήθως λίγα λεπτά, μερικές φορές μέχρι λίγες ώρες).
- **API Keys → Create API key** (Permission: Sending access) → `RESEND_API_KEY=`
- Στο `.env.margarita`: `MAIL_FROM="Ανθοπωλείο Μαργαρίτα <orders@margarita.gr>"`
  (το όνομα του καταστήματος + οποιαδήποτε διεύθυνση στο domain του)

## Βήμα 4. Stripe (πληρωμές με κάρτα)

Τον λογαριασμό τον ανοίγει **ο πελάτης**, με το δικό του email. Στείλε του:
- Εγγραφή στο https://stripe.com με το email του. Χώρα: **Ελλάδα**.
- **Activate payments**: στοιχεία επιχείρησης, IBAN, ταυτοποίηση. Website: `https://margarita.gr`.
  (Αν δυσκολευτεί, κάντε το μαζί σε μια κλήση. Μέχρι να ολοκληρωθεί, συνεχίζεις κανονικά με τα κλειδιά **test**.)
- **Settings → Team → Invite**: `margarita@devroic.com`, ρόλος **Developer**.

Εσύ αποδέχεσαι την πρόσκληση (έρχεται στο email σου) και συνδέεσαι στο Stripe του πελάτη:
- Κλειδιά. Ξεκίνα σε **test mode** (διακόπτης «Test mode» πάνω δεξιά):
  - **Developers → API keys** → Secret key (`sk_test_…`) → `STRIPE_SECRET_KEY=`
  - **Developers → Webhooks → Add endpoint**:
    - Endpoint URL: `https://margarita.gr/api/stripe/webhook`
    - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
    - Signing secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET=`
  - **Settings → Payments → Payment methods** (οι τρόποι πληρωμής στη σελίδα του Stripe ορίζονται μόνο εδώ, όχι από τον κώδικα):
    - **On**: Cards, Apple Pay, Google Pay, PayPal
    - **Off**: όλα τα υπόλοιπα (Link, Amazon Pay, Klarna, Bancontact, EPS, MB WAY, Satispay κ.λπ.)

## Βήμα 5. Vercel (το site)

- Πήγαινε στο https://vercel.com (ο **δικός σου** λογαριασμός) → **Add New → Project**.
- Διάλεξε το repository `online-shop` και δώσε όνομα project `shop-margarita`.
- Άνοιξε **Environment Variables**. Αντέγραψε **όλο** το περιεχόμενο του `.env.margarita` και κάνε paste στο πρώτο πεδίο «Key». Το Vercel τα χωρίζει μόνο του.
- Πάτα **Deploy** και περίμενε ~1 λεπτό. Άνοιξε το site μία φορά: έτσι στήνεται η βάση και ο admin.
- Πήγαινε **Settings → Domains → Add** και πρόσθεσε `margarita.gr` και `www.margarita.gr`.
  - Το Vercel σου δείχνει τι εγγραφές DNS να βάλεις. Βάλε τες στο DNS του domain.
  - Όταν γίνουν ✓, το site ανοίγει στο `https://margarita.gr` (το HTTPS γίνεται αυτόματα).

## Βήμα 6. Ρυθμίσεις στο admin

- Άνοιξε `https://margarita.gr/admin` και συνδέσου με το `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- **Στοιχεία καταστήματος**: όνομα καταστήματος και email επικοινωνίας.
- **Σελίδες → Βοήθεια → Όροι χρήσης**: συμπλήρωσε επωνυμία, ΑΦΜ, διεύθυνση από το ερωτηματολόγιο.

## Βήμα 7. Δοκιμή

- Βάλε ένα δοκιμαστικό προϊόν: **Προϊόντα → Νέο προϊόν**.
- Κάνε μια παραγγελία από κινητό με κάρτα δοκιμής `4242 4242 4242 4242` (οποιαδήποτε μελλοντική ημερομηνία, οποιοδήποτε CVC).
- Έλεγξε:
  - η παραγγελία φαίνεται «Πληρώθηκε» στο admin
  - ήρθε email στον πελάτη (δικό σου email) και στο email παραγγελιών (κοίτα και τα spam)
- Σβήσε το δοκιμαστικό προϊόν και τις δοκιμαστικές παραγγελίες (ακύρωση).

## Βήμα 8. Ενεργοποίηση πραγματικών πληρωμών + backup

- Stripe: όταν ο πελάτης έχει ολοκληρώσει την ενεργοποίηση (Βήμα 4), κλείσε το **Test mode** και ξανακάνε για **live**:
  - Developers → API keys → `sk_live_…`
  - Developers → Webhooks → Add endpoint (ίδιο URL, ίδια 3 events) → νέο `whsec_…`
  - Settings → Payments → Payment methods: ίδιες ρυθμίσεις με το Βήμα 4 (το live έχει δικές του). Το PayPal μπορεί να ζητήσει
    έγκριση από το Stripe· μέχρι να ενεργοποιηθεί, η σελίδα πληρωμής δείχνει μόνο κάρτα, Apple Pay και Google Pay.
- Vercel → project → **Settings → Environment Variables**: άλλαξε τα `STRIPE_SECRET_KEY` και `STRIPE_WEBHOOK_SECRET` με τα live.
- Vercel → **Deployments** → στο τελευταίο: **⋯ → Redeploy**, για να φορτώσουν τα νέα κλειδιά.
- Backup: GitHub → repository → **Settings → Secrets and variables → Actions → `BACKUP_DATABASE_URLS`** → Update:
  - πρόσθεσε μια γραμμή: `margarita <Session pooler string του Βήματος 2>`

## Βήμα 9. Παράδοση στον πελάτη

Στείλε του:
- το link του καταστήματος: `https://margarita.gr`
- το link της διαχείρισης: `https://margarita.gr/admin`
- το email και τον προσωρινό κωδικό admin. Πες του να τον αλλάξει από **Ο λογαριασμός μου → Προφίλ**.
- τι συμπληρώνει μόνος του στο admin (όλα αλλάζουν όποτε θέλει):
  - **Εμφάνιση**: λογότυπο, χρώματα, γραμματοσειρά
  - **Στοιχεία καταστήματος**: τηλέφωνο, διεύθυνση, ωράριο, social media
  - **Αποστολές & πληρωμές**: κόστος courier, δικοί του τρόποι αποστολής (π.χ. BOX NOW), δωρεάν αποστολή άνω των, παραλαβή από το κατάστημα, αντικαταβολή
  - **Σελίδες**: banner αρχικής σελίδας, «Σχετικά με εμάς»
  - **Προϊόντα**: ένα-ένα ή όλα μαζί με **Εισαγωγή από Excel**

### Καθαρό κατάστημα πριν την παράδοση

Αν έκανες δοκιμές (προϊόντα, παραγγελίες, ρυθμίσεις), επανέφερε το κατάστημα στις προεπιλογές πριν το δώσεις:

```bash
npm run reset-shop
```

Δείχνει σε ποια βάση θα γράψει και τι θα σβήσει, **χωρίς να σβήσει τίποτα**. Αν είναι η σωστή βάση:

```bash
npm run reset-shop -- --yes
```

Σβήνει όλα τα δεδομένα και τις φωτογραφίες και ξαναστήνει σελίδες, τρόπους αποστολής, ρυθμίσεις και τον admin από το
`ADMIN_EMAIL` / `ADMIN_PASSWORD` του `.env`. Δεν αναιρείται: πάρε πρώτα backup. Τρέχει στη βάση του `.env`· για άλλο
πελάτη: `DOTENV_CONFIG_PATH=.env.margarita npm run reset-shop`.

## Μετά: συντήρηση

- Μία φορά τον μήνα: δες τον φάκελο κάθε πελάτη στο email σου (ειδοποιήσεις Supabase/Resend),
  ότι το backup στο GitHub → **Actions** είναι πράσινο και αν λήγει κάποιο domain.
- Αν η Supabase γράψει ότι το project «παγώνει» (paused), άνοιξέ το και πάτα **Restore**.
- Αν ο πελάτης φύγει: άλλαξε το email των λογαριασμών Supabase/Resend στο δικό του και δώσ' του τους κωδικούς.
  Το Stripe και το domain είναι ήδη δικά του.

---

## Προαιρετικό: σύνδεση πελατών με Google

Κάν' το μόνο αν το θέλει ο πελάτης.

- Supabase → **Authentication → URL Configuration**:
  - Site URL: `https://margarita.gr`
  - Redirect URLs: πρόσθεσε `https://margarita.gr/**` (με το `/**`: καλύπτει το `/auth/callback?next=…`)
- Supabase → **Authentication → Providers → Google**: άνοιξέ το και αντέγραψε το **Callback URL** που δείχνει.
- https://console.cloud.google.com (ο δικός σου λογαριασμός Google):
  - φτιάξε νέο project `margarita`
  - **APIs & Services → OAuth consent screen**: όνομα καταστήματος, email, λογότυπο → **Publish**
  - **Credentials → Create credentials → OAuth client ID** → Web application → Authorized redirect URI: το Callback URL της Supabase
  - αντέγραψε **Client ID** και **Client secret** στη Supabase (Google provider) → Save
- Vercel → project → **Settings → Environment Variables**: `LOGIN_PROVIDERS=google` → **Redeploy**.
  Δεν υπάρχει διακόπτης στο admin, για να μην το κλείσει κατά λάθος ο πελάτης.

## Προαιρετικό: σύνδεση πελατών με Facebook

Δωρεάν. Αρκεί ο δικός σου λογαριασμός Facebook για όλους τους πελάτες: μία «εφαρμογή» ανά κατάστημα.

- Κάνε πρώτα τα δύο πρώτα σημεία της Google (URL Configuration στη Supabase), αν δεν τα έχεις κάνει.
- Supabase → **Authentication → Providers → Facebook**: αντέγραψε το **Callback URL** που δείχνει.
- Σελίδες → Βοήθεια → **Πολιτική απορρήτου**: πρόσθεσε μια παράγραφο «Διαγραφή δεδομένων»
  (π.χ. «Για να διαγράψετε τον λογαριασμό και τα δεδομένα σας, στείλτε email στο …»). Το Facebook τη ζητά.
- https://developers.facebook.com → **My Apps → Create App**:
  - Use case: **Authenticate and request data from users with Facebook Login**
  - App name: το όνομα του καταστήματος → Create
- **Use cases → Facebook Login → Customize**:
  - Permissions: βεβαιώσου ότι υπάρχει το **email** (πάτα Add αν λείπει)
  - Settings → **Valid OAuth Redirect URIs**: το Callback URL της Supabase → Save
- **App settings → Basic**:
  - App domains: `margarita.gr`
  - Privacy Policy URL και User data deletion (Data deletion instructions URL): `https://margarita.gr/p/privacy`
  - Category, App icon (το λογότυπο) → Save
  - αντέγραψε **App ID** και **App Secret**
- Supabase → **Providers → Facebook**: Facebook client ID = App ID, Facebook secret = App Secret → Save
- Facebook → πάνω στη σελίδα **App Mode: Development → Live** (ή **Publish**). Αν σου ζητήσει
  **Business verification**, ακολούθησε τα βήματα με τα στοιχεία της επιχείρησης του πελάτη.
- Vercel → **Environment Variables**: `LOGIN_PROVIDERS=google,facebook` (ή μόνο `facebook`) → **Redeploy**.
- Αν κάποιος λογαριασμός Facebook δεν δώσει email, το κατάστημα του ζητά να συνδεθεί με email
  (χωρίς email δεν μπορούν να σταλούν οι επιβεβαιώσεις παραγγελιών).

## Δοκιμή Google/Facebook στον υπολογιστή σου

- Στο `.env` βάλε `SUPABASE_URL` και `SUPABASE_ANON_KEY` ενός δοκιμαστικού Supabase project.
- Supabase → **Authentication → URL Configuration → Redirect URLs**: πρόσθεσε `http://localhost:5173/**`.
- Στο `.env` βάλε `LOGIN_PROVIDERS=google,facebook` και ξεκίνα ξανά το `npm run dev` → τα κουμπιά εμφανίζονται στη σύνδεση και στην εγγραφή.

---

<a id="template-env"></a>
## Template: `.env` πελάτη

Αντέγραψε το σε `.env.margarita` και συμπλήρωσε μόνο τις τιμές μετά το `=`.

```env
# --- Κατάστημα ---------------------------------------------------------------
PUBLIC_URL=https://
JWT_SECRET=
# Ο πρώτος admin (φτιάχνεται μόνο αν δεν υπάρχει ήδη admin)
ADMIN_EMAIL=
ADMIN_PASSWORD=

# --- Supabase (Βήμα 2) ---------------------------------------------------------
# Connect → Transaction pooler (port 6543), με τον κωδικό της βάσης
DATABASE_URL=
# Project Settings → API
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# --- Resend (Βήμα 3) -------------------------------------------------------------
RESEND_API_KEY=
MAIL_FROM="Όνομα Καταστήματος <orders@domain.gr>"

# --- Stripe (Βήμα 4: πρώτα test, στο Βήμα 8 live) ---------------------------------
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# --- Προαιρετικά -------------------------------------------------------------------
# Σύνδεση με Google/Facebook (βλ. παραπάνω), π.χ. google,facebook
LOGIN_PROVIDERS=
```

## Πού μπαίνει κάθε στοιχείο του πελάτη

| Στοιχείο | Πού μπαίνει |
|---|---|
| Όνομα καταστήματος | admin → Στοιχεία καταστήματος (Βήμα 6) |
| Domain | Βήμα 1, `PUBLIC_URL` |
| Email καταστήματος | `ADMIN_EMAIL`, admin → Στοιχεία καταστήματος· ο πελάτης ανοίγει με αυτό το Stripe |
| Επωνυμία, ΑΦΜ, διεύθυνση | admin → Σελίδες → Βοήθεια → Όροι χρήσης (Βήμα 6) |
