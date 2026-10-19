import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb, initDb } from './db.js';
import { ensureInitialData } from './scripts/bootstrap.js';

// Long-running server for local development (npm run dev / npm start). On Vercel the app is
// exported from /api/index.js instead.
await initDb();
await ensureInitialData();

const server = createApp().listen(config.port, () => {
  console.log(`Shop API listening on http://localhost:${config.port}`);
});

// Close the database cleanly on Ctrl+C / restart, so the local one isn't left half-written.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close();
    closeDb().finally(() => process.exit(0));
  });
}
