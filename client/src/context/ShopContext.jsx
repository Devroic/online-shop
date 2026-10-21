import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { configureFormat } from '../lib/format.js';
import { LANGUAGES, setLanguage } from '../lib/i18n.js';
import { applyTheme, onSystemAppearanceChange, resolveAppearance, setAppearancePref } from '../lib/theme.js';

export { FONT_OPTIONS, applyTheme, contrastText } from '../lib/theme.js';

const ShopContext = createContext(null);
const LANG_KEY = 'shop.lang';

function storedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

/** The shop's language, or the visitor's choice when the switch is enabled. */
function resolveLanguage(settings, pref = storedLanguage()) {
  return settings.languageSwitch && LANGUAGES.includes(pref) ? pref : settings.language;
}

/** Money keeps the shop's currency; dates and number style follow the chosen language. */
function applyLanguage(settings, lang) {
  setLanguage(lang);
  const greekShop = settings.locale.startsWith('el');
  configureFormat({ currency: settings.currency, locale: lang === 'en' && greekShop ? 'en-IE' : lang === 'el' && !greekShop ? 'el-GR' : settings.locale });
}

export function ShopProvider({ children }) {
  const [state, setState] = useState({ settings: null, pages: [], categories: [], error: null });
  const [appearance, setAppearance] = useState('light');
  const [language, setLanguageState] = useState(null);

  const load = async () => {
    try {
      const [{ settings, pages }, categories] = await Promise.all([api.get('/settings'), api.get('/categories')]);
      const lang = resolveLanguage(settings);
      applyLanguage(settings, lang);
      setLanguageState(lang);
      const a = resolveAppearance(settings.theme.mode);
      applyTheme(settings.theme, a);
      setAppearance(a);
      if (settings.faviconUrl || settings.logoUrl) {
        document.querySelector('link[rel="icon"]')?.setAttribute('href', settings.faviconUrl || settings.logoUrl);
      }
      setState({ settings, pages, categories, error: null });
    } catch (error) {
      setState((s) => ({ ...s, error }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Follow the device when the visitor hasn't picked light/dark themselves.
  const theme = state.settings?.theme;
  useEffect(() => {
    if (!theme) return;
    return onSystemAppearanceChange(() => {
      const a = resolveAppearance(theme.mode);
      applyTheme(theme, a);
      setAppearance(a);
    });
  }, [theme]);

  const value = useMemo(
    () => ({
      ...state,
      reload: load,
      appearance,
      language,
      /** Visitor's Greek/English switch: UI texts change, the shop's content stays as written. */
      changeLanguage: (lang) => {
        try {
          localStorage.setItem(LANG_KEY, lang);
        } catch {
          /* storage blocked: choice lasts for this visit only */
        }
        applyLanguage(state.settings, lang);
        setLanguageState(lang);
      },
      /** Visitor's light/dark switch (only shown when the shop's mode is "auto"). */
      toggleAppearance: () => {
        const next = appearance === 'dark' ? 'light' : 'dark';
        setAppearancePref(next);
        applyTheme(state.settings.theme, next);
        setAppearance(next);
      },
    }),
    [state, appearance, language],
  );
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
