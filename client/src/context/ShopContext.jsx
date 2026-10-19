import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { configureFormat } from '../lib/format.js';
import { setLanguage } from '../lib/i18n.js';

const ShopContext = createContext(null);

const FONTS = {
  Inter: 'Inter:wght@400;500;600;700',
  Manrope: 'Manrope:wght@400;500;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  Poppins: 'Poppins:wght@400;500;600;700',
  'Noto Sans': 'Noto+Sans:wght@400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@400;600;700',
  Lora: 'Lora:wght@400;500;600;700',
};
export const FONT_OPTIONS = Object.keys(FONTS);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Picks black or white text for a given background colour. */
export function contrastText(hex) {
  const [r, g, b] = hexToRgb(hex || '#000000');
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#ffffff';
}

/** Turns the store theme into CSS variables on <html>, so every component follows it. */
export function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--primary', theme.primary);
  root.setProperty('--primary-contrast', contrastText(theme.primary));
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-contrast', contrastText(theme.accent));
  root.setProperty('--bg', theme.background);
  root.setProperty('--surface', theme.surface);
  root.setProperty('--text', theme.text);
  root.setProperty('--radius', `${theme.radius}px`);
  root.setProperty('--font', `'${theme.font}', system-ui, -apple-system, 'Segoe UI', sans-serif`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);

  const family = FONTS[theme.font];
  let link = document.getElementById('theme-font');
  if (family) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'theme-font';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  }
}

export function ShopProvider({ children }) {
  const [state, setState] = useState({ settings: null, pages: [], categories: [], error: null });

  const load = async () => {
    try {
      const [{ settings, pages }, categories] = await Promise.all([api.get('/settings'), api.get('/categories')]);
      configureFormat(settings);
      setLanguage(settings.language);
      applyTheme(settings.theme);
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

  const value = useMemo(() => ({ ...state, reload: load }), [state]);
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export const useShop = () => useContext(ShopContext);
