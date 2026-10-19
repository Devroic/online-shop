import { getDb } from './db.js';

// Everything a shop owner can customise from the admin panel (or with
// `npm run configure`). New keys added here appear automatically in existing
// shops, because stored values are merged on top of these defaults.
export const DEFAULT_SETTINGS = {
  storeName: 'My Shop',
  tagline: 'Quality products, delivered fast',
  logoUrl: '',
  faviconUrl: '',
  language: 'el',
  currency: 'EUR',
  locale: 'el-GR',
  theme: {
    primary: '#111827',
    accent: '#2563eb',
    background: '#ffffff',
    surface: '#f6f7f9',
    text: '#111827',
    radius: 12,
    font: 'Inter',
  },
  announcement: '',
  hero: {
    title: 'New collection is here',
    subtitle: 'Discover our latest products, picked with care.',
    imageUrl: '',
    ctaText: 'Shop now',
    ctaLink: '/products',
  },
  contact: {
    email: '',
    phone: '',
    address: '',
    hours: '',
  },
  social: {
    facebook: '',
    instagram: '',
    tiktok: '',
  },
  payments: {
    cod: { enabled: true, fee: 0 },
    bank: { enabled: true, details: '' },
    card: { enabled: false },
  },
  checkout: {
    requirePhone: true,
    allowGuest: true,
    pricesIncludeTax: true,
    termsPage: 'terms',
  },
  inventory: {
    lowStockThreshold: 5,
    hideOutOfStock: false,
  },
  notifications: {
    orderEmail: '',
  },
  seo: {
    title: '',
    description: '',
  },
  orderPrefix: '',
};

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(base, patch) {
  if (!isObject(base) || !isObject(patch)) return patch === undefined ? base : patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function getSettings() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'store'").get();
  return deepMerge(DEFAULT_SETTINGS, row ? JSON.parse(row.value) : {});
}

export function updateSettings(patch) {
  const next = deepMerge(getSettings(), patch);
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES ('store', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(next));
  return next;
}
