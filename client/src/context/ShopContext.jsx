import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { configureFormat } from '../lib/format.js';
import { setLanguage } from '../lib/i18n.js';
import { applyTheme, onSystemAppearanceChange, resolveAppearance, setAppearancePref } from '../lib/theme.js';

export { FONT_OPTIONS, applyTheme, contrastText } from '../lib/theme.js';

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [state, setState] = useState({ settings: null, pages: [], categories: [], error: null });
  const [appearance, setAppearance] = useState('light');

  const load = async () => {
    try {
      const [{ settings, pages }, categories] = await Promise.all([api.get('/settings'), api.get('/categories')]);
      configureFormat(settings);
      setLanguage(settings.language);
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
      /** Visitor's light/dark switch (only shown when the shop's mode is "auto"). */
      toggleAppearance: () => {
        const next = appearance === 'dark' ? 'light' : 'dark';
        setAppearancePref(next);
        applyTheme(state.settings.theme, next);
        setAppearance(next);
      },
    }),
    [state, appearance],
  );
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
