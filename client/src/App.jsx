import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useShop } from './context/ShopContext.jsx';
import { t } from './lib/i18n.js';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import ProductPage from './pages/ProductPage.jsx';
import CartPage from './pages/CartPage.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderPage from './pages/OrderPage.jsx';
import TrackOrder from './pages/TrackOrder.jsx';
import ContentPage from './pages/ContentPage.jsx';
import Contact from './pages/Contact.jsx';
import NotFound from './pages/NotFound.jsx';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/AuthPages.jsx';
import Account from './pages/Account.jsx';

// The admin panel is a separate bundle: shoppers never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  const { settings, error, reload } = useShop();

  if (!settings) {
    return error ? (
      <div className="fatal">
        <p>{t('The shop could not be loaded.')}</p>
        <button className="btn btn-primary" onClick={reload}>
          {t('Try again')}
        </button>
      </div>
    ) : (
      <PageLoader />
    );
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Catalog />} />
          <Route path="category/:slug" element={<Catalog />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:number" element={<OrderPage />} />
          <Route path="track" element={<TrackOrder />} />
          <Route path="p/:slug" element={<ContentPage />} />
          <Route path="contact" element={<Contact />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="account/forgot" element={<ForgotPassword />} />
          <Route path="account/reset" element={<ResetPassword />} />
          <Route path="account/*" element={<Account />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
