let current = { locale: 'el-GR', currency: 'EUR' };
let moneyFmt = new Intl.NumberFormat(current.locale, { style: 'currency', currency: current.currency });

export function configureFormat({ locale, currency }) {
  current = { locale: locale || 'el-GR', currency: currency || 'EUR' };
  moneyFmt = new Intl.NumberFormat(current.locale, { style: 'currency', currency: current.currency });
}

/** Prices are stored as integer cents everywhere. */
export const money = (cents) => moneyFmt.format((cents || 0) / 100);

/** "12,50" or "12.5" → 1250; returns null for empty input. */
export function parseMoney(input) {
  if (input === '' || input == null) return null;
  const n = Number(String(input).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const centsToInput = (cents) => (cents == null ? '' : (cents / 100).toFixed(2));

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
