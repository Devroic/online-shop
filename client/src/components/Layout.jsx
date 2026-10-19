import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import CartDrawer from './CartDrawer.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { t } from '../lib/i18n.js';

export default function Layout() {
  const { settings } = useShop();
  return (
    <div className="shop">
      <a href="#main" className="skip-link">
        {t('Skip to content')}
      </a>
      {settings.announcement && <div className="announcement">{settings.announcement}</div>}
      <Header />
      <main id="main" className="shop-main">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
