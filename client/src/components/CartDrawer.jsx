import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Trash2, X, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { money } from '../lib/format.js';
import { countryName, customerCountry } from '../lib/countries.js';
import { useAuth } from '../context/AuthContext.jsx';
import { t, tx } from '../lib/i18n.js';
import { EmptyState, QuantityStepper } from './ui.jsx';
import { problemText, useQuote } from './useQuote.js';

/** The cart's quote, priced for the customer's country when it is known (see customerCountry). */
export function useCartQuote(opts = {}) {
  const { user } = useAuth();
  const { settings } = useShop();
  const country = customerCountry(user, settings);
  return { country, ...useQuote({ ...opts, country: country || undefined }) };
}

/**
 * Progress towards the cheapest free-shipping threshold, if any, for `country` (the
 * customer's, when known; otherwise the shop's first country). When the shop delivers
 * to several countries the bar names the country, since others may differ.
 */
export function FreeShippingBar({ quote, subtotal, country }) {
  const { settings } = useShop();
  // A method that does not deliver to the customer's country is priced for its own first
  // country by the server: it says nothing about this customer.
  const offers = quote?.shippingOptions.filter((m) => m.freeOver != null && m.requiresAddress && (!country || m.country === country)) ?? [];
  if (!offers.length) return null;
  const best = offers.reduce((a, b) => (b.freeOver < a.freeOver ? b : a));
  const target = best.freeOver;
  const current = (subtotal ?? quote.subtotal) - quote.discount;
  const left = target - current;
  const place = (settings.deliveryCountries?.length ?? 0) > 1 && best.country ? countryName(best.country) : null;
  let text;
  if (place) {
    text = left > 0
      ? tx('{country}: add {amount} more for free shipping', { country: place, amount: <b>{money(left)}</b> })
      : t('{country}: you get free shipping!', { country: place });
  } else {
    text = left > 0 ? tx('Add {amount} more for free shipping', { amount: <b>{money(left)}</b> }) : t('You get free shipping!');
  }
  return (
    <div className="free-ship">
      <div className="free-ship-text">
        <Truck size={16} />
        <span>{text}</span>
      </div>
      <div className="free-ship-track">
        <div style={{ width: `${Math.min(100, (current / target) * 100)}%` }} />
      </div>
    </div>
  );
}

export function CartLine({ line, problem, onQuantity, onRemove }) {
  return (
    <div className={`cart-line ${problem ? 'has-problem' : ''}`}>
      <Link to={`/product/${line.slug}`} className="cart-line-img">
        {line.image ? <img src={line.image} alt="" /> : <div className="img-placeholder" />}
      </Link>
      <div className="cart-line-info">
        <Link to={`/product/${line.slug}`} className="cart-line-name">
          {line.name}
        </Link>
        {line.variantName && <div className="muted small">{line.variantName}</div>}
        <div className="cart-line-price">{money(line.price)}</div>
        {problem && <div className="line-problem">{problemText(problem, t)}</div>}
      </div>
      <div className="cart-line-total">{money(line.price * line.quantity)}</div>
      <div className="cart-line-actions">
        <QuantityStepper size="sm" value={line.quantity} onChange={onQuantity} max={problem?.available ?? line.max ?? undefined} />
        <button className="link-btn muted" onClick={onRemove} aria-label={t('Remove')}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function CartDrawer() {
  const { items, drawerOpen, closeDrawer, setQuantity, remove, subtotal } = useCart();
  const { quote, problemFor, country } = useCartQuote({ enabled: drawerOpen });
  const location = useLocation();

  useEffect(() => {
    closeDrawer();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.classList.toggle('no-scroll', drawerOpen);
    const onKey = (e) => e.key === 'Escape' && closeDrawer();
    if (drawerOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  const hasProblems = quote?.problems.length > 0;

  return (
    <>
      <div className={`sheet-backdrop ${drawerOpen ? 'open' : ''}`} onClick={closeDrawer} />
      <aside className={`sheet sheet-right cart-drawer ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen} aria-label={t('Cart')}>
        <div className="sheet-head">
          <h2>
            {t('Your cart')} {items.length > 0 && <span className="muted">({items.reduce((n, l) => n + l.quantity, 0)})</span>}
          </h2>
          <button className="icon-btn" onClick={closeDrawer} aria-label={t('Close')}>
            <X size={22} />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="sheet-body">
            <EmptyState
              icon={ShoppingBag}
              title={t('Your cart is empty')}
              text={t('Browse our products and find something you love.')}
              action={
                <Link to="/products" className="btn btn-primary">
                  {t('Start shopping')}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <FreeShippingBar quote={quote} subtotal={subtotal} country={country} />
            <div className="sheet-body">
              {items.map((l) => (
                <CartLine key={l.key} line={l} problem={problemFor(l.key)} onQuantity={(q) => setQuantity(l.key, q)} onRemove={() => remove(l.key)} />
              ))}
            </div>
            <div className="sheet-foot">
              <div className="summary-row total">
                <span>{t('Subtotal')}</span>
                <span>{money(subtotal)}</span>
              </div>
              <p className="muted small">{t('Shipping and discounts are calculated at checkout.')}</p>
              <Link to="/checkout" className={`btn btn-primary btn-lg btn-block ${hasProblems ? 'disabled' : ''}`} aria-disabled={hasProblems}>
                {t('Checkout')}
              </Link>
              <Link to="/cart" className="btn btn-ghost btn-block">
                {t('View cart')}
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
