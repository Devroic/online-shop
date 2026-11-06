import { db } from './db.js';
import { translator } from './i18n.js';

// Everything a shop owner can customise from the admin panel (or with
// `npm run configure`). New keys added here appear automatically in existing
// shops, because stored values are merged on top of these defaults.
export const DEFAULT_SETTINGS = {
  storeName: 'My Shop',
  tagline: 'Quality products, delivered fast',
  logoUrl: '',
  faviconUrl: '',
  language: 'el',
  // Greek/English switch for visitors (UI texts only; products stay as written).
  // Off by default: turn it on in Store details for shops that want it.
  languageSwitch: false,
  // Only EUR, USD or GBP. Amounts are always written 1.234,50; this moves the symbol: "€1.234,50" vs "1.234,50 €".
  currency: 'EUR',
  currencySymbolBefore: false,
  theme: {
    primary: '#111827',
    accent: '#2563eb',
    background: '#ffffff',
    surface: '#f6f7f9',
    text: '#111827',
    radius: 12,
    font: 'Inter',
    // 'light' (the default) or 'dark' force one look; 'auto' follows the
    // visitor's device and shows a light/dark switch.
    mode: 'light',
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
  // The four boxes under the banner on the home page. Empty title/text show the
  // default wording in the visitor's language; the delivery text then comes from
  // the courier's description, the help text from the shop's phone or email.
  perks: {
    delivery: { show: true, title: '', text: '' },
    secure: { show: true, title: '', text: '' },
    returns: { show: true, title: '', text: '' },
    help: { show: true, title: '', text: '' },
  },
  contact: {
    email: '',
    phone: '',
    // The shop's address, in the same parts as a customer's: country (ISO code), city,
    // area, postal code and street ("address", kept from when it was one field).
    country: 'CY',
    city: '',
    region: '',
    postalCode: '',
    address: '',
    hours: '',
  },
  social: {
    facebook: '',
    instagram: '',
    tiktok: '',
  },
  // Card (Stripe) is on by default. Cash (on delivery / at the store) is set per
  // shipping method, in Admin → Shipping.
  payments: {
    card: { enabled: true },
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

/**
 * The defaults with their texts (store name, tagline, home banner) in the shop's
 * language, so a new Greek shop does not start with English wording. What the owner
 * saved always wins over these.
 */
export function defaultSettings(lang = DEFAULT_SETTINGS.language) {
  const t = translator(lang);
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    storeName: t(d.storeName),
    tagline: t(d.tagline),
    hero: { ...d.hero, title: t(d.hero.title), subtitle: t(d.hero.subtitle), ctaText: t(d.hero.ctaText) },
  };
}

export async function getSettings() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await db().one("SELECT value FROM settings WHERE key = 'store'");
  const stored = row?.value ?? {};
  const value = deepMerge(defaultSettings(stored.language), stored);
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
