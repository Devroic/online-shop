# Νέος πελάτης: τι κάνω βήμα-βήμα

Ξεκινάς όταν σου έρθει συμπληρωμένο το ερωτηματολόγιο (PDF) και το λογότυπο.
Στα παραδείγματα ο πελάτης λέγεται `margarita` και το domain του `margarita.gr`: βάλε τα δικά του.

Χρόνος: ~45 λεπτά την πρώτη φορά, ~20 λεπτά μετά.

---

## Βήμα 0. Προετοιμασία (στον υπολογιστή σου)

- Άνοιξε έναν φάκελο για τον πελάτη στον password manager σου. Εκεί κρατάς ό,τι κωδικό/κλειδί φτιάχνεις παρακάτω.
- Στο repository φτιάξε δύο αρχεία (**δεν** ανεβαίνουν στο git):
  - `.env.margarita`: αντέγραψε το [template του .env](#template-env) στο τέλος του οδηγού
  - `clients/margarita.json`: αντέγραψε το [template του JSON](#template-json) στο τέλος του οδηγού
- Συμπλήρωσε στο JSON ό,τι γράφει το ερωτηματολόγιο (όνομα, email, τηλέφωνο, αποστολές, αντικαταβολή).
- Βγάλε ένα τυχαίο κλειδί για το `JWT_SECRET` και έναν κωδικό για τον admin:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  node -e "console.log(require('crypto').randomBytes(9).toString('base64url'))"
  ```
  Βάλε το πρώτο στο `JWT_SECRET` του `.env.margarita` και το δεύτερο στο `admin.password` του JSON.

## Βήμα 1. Domain

- Αν ο πελάτης **έχει** domain: ζήτα του πρόσβαση στις ρυθμίσεις DNS (π.χ. λογαριασμός Papaki).
- Αν **όχι**: αγόρασέ το (π.χ. Papaki) στο όνομα του πελάτη.
- Στο `.env.margarita`: `PUBLIC_URL=https://margarita.gr`

## Βήμα 2. Supabase (βάση δεδομένων + φωτογραφίες)

- Πήγαινε στο https://supabase.com και κάνε εγγραφή με το email του πελάτη. Θα χρειαστείς τον κωδικό επιβεβαίωσης που θα του έρθει.
- Πάτα **New project**:
  - Name: `margarita`
  - Database password: πάτα **Generate** και κράτα τον στον password manager
  - Region: **Central EU (Frankfurt)**
- Περίμενε 1-2 λεπτά να ετοιμαστεί.
- Πάτα **Connect** (πάνω στη μέση). Αντέγραψε το **Transaction pooler** connection string (port **6543**):
  - Στο `.env.margarita` → `DATABASE_URL=` (βάλε τον κωδικό της βάσης στη θέση του `[YOUR-PASSWORD]`)
- Στο ίδιο παράθυρο αντέγραψε και το **Session pooler** string (port **5432**) στον password manager. Θα το χρειαστείς στο Βήμα 9 (backup).
- Πήγαινε **Project Settings → API**:
  - Project URL → `SUPABASE_URL=`
  - `anon` / publishable key → `SUPABASE_ANON_KEY=`
  - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY=` (**μυστικό**, μην το δώσεις πουθενά αλλού)

Τους πίνακες και τον φάκελο φωτογραφιών τα φτιάχνει μόνο του το Βήμα 5.

## Βήμα 3. Resend (email)

- Πήγαινε στο https://resend.com και κάνε εγγραφή με το email του πελάτη.
- **Domains → Add domain** → `margarita.gr`, Region: **Ireland (eu-west-1)**.
- Το Resend σου δείχνει 3-4 εγγραφές DNS. Πρόσθεσέ τες στο DNS του domain (Βήμα 1), ακριβώς όπως τις δείχνει.
- Περίμενε να γίνει **Verified** (συνήθως λίγα λεπτά, μερικές φορές μέχρι λίγες ώρες).
- **API Keys → Create API key** (Permission: Sending access) → `RESEND_API_KEY=`
- Στο `.env.margarita`: `MAIL_FROM="Ανθοπωλείο Μαργαρίτα <orders@margarita.gr>"`
  (το όνομα του καταστήματος + οποιαδήποτε διεύθυνση στο domain του)

## Βήμα 4. Stripe (πληρωμές με κάρτα)

- Πήγαινε στο https://stripe.com και κάνε εγγραφή με το email του πελάτη. Χώρα: **Ελλάδα**.
- Πάτα **Activate payments** και συμπλήρωσε από την ενότητα 5 του ερωτηματολογίου:
  - μορφή επιχείρησης, επωνυμία, ΑΦΜ, διεύθυνση, τι πουλάει
  - website: `https://margarita.gr`
  - υπεύθυνος: ονοματεπώνυμο, ημερομηνία γέννησης, κινητό, email
  - εταίροι άνω του 25% (αν είναι εταιρεία)
  - IBAN και δικαιούχος
  - statement descriptor: το «όνομα στην κίνηση της κάρτας»
- **Ταυτοποίηση** (φωτογραφία ταυτότητας ή selfie): την κάνει **ο ίδιος ο πελάτης**. Στείλε του να συνδεθεί στο Stripe και να την ολοκληρώσει, ή κάντε τη μαζί.
- Κλειδιά. Ξεκίνα σε **test mode** (διακόπτης «Test mode» πάνω δεξιά):
  - **Developers → API keys** → Secret key (`sk_test_…`) → `STRIPE_SECRET_KEY=`
  - **Developers → Webhooks → Add endpoint**:
    - Endpoint URL: `https://margarita.gr/api/stripe/webhook`
    - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`
    - Signing secret (`whsec_…`) → `STRIPE_WEBHOOK_SECRET=`

## Βήμα 5. Αρχική ρύθμιση καταστήματος (μία εντολή)

- Στον φάκελο του repository τρέξε:
  ```bash
  DOTENV_CONFIG_PATH=.env.margarita npm run configure -- clients/margarita.json
  ```
- Θα δεις ✔ για: πίνακες, φάκελο φωτογραφιών, ρυθμίσεις, admin, αποστολές, σελίδες.
- Αν κάτι βγάλει σφάλμα, διόρθωσέ το στο `.env.margarita` ή στο JSON και ξανατρέξ' το. Είναι ασφαλές να τρέξει πολλές φορές.

## Βήμα 6. Vercel (το site)

- Πήγαινε στο https://vercel.com (ο **δικός σου** λογαριασμός) → **Add New → Project**.
- Διάλεξε το repository `online-shop-template` και δώσε όνομα project `shop-margarita`.
- Άνοιξε **Environment Variables**. Αντέγραψε **όλο** το περιεχόμενο του `.env.margarita` και κάνε paste στο πρώτο πεδίο «Key». Το Vercel τα χωρίζει μόνο του.
- Πάτα **Deploy** και περίμενε ~1 λεπτό.
- Πήγαινε **Settings → Domains → Add** και πρόσθεσε `margarita.gr` και `www.margarita.gr`.
  - Το Vercel σου δείχνει τι εγγραφές DNS να βάλεις. Βάλε τες στο DNS του domain.
  - Όταν γίνουν ✓, το site ανοίγει στο `https://margarita.gr` (το HTTPS γίνεται αυτόματα).

## Βήμα 7. Τελευταίες ρυθμίσεις στο admin

- Άνοιξε `https://margarita.gr/admin` και συνδέσου με το email/κωδικό admin του JSON.
- **Ρυθμίσεις → Γενικά**: ανέβασε το λογότυπο που σου έστειλε.
- **Ρυθμίσεις → Εμφάνιση**: αν έδωσε χρώμα, διάλεξέ το (ή έναν έτοιμο συνδυασμό).
- **Σελίδες → Όροι χρήσης**: συμπλήρωσε επωνυμία, ΑΦΜ, διεύθυνση από το ερωτηματολόγιο.
- **Σελίδες → Σχετικά με εμάς**: ένα-δυο προτάσεις για το κατάστημα, ή άφησέ το στον πελάτη.

## Βήμα 8. Δοκιμή

- Βάλε ένα δοκιμαστικό προϊόν: **Προϊόντα → Νέο προϊόν**.
- Κάνε μια παραγγελία από κινητό με κάρτα δοκιμής `4242 4242 4242 4242` (οποιαδήποτε μελλοντική ημερομηνία, οποιοδήποτε CVC).
- Έλεγξε:
  - η παραγγελία φαίνεται «Πληρώθηκε» στο admin
  - ήρθε email στον πελάτη (δικό σου email) και στο email παραγγελιών (κοίτα και τα spam)
  - αν έχει αντικαταβολή, κάνε και μία παραγγελία με αντικαταβολή
- Σβήσε το δοκιμαστικό προϊόν και τις δοκιμαστικές παραγγελίες (ακύρωση).

## Βήμα 9. Ενεργοποίηση πραγματικών πληρωμών + backup

- Stripe: κλείσε το **Test mode** και ξανακάνε για **live**:
  - Developers → API keys → `sk_live_…`
  - Developers → Webhooks → Add endpoint (ίδιο URL, ίδια 3 events) → νέο `whsec_…`
- Vercel → project → **Settings → Environment Variables**: άλλαξε τα `STRIPE_SECRET_KEY` και `STRIPE_WEBHOOK_SECRET` με τα live.
- Vercel → **Deployments** → στο τελευταίο: **⋯ → Redeploy**, για να φορτώσουν τα νέα κλειδιά.
- Backup: GitHub → repository → **Settings → Secrets and variables → Actions → `BACKUP_DATABASE_URLS`** → Update:
  - πρόσθεσε μια γραμμή: `margarita <Session pooler string του Βήματος 2>`

## Βήμα 10. Παράδοση στον πελάτη

Στείλε του:
- το link του καταστήματος: `https://margarita.gr`
- το link της διαχείρισης: `https://margarita.gr/admin`
- το email και τον προσωρινό κωδικό admin. Πες του να τον αλλάξει από **Ο λογαριασμός μου → Προφίλ**.
- ότι τα προϊόντα τα ανεβάζει από **Προϊόντα**: ένα-ένα ή όλα μαζί με **Εισαγωγή από Excel**.

---

## Προαιρετικό: σύνδεση πελατών με Google

Κάν' το μόνο αν το θέλει ο πελάτης.

- Supabase → **Authentication → URL Configuration**:
  - Site URL: `https://margarita.gr`
  - Redirect URLs: πρόσθεσε `https://margarita.gr/auth/callback`
- Supabase → **Authentication → Providers → Google**: άνοιξέ το και αντέγραψε το **Callback URL** που δείχνει.
- https://console.cloud.google.com (ο δικός σου λογαριασμός Google):
  - φτιάξε νέο project `margarita`
  - **APIs & Services → OAuth consent screen**: όνομα καταστήματος, email, λογότυπο → **Publish**
  - **Credentials → Create credentials → OAuth client ID** → Web application → Authorized redirect URI: το Callback URL της Supabase
  - αντέγραψε **Client ID** και **Client secret** στη Supabase (Google provider) → Save
- Admin καταστήματος → **Ρυθμίσεις → Πληρωμές → Σύνδεση πελατών** → άνοιξε «Σύνδεση με Google» → Αποθήκευση.

---

<a id="template-env"></a>
## Template: `.env` πελάτη

Αντέγραψε το σε `.env.margarita` και συμπλήρωσε μόνο τις τιμές μετά το `=`.

```env
# --- Κατάστημα ---------------------------------------------------------------
PUBLIC_URL=https://
JWT_SECRET=

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

# --- Stripe (Βήμα 4: πρώτα test, στο Βήμα 9 live) ---------------------------------
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

<a id="template-json"></a>
## Template: `clients/<πελάτης>.json`

Ποσά σε **λεπτά**: `350` = 3,50 €. Ό,τι δεν ισχύει για τον πελάτη, σβήσ' το
(π.χ. όλη τη γραμμή της παραλαβής αν δεν την προσφέρει).

```json
{
  "settings": {
    "storeName": "Όνομα καταστήματος",
    "contact": {
      "email": "email@του-πελάτη.gr",
      "phone": "210 000 0000"
    },
    "notifications": { "orderEmail": "" },
    "payments": {
      "card": { "enabled": true },
      "cod": { "enabled": false, "fee": 0 }
    }
  },
  "shipping": [
    { "name": "Courier", "description": "Παράδοση σε 1-3 εργάσιμες", "price": 350, "freeOver": 5000 },
    { "name": "Παραλαβή από το κατάστημα", "description": "Διεύθυνση παραλαβής", "price": 0, "requiresAddress": false }
  ],
  "admin": { "email": "email@του-πελάτη.gr", "password": "" }
}
```

Πού μπαίνει κάθε απάντηση του ερωτηματολογίου:

| Ερωτηματολόγιο | JSON |
|---|---|
| Όνομα καταστήματος | `settings.storeName` |
| Email, τηλέφωνο | `settings.contact.email`, `settings.contact.phone` |
| Άλλο email για παραγγελίες | `settings.notifications.orderEmail` (κενό = το email επικοινωνίας) |
| Άλλο email για διαχείριση | `admin.email` (αλλιώς το email επικοινωνίας) |
| Courier + κόστος | γραμμή `Courier`, `price` |
| Δωρεάν αποστολή άνω των | `freeOver` στη γραμμή Courier (σβήσ' το αν δεν υπάρχει) |
| Παραλαβή + διεύθυνση | γραμμή `Παραλαβή…`, διεύθυνση στο `description` |
| Άλλος τρόπος | νέα γραμμή `{ "name": "ΕΛΤΑ", "price": 400 }` |
| Αντικαταβολή + χρέωση | `payments.cod.enabled: true`, `fee` |

Χρώμα, λογότυπο, κείμενα και σελίδες: από το admin (Βήμα 7).
