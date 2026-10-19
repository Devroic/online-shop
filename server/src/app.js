import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { loadUser } from './auth.js';
import { HttpError } from './utils.js';
import publicRoutes from './routes/public.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import stripeRoutes from './routes/stripe.js';
import { getSettings } from './settings.js';
import { initDb } from './db.js';
import { ensureInitialData } from './scripts/bootstrap.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          // Supabase Auth (Google/Apple sign-in) is called from the browser.
          connectSrc: ["'self'", 'https://*.supabase.co'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          scriptSrc: ["'self'"],
          frameSrc: ["'self'", 'https://www.google.com', 'https://maps.google.com'],
          formAction: ["'self'", 'https://checkout.stripe.com'],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Connect + migrate on the first request of each (serverless) instance.
  let booted;
  app.use(async (_req, _res, next) => {
    try {
      booted ??= initDb().then(ensureInitialData);
      await booted;
      next();
    } catch (err) {
      booted = undefined;
      next(err);
    }
  });

  app.use('/api/stripe', stripeRoutes);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', publicRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  app.use(
    '/uploads',
    express.static(config.uploadsDir, {
      maxAge: '30d',
      immutable: true,
      setHeaders: (res, file) => {
        if (file.endsWith('.svg')) res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      },
    }),
  );

  // In production the API also serves the built React app.
  if (fs.existsSync(config.clientDist)) {
    const indexFile = path.join(config.clientDist, 'index.html');
    const indexHtml = fs.readFileSync(indexFile, 'utf8');
    app.use(express.static(config.clientDist, { index: false, maxAge: '1y', immutable: true }));
    app.get('/{*splat}', async (_req, res) => {
      // Inject title/description so link previews show the shop's name.
      const s = await getSettings();
      const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
      const html = indexHtml
        .replace(/<title>.*?<\/title>/, `<title>${esc(s.seo.title || s.storeName)}</title>`)
        .replace('<meta name="description" content="">', `<meta name="description" content="${esc(s.seo.description || s.tagline)}">`)
        .replace('<html lang="el">', `<html lang="${esc(s.language)}">`);
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(html);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large' });
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 && config.isProd ? 'Something went wrong' : err.message,
      details: err.details,
    });
  });

  return app;
}
