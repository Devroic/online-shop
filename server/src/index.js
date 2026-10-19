import { createApp } from './app.js';
import { config } from './config.js';
import { initDb } from './db.js';
import { ensureInitialData } from './scripts/bootstrap.js';

// Long-running server (local development, Docker, VPS). On Vercel the app is
// exported from /api/index.js instead.
await initDb();
await ensureInitialData();

createApp().listen(config.port, () => {
  console.log(`Shop API listening on http://localhost:${config.port}`);
});
