import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { t } from '../lib/i18n.js';

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
          <button className="icon-btn" onClick={() => setMenuOpen(false)} aria-label={t('Close')}>
            <X size={22} />
          </button>
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
