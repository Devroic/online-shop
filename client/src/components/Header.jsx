import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Menu, Moon, Search, ShoppingBag, Sun, User, X } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { LANGUAGES, t } from '../lib/i18n.js';
import CategoryNav from './CategoryNav.jsx';

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

/**
 * A category in the phone menu. Its name goes to the whole category; the arrow next to it
 * opens its subcategories, already open when the current page is one of them.
 */
function MobileCategory({ category: c }) {
  const { pathname } = useLocation();
  const children = c.children || [];
  const [open, setOpen] = useState(() => children.some((s) => pathname === `/category/${s.slug}`));
  if (!children.length) return <NavLink to={`/category/${c.slug}`}>{c.name}</NavLink>;
  return (
    <div className="mobile-group">
      <div className="mobile-row">
        <NavLink to={`/category/${c.slug}`} end>
          {c.name}
        </NavLink>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t('Hide subcategories of {name}', { name: c.name }) : t('Show subcategories of {name}', { name: c.name })}
        >
          <ChevronDown size={18} className={`mobile-chevron ${open ? 'open' : ''}`} />
        </button>
      </div>
      {open &&
        children.map((s) => (
          <NavLink key={s.id} to={`/category/${s.slug}`} className="mobile-sub">
            {s.name}
          </NavLink>
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

  return (
    <header className="header">
      <div className="container header-inner">
        <button className="icon-btn only-mobile" onClick={() => setMenuOpen(true)} aria-label={t('Menu')}>
          <Menu size={22} />
        </button>
        <Logo />
        <CategoryNav categories={categories} />
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

      {/* Rendered into <body>: the header's blur (backdrop-filter) would otherwise make this
          full-height menu only as tall as the header. */}
      {createPortal(
        <>
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
            <MobileCategory key={c.id} category={c} />
          ))}
          <hr />
          <NavLink to={user ? '/account' : '/login'}>{user ? t('My account') : t('Sign in')}</NavLink>
          <NavLink to="/track">{t('Track order')}</NavLink>
          <NavLink to="/contact">{t('Contact')}</NavLink>
        </nav>
      </aside>
        </>,
        document.body,
      )}
    </header>
  );
}
