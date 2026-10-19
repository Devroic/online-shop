import el from './locales/el.js';

// Server-side texts (emails, default pages, demo data) are written in English;
// other languages map the English text to a translation, like the client does.
const dictionaries = { el: el.strings, en: {} };

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
