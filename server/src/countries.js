// Countries a shop can ship to (ISO 3166-1 alpha-2): the EU plus nearby
// countries. Names come from Intl, so they follow the language of the email.
// Keep in sync with client/src/lib/countries.js.
export const COUNTRY_CODES = [
  'CY', 'GR', 'AT', 'BE', 'BG', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO',
];

const names = new Map();

/** "Κύπρος" for ('CY', 'el'); the code itself if unknown; '' for no code. */
export function countryName(code, lang = 'el') {
  if (!code) return '';
  if (!names.has(lang)) names.set(lang, new Intl.DisplayNames([lang], { type: 'region' }));
  try {
    return names.get(lang).of(code) || code;
  } catch {
    return code;
  }
}
