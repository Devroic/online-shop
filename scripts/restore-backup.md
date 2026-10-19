# Επαναφορά backup

1. GitHub → Actions → **Nightly backups** → επιλέξτε ημερομηνία → κατεβάστε το artifact και αποσυμπιέστε.
2. Βρείτε το αρχείο του πελάτη, π.χ. `margarita-2026-10-19.dump`.
3. Επαναφορά (σβήνει και ξαναγράφει τους πίνακες του καταστήματος):
   ```bash
   pg_restore --clean --if-exists --no-owner --dbname "<Session pooler connection string>" margarita-2026-10-19.dump
   ```
   Χρειάζεται PostgreSQL client 17 (`brew install libpq` ή `apt install postgresql-client-17`).
