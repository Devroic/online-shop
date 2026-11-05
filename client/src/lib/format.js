// Amounts always use a decimal comma and a dot for thousands (1.234,50); the shop
// picks the currency and whether its symbol goes before or after. Same rules as
// formatMoney on the server (server/src/utils.js).
export const CURRENCY_SYMBOL = { EUR: '€', USD: '$', GBP: '£' };
const amountFmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let current = { locale: 'el-GR', currency: 'EUR', symbolBefore: false };

/** Dates follow the language (el → el-GR, en → en-GB); money follows the shop settings. */
export function configureFormat({ lang, currency, symbolBefore }) {
  current = { locale: lang === 'en' ? 'en-GB' : 'el-GR', currency: CURRENCY_SYMBOL[currency] ? currency : 'EUR', symbolBefore: !!symbolBefore };
}

export const currencySymbol = () => CURRENCY_SYMBOL[current.currency];

/** Prices are stored as integer cents everywhere: 123450 → "1.234,50 €" (or "€1.234,50"). */
export function money(cents) {
  const value = (cents || 0) / 100;
  const amount = amountFmt.format(Math.abs(value));
  const sign = value < 0 ? '-' : '';
  return current.symbolBefore ? `${sign}${currencySymbol()}${amount}` : `${sign}${amount}\u00a0${currencySymbol()}`; // non-breaking space
}

/** "12,50" or "12.5" → 1250; returns null for empty input. */
export function parseMoney(input) {
  if (input === '' || input == null) return null;
  const n = Number(String(input).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const centsToInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','));

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS".
// Plain "YYYY-MM-DD" days are local dates.
const toDate = (s) => {
  const str = String(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(`${str}T00:00:00`);
  return new Date(str.includes('T') ? str : `${str.replace(' ', 'T')}Z`);
};

export const date = (s) => toDate(s).toLocaleDateString(current.locale, { day: 'numeric', month: 'short', year: 'numeric' });
export const dateTime = (s) =>
  toDate(s).toLocaleString(current.locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const discountPercent = (price, compareAt) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
