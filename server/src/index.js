import { createApp } from './app.js';
import { config } from './config.js';
import { getDb } from './db.js';
import { ensureInitialData } from './scripts/bootstrap.js';

getDb();
await ensureInitialData();

createApp().listen(config.port, () => {
  console.log(`Shop API listening on http://localhost:${config.port}`);
});
