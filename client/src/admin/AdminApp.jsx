import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Folder, Users, Ticket, Truck, FileText, MessageSquare, Settings as SettingsIcon,
  ExternalLink, LogOut, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { PageLoader } from '../components/ui.jsx';
import { AppearanceToggle } from '../components/Header.jsx';
import Dashboard from './Dashboard.jsx';
import { ProductList, ProductEdit } from './Products.jsx';
import Categories from './Categories.jsx';
import { OrderList, OrderDetail } from './Orders.jsx';
import Customers from './Customers.jsx';
import Coupons from './Coupons.jsx';
import Shipping from './Shipping.jsx';
import Pages from './Pages.jsx';
import Messages from './Messages.jsx';
import Settings from './Settings.jsx';

export default function AdminApp() {
  const { user, loading, logout } = useAuth();
  const { settings } = useShop();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  // Light polling so new orders/messages show up without refreshing.
  const counts = useFetch(user?.role === 'admin' ? '/admin/stats?days=7' : null);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    const id = setInterval(counts.reload, 60000);
    return () => clearInterval(id);
  }, [user, counts.reload]);
  useEffect(() => setNavOpen(false), [location.pathname]);
  useEffect(() => {
    document.title = `Admin | ${settings.storeName}`;
  }, [location.pathname, settings.storeName]);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const pending = counts.data?.statusCounts?.pending || 0;
  const unread = counts.data?.unreadMessages || 0;
  const nav = [
    ['/admin', LayoutDashboard, 'Dashboard', 0, true],
    ['/admin/orders', ShoppingCart, 'Orders', pending],
    ['/admin/products', Package, 'Products'],
    ['/admin/categories', Folder, 'Categories'],
    ['/admin/customers', Users, 'Customers'],
    ['/admin/coupons', Ticket, 'Coupons'],
    ['/admin/shipping', Truck, 'Shipping'],
    ['/admin/pages', FileText, 'Pages'],
    ['/admin/messages', MessageSquare, 'Messages', unread],
    ['/admin/settings', SettingsIcon, 'Settings'],
  ];

  return (
    <div className="admin">
      <aside className={`a-side ${navOpen ? 'open' : ''}`}>
        <div className="a-brand">
          <Link to="/admin">{settings.storeName}</Link>
          <button className="icon-btn only-mobile" onClick={() => setNavOpen(false)} aria-label={t('Close')}>
            <X size={20} />
          </button>
        </div>
        <nav className="a-nav">
          {nav.map(([to, Icon, label, badge, end]) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={18} />
              <span>{t(label)}</span>
              {badge > 0 && <span className="a-badge">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="a-side-foot">
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> {t('View shop')}
          </a>
          <button onClick={logout}>
            <LogOut size={16} /> {t('Sign out')}
          </button>
          <AppearanceToggle className="a-theme-toggle" />
        </div>
      </aside>
      <div className={`a-backdrop ${navOpen ? 'open' : ''}`} onClick={() => setNavOpen(false)} />
      <div className="a-main">
        <header className="a-top only-mobile">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label={t('Menu')}>
            <Menu size={22} />
          </button>
          <strong>{settings.storeName}</strong>
        </header>
        <div className="a-content">
          {settings.paymentMethods.length === 0 && (
            <Link to="/admin/settings/checkout" className="a-alert a-alert-danger">
              <ShoppingCart size={18} />{' '}
              {t('Customers cannot place orders: no payment method is available. Add the Stripe keys or enable cash on delivery.')} →
            </Link>
          )}
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<OrderList />} />
            <Route path="orders/:id" element={<OrderDetail onChange={counts.reload} />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/new" element={<ProductEdit />} />
            <Route path="products/:id" element={<ProductEdit />} />
            <Route path="categories" element={<Categories />} />
            <Route path="customers" element={<Customers />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="shipping" element={<Shipping />} />
            <Route path="pages" element={<Pages />} />
            <Route path="messages" element={<Messages onChange={counts.reload} />} />
            <Route path="settings/*" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
