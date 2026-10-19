# Restoring a backup

1. GitHub → Actions → **Nightly backups** → pick a date → download the artifact and unzip it.
2. Find the client's file, e.g. `margarita-2026-10-19.dump`.
3. Restore (drops and recreates the shop's tables):
   ```bash
   pg_restore --clean --if-exists --no-owner --dbname "<Session pooler connection string>" margarita-2026-10-19.dump
   ```
   Requires the PostgreSQL 17 client (`brew install libpq` or `apt install postgresql-client-17`).
