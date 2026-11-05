import { getLanguage } from './i18n.js';

// Countries a shop can ship to (ISO 3166-1 alpha-2): the EU plus nearby
// countries. Names come from the browser (Intl), in the current language.
// Keep in sync with server/src/countries.js.
export const COUNTRY_CODES = [
  'CY', 'GR', 'AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
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

/** Countries the active shipping methods deliver to (sent with the shop settings), first one by default. */
export const shippingCountries = (settings) => {
  const list = (settings?.deliveryCountries || []).filter((c) => COUNTRY_CODES.includes(c));
  return list.length ? list : ['CY'];
};

/** The shop's address with its country, e.g. "Ermou 10, Nicosia, Κύπρος"; '' without an address. */
export const shopAddress = (contact) =>
  contact?.address ? [contact.address, countryName(contact.country)].filter(Boolean).join(', ') : '';
