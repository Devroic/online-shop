import el from './locales/el.js';

// Server-side texts (emails, default pages, demo data) are written in English;
// other languages map the English text to a translation, like the client does.
const dictionaries = { el: el.strings, en: {} };

export const LANGUAGES = ['el', 'en'];

/** The visitor's UI language (sent by the client as X-Shop-Lang), or the shop's default. */
export function requestLanguage(req, settings) {
  const lang = req.get('x-shop-lang');
  return LANGUAGES.includes(lang) ? lang : settings.language;
}

/** Returns t(text, vars) for a language; missing entries fall back to English. */
export function translator(lang) {
  const dict = dictionaries[lang] || {};
  return (text, vars) => {
    let out = dict[text] ?? text;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
    return out;
  };
}

/** Language-specific transliteration for URL slugs (e.g. Greek letters → Latin). */
export function transliterate(text) {
  return el.transliterate(text);
}
