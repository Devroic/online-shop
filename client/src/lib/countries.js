import { getLanguage } from './i18n.js';

// Countries a shop can ship to (ISO 3166-1 alpha-2): every inhabited country and
// territory, Cyprus and Greece first. Names come from the browser (Intl), in the
// current language. Keep in sync with server/src/countries.js.
export const COUNTRY_CODES = [
  'CY', 'GR', 'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AR', 'AS', 'AT', 'AU', 'AW',
  'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO',
  'BQ', 'BR', 'BS', 'BT', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK',
  'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO',
  'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA',
  'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GT', 'GU', 'GW',
  'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS',
  'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY',
  'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD',
  'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU',
  'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR',
  'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT',
  'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH',
  'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC',
  'TD', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA',
  'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'XK', 'YE',
  'YT', 'ZA', 'ZM', 'ZW',
];

const names = new Map();

/** "Κύπρος" for 'CY' in Greek; the code itself if unknown; '' for no code. */
export function countryName(code) {
  if (!code) return '';
  const lang = getLanguage();
  if (!names.has(lang)) names.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
  try {
    return names.get(lang).of(code) || code;
  } catch {
    return code;
  }
}

/** Codes sorted by their name in the current language. */
export const sortedCountries = (codes = COUNTRY_CODES) =>
  [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b), getLanguage()));

/** For a country list: the first stays first (the shop's own, preselected), the rest by name. */
export const deliveryOrder = (codes) => (codes.length > 1 ? [codes[0], ...sortedCountries(codes.slice(1))] : codes);

/** Countries the active shipping methods deliver to (sent with the shop settings), first one by default. */
export const shippingCountries = (settings) => {
  const list = (settings?.deliveryCountries || []).filter((c) => COUNTRY_CODES.includes(c));
  return list.length ? deliveryOrder(list) : ['CY'];
};

// The country last chosen at checkout, so the cart and the next checkout start on it.
const COUNTRY_KEY = 'shop.country';

/** Remembers the delivery country chosen at checkout (nothing is lost if storage is blocked). */
export function rememberCountry(code) {
  try {
    localStorage.setItem(COUNTRY_KEY, code);
  } catch {
    /* private mode: the shop's first country is used next time */
  }
}

/**
 * The customer's delivery country before checkout: the signed-in customer's saved
 * address, else the one they chose at a previous checkout, else the country they are
 * visiting from (settings.visitorCountry); only a country the shop delivers to.
 * null: not known (the cart then shows the shop's first country).
 */
export function customerCountry(user, settings) {
  const served = shippingCountries(settings);
  let saved = null;
  try {
    saved = localStorage.getItem(COUNTRY_KEY);
  } catch {
    /* storage blocked */
  }
  return [user?.address?.country, saved, settings?.visitorCountry].find((c) => c && served.includes(c)) || null;
}

/** The shop's address on one line, e.g. "Ermou 10, Akaki, 2728 Nicosia, Κύπρος"; '' when it has none. Same as the server's. */
export function shopAddress(contact) {
  if (!contact) return '';
  const town = [contact.postalCode, contact.city].filter(Boolean).join(' ');
  const parts = [contact.address, contact.region, town].filter(Boolean);
  return parts.length ? [...parts, countryName(contact.country)].filter(Boolean).join(', ') : '';
}
