import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { cleanPageView } from './lib/analytics.js';
import App from './App.jsx';
import { ShopProvider } from './context/ShopContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles/base.css';
import './styles/shop.css';
import './styles/admin.css';

function Root() {
  return (
    <ShopProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider>
            <App />
            {/* Page views for Vercel Web Analytics (only on Vercel; logged to the console locally). */}
            <Analytics beforeSend={cleanPageView} />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </ShopProvider>
  );
}

// A data router (rather than <BrowserRouter>) so pages can warn about unsaved changes
// (useBlocker). The routes themselves stay in App.jsx.
const router = createBrowserRouter([{ path: '*', element: <Root /> }]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
