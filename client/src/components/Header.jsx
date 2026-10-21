import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Moon, Search, ShoppingBag, Sun, User, X } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LANGUAGES, t } from '../lib/i18n.js';

export function Logo() {
  const { settings } = useShop();
  return (
    <Link to="/" className="logo" aria-label={settings.storeName}>
      {settings.logoUrl ? <img src={settings.logoUrl} alt={settings.storeName} /> : <span>{settings.storeName}</span>}
    </Link>
  );
}

function SearchBox({ autoFocus, onDone }) {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const navigate = useNavigate();
  return (
    <form
      noValidate
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : '/products');
        onDone?.();
      }}
    >
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('Search products…')}
        aria-label={t('Search products…')}
        autoFocus={autoFocus}
      />
    </form>
  );
}

export function AppearanceToggle({ className = '' }) {
  const { settings, appearance, toggleAppearance } = useShop();
  if (settings.theme.mode !== 'auto') return null;
  const dark = appearance === 'dark';
  return (
    <button className={`icon-btn ${className}`} onClick={toggleAppearance} aria-label={dark ? t('Light mode') : t('Dark mode')} title={dark ? t('Light mode') : t('Dark mode')}>
      {dark ? <Sun size={21} /> : <Moon size={21} />}
    </button>
  );
}

/** A language's own name ("English", and the Greek name for "el"), from the browser. */
const languageName = (code) => {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code);
  } catch {
    return code;
  }
};

/** EL | EN switch; hidden when the shop turns it off. */
export function LanguageSwitch({ className = '' }) {
  const { settings, language, changeLanguage } = useShop();
  if (!settings.languageSwitch) return null;
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t('Language')}>
      {LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          className={language === code ? 'active' : ''}
          aria-pressed={language === code}
          lang={code}
          title={languageName(code)}
          onClick={() => changeLanguage(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function Header() {
  const { categories } = useShop();
  const { count, openDrawer } = useCart();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const [bump, setBump] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // Small "bump" animation on the cart icon when something is added.
  useEffect(() => {
    const grew = count > prevCount.current;
    prevCount.current = count;
    if (!grew) return;
    setBump(true);
    const id = setTimeout(() => setBump(false), 400);
    return () => clearTimeout(id);
  }, [count]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', menuOpen);
  }, [menuOpen]);

  const navCats = categories.slice(0, 6);

  return (
    <header className="header">
      <div className="container header-inner">
        <button className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label={t('Menu')}>
          <Menu size={22} />
        </button>
        <Logo />
        <nav className="main-nav only-desktop" aria-label={t('Categories')}>
          <NavLink to="/products" end>
            {t('All products')}
          </NavLink>
          {navCats.map((c) => (
            <NavLink key={c.id} to={`/category/${c.slug}`}>
              {c.name}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <div className="only-desktop header-search">
            <SearchBox />
          </div>
          <button className="icon-btn only-mobile" onClick={() => setSearchOpen((v) => !v)} aria-label={t('Search')}>
            {searchOpen ? <X size={22} /> : <Search size={22} />}
          </button>
          <LanguageSwitch className="only-desktop" />
          <AppearanceToggle className="only-desktop" />
          <Link to={user ? '/account' : '/login'} className="icon-btn" aria-label={t('Account')}>
            <User size={22} />
          </Link>
          <button className={`icon-btn cart-btn ${bump ? 'bump' : ''}`} onClick={openDrawer} aria-label={`${t('Cart')} (${count})`}>
            <ShoppingBag size={22} />
            {count > 0 && <span className="cart-count">{count > 99 ? '99+' : count}</span>}
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="container mobile-search only-mobile">
          <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      )}

      <div className={`sheet-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sheet sheet-left ${menuOpen ? 'open' : ''}`} aria-hidden={!menuOpen} aria-label={t('Menu')}>
        <div className="sheet-head">
          <Logo />
          <div className="row-gap">
            <LanguageSwitch />
            <AppearanceToggle />
            <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label={t('Close')}>
              <X size={22} />
            </button>
          </div>
        </div>
        <nav className="mobile-nav">
          <NavLink to="/products" end>
            {t('All products')}
          </NavLink>
          {categories.map((c) => (
            <NavLink key={c.id} to={`/category/${c.slug}`}>
              {c.name}
            </NavLink>
          ))}
          <hr />
          <NavLink to={user ? '/account' : '/login'}>{user ? t('My account') : t('Sign in')}</NavLink>
          <NavLink to="/track">{t('Track order')}</NavLink>
          <NavLink to="/contact">{t('Contact')}</NavLink>
        </nav>
      </aside>
    </header>
  );
}
