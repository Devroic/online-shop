import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useCart } from '../context/CartContext.jsx';

/**
 * Asks the server to price the current cart (debounced). Keeps the local
 * snapshot in sync with real prices and reports stock problems.
 */
export function useQuote({ couponCode, shippingMethodId, paymentMethod, enabled = true } = {}) {
  const { payload, items, syncFromQuote } = useCart();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const body = JSON.stringify({ items: payload, couponCode: couponCode || undefined, shippingMethodId, paymentMethod });
  const seq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!items.length) {
      setQuote(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = await api.post('/cart/quote', JSON.parse(body));
        if (id !== seq.current) return;
        setQuote(q);
        syncFromQuote(q);
      } catch {
        /* keep last quote; checkout re-validates anyway */
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, enabled]);

  const problemFor = (key) => quote?.problems.find((p) => p.key === key);
  return { quote, loading, problemFor };
}

export function problemText(problem, t) {
  if (!problem) return null;
  switch (problem.code) {
    case 'unavailable':
      return t('This product is no longer available');
    case 'out_of_stock':
      return t('Out of stock');
    case 'insufficient_stock':
      return t('Only {n} left in stock', { n: problem.available });
    case 'variant_required':
      return t('Please choose an option');
    default:
      return t('Please check this item');
  }
}
