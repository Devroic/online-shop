import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { EmptyState, useTitle } from '../components/ui.jsx';
import { CartLine, FreeShippingBar } from '../components/CartDrawer.jsx';
import { useQuote } from '../components/useQuote.js';

export default function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const { quote, problemFor } = useQuote();
  useTitle(t('Cart'));

  if (!items.length) {
    return (
      <div className="container narrow">
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
    );
  }
  const hasProblems = quote?.problems.length > 0;

  return (
    <div className="container">
      <h1 className="page-title">{t('Your cart')}</h1>
      <div className="two-col">
        <div className="card">
          {items.map((l) => (
            <CartLine key={l.key} line={l} problem={problemFor(l.key)} onQuantity={(q) => setQuantity(l.key, q)} onRemove={() => remove(l.key)} />
          ))}
          <Link to="/products" className="link-arrow back">
            <ArrowLeft size={16} /> {t('Continue shopping')}
          </Link>
        </div>
        <aside className="card summary sticky">
          <FreeShippingBar quote={quote} />
          <div className="summary-row">
            <span>{t('Subtotal')}</span>
            <span>{money(quote?.subtotal ?? 0)}</span>
          </div>
          <div className="summary-row muted">
            <span>{t('Shipping')}</span>
            <span>{t('Calculated at checkout')}</span>
          </div>
          <div className="summary-row total">
            <span>{t('Total')}</span>
            <span>{money(quote?.subtotal ?? 0)}</span>
          </div>
          {hasProblems && <p className="line-problem">{t('Please fix the items marked above to continue.')}</p>}
          <Link to="/checkout" className={`btn btn-primary btn-lg btn-block ${hasProblems ? 'disabled' : ''}`} aria-disabled={hasProblems}>
            {t('Checkout')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
