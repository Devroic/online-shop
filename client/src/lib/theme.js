// Turns the shop's colours into CSS variables, for light and dark appearance.
// Dark colours can be set in the admin; any left empty are derived from the
// light theme so every shop gets a usable dark mode for free.

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

const PREF_KEY = 'shop.appearance.pref'; // 'light' | 'dark' | null (follow device)
const RESOLVED_KEY = 'shop.appearance'; // last applied, read by /theme-init.js to avoid a flash

const toRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => toHex(toRgb(a).map((v, i) => v + (toRgb(b)[i] - v) * t));

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Black or white text, whichever reads better on `hex`. */
export const contrastText = (hex) => (contrast(hex, '#111111') >= contrast(hex, '#ffffff') ? '#111111' : '#ffffff');

/** 0 for greys/near-black, up to 1 for vivid colours. */
function chroma(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function toHsl(hex) {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl([h, s, l]) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return toHex([f(0), f(8), f(4)]);
}

/** Raises lightness (keeping the hue) until the colour stands out on a dark background. */
function readableOn(hex, bg, min = 4.5) {
  const [h, s, l] = toHsl(hex);
  let c = hex;
  for (let L = l; contrast(c, bg) < min && L < 0.95; L += 0.03) c = fromHsl([h, Math.min(s, 0.75), L]);
  return c;
}

export function darkPalette(theme) {
  const d = theme.dark || {};
  const background = d.background || '#0f1115';
  return {
    background,
    surface: d.surface || '#181b21',
    text: d.text || '#e8eaee',
    // Near-black/grey brand colours become near-white buttons; vivid ones keep their hue.
    primary: d.primary || (chroma(theme.primary) < 0.15 ? mix(theme.primary, '#ffffff', 0.9) : readableOn(theme.primary, background, 4.5)),
    accent: d.accent || readableOn(theme.accent, background),
  };
}

export function getAppearancePref() {
  try {
    return localStorage.getItem(PREF_KEY);
  } catch {
    return null;
  }
}

export function setAppearancePref(pref) {
  try {
    if (pref) localStorage.setItem(PREF_KEY, pref);
    else localStorage.removeItem(PREF_KEY);
  } catch {
    /* storage blocked: preference lasts for this visit only */
  }
}

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** 'light' or 'dark', from the shop's mode, the visitor's choice and the device. */
export function resolveAppearance(mode, pref = getAppearancePref()) {
  if (mode === 'light' || mode === 'dark') return mode;
  if (pref === 'light' || pref === 'dark') return pref;
  return systemDark() ? 'dark' : 'light';
}

export function applyTheme(theme, appearance = 'light') {
  const colors = appearance === 'dark' ? darkPalette(theme) : theme;
  const root = document.documentElement;
  const s = root.style;
  root.dataset.theme = appearance;
  s.setProperty('--primary', colors.primary);
  s.setProperty('--primary-contrast', contrastText(colors.primary));
  s.setProperty('--accent', colors.accent);
  s.setProperty('--accent-contrast', contrastText(colors.accent));
  s.setProperty('--bg', colors.background);
  s.setProperty('--surface', colors.surface);
  s.setProperty('--text', colors.text);
  s.setProperty('--radius', `${theme.radius}px`);
  s.setProperty('--font', `'${theme.font}', system-ui, -apple-system, 'Segoe UI', sans-serif`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.background);
  try {
    localStorage.setItem(RESOLVED_KEY, appearance);
  } catch {
    /* ignore */
  }

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

/** Calls `cb` when the device switches between light and dark. */
export function onSystemAppearanceChange(cb) {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  mq?.addEventListener?.('change', cb);
  return () => mq?.removeEventListener?.('change', cb);
}
