import { db } from './db.js';

// Everything a shop owner can customise from the admin panel (or with
// `npm run configure`). New keys added here appear automatically in existing
// shops, because stored values are merged on top of these defaults.
export const DEFAULT_SETTINGS = {
  storeName: 'My Shop',
  tagline: 'Quality products, delivered fast',
  logoUrl: '',
  faviconUrl: '',
  language: 'el',
  // Show a Greek/English switch to visitors (UI texts only; products stay as written).
  languageSwitch: true,
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
    // 'auto' follows the visitor's device and shows a light/dark switch,
    // 'light' or 'dark' force one look.
    mode: 'auto',
    // Dark-mode colours. Empty values are derived from the light theme.
    dark: { primary: '', accent: '', background: '', surface: '', text: '' },
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
  // Card (Stripe) is the default; cash on delivery only if the shop wants it;
  // bank transfer is available but off unless turned on in the admin.
  payments: {
    card: { enabled: true },
    cod: { enabled: false, fee: 0 },
    bank: { enabled: false, details: '' },
  },
  login: {
    // Needs the provider enabled in the shop's Supabase project (see docs/NEW_CLIENT.md).
    google: false,
    apple: false,
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

// Settings are read on almost every request; cache them briefly per instance.
let cache = null;
const TTL_MS = 5000;

export async function getSettings() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await db().one("SELECT value FROM settings WHERE key = 'store'");
  const value = deepMerge(DEFAULT_SETTINGS, row?.value ?? {});
  cache = { value, at: Date.now() };
  return value;
}

export async function updateSettings(patch) {
  const next = deepMerge(await getSettings(), patch);
  await db().query(
    "INSERT INTO settings (key, value) VALUES ('store', $1) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [JSON.stringify(next)],
  );
  cache = { value: next, at: Date.now() };
  return next;
}

export function clearSettingsCache() {
  cache = null;
}
