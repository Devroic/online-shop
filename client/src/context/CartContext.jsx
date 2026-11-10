import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { api } from '../lib/api.js';

const CartContext = createContext(null);
const KEY = 'shop.cart.v1';

function read() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export const lineKey = (productId, variantId) => `${productId}:${variantId ?? ''}`;

// A card order leaves the site for Stripe before the cart can be emptied. Its number and
// link token are kept in localStorage (closing the tab does not lose them) until it is
// paid, which empties the cart, or given up, which cancels it so it frees its stock.
const CARD_ORDER_KEY = 'shop.cardOrder.v2';

export function rememberCardOrder(order) {
  try {
    localStorage.setItem(CARD_ORDER_KEY, JSON.stringify({ number: String(order.number), token: order.accessToken }));
  } catch {
    /* storage blocked: the cart simply stays */
  }
}

/** This browser's card order that has not come back paid yet: { number, token } or null. */
export function pendingCardOrder() {
  try {
    const o = JSON.parse(localStorage.getItem(CARD_ORDER_KEY) || 'null');
    return o?.number && o?.token ? o : null;
  } catch {
    return null;
  }
}

export function forgetCardOrder() {
  try {
    localStorage.removeItem(CARD_ORDER_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** True once per remembered card order, when it comes back paid. */
export function takePaidCardOrder(number) {
  const o = pendingCardOrder();
  if (!o || o.number !== String(number)) return false;
  forgetCardOrder();
  return true;
}

/**
 * The cart lives in localStorage so it survives reloads and works for guests.
 * Lines keep a snapshot (name, price, image) for instant rendering; real
 * prices and stock are always re-checked by the server (`/cart/quote`).
 */
export function CartProvider({ children }) {
  const [items, setItems] = useState(read);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage full or blocked: cart still works for this visit */
    }
  }, [items]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e) => e.key === KEY && setItems(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Back on the site with a card order that never came back paid (tab closed on Stripe,
  // "Back" on Stripe, or paid but the tab was closed before returning):
  // - paid: the cart is emptied;
  // - still unpaid: it is cancelled at once, so it stops holding the stock in this cart
  //   (otherwise checking out again would fail for up to an hour);
  // - cancelled or gone: forgotten.
  // Not on that order's own page, which shows the payment as it completes.
  // `stockVersion` changes afterwards so cart and checkout re-check stock.
  const [stockVersion, setStockVersion] = useState(0);
  useEffect(() => {
    const o = pendingCardOrder();
    if (!o || window.location.pathname === `/order/${o.number}`) return;
    const q = `?token=${encodeURIComponent(o.token)}`;
    api
      .get(`/orders/${encodeURIComponent(o.number)}${q}`)
      .then(async ({ order }) => {
        if (order.paymentStatus === 'paid') {
          if (takePaidCardOrder(o.number)) setItems([]);
          return;
        }
        if (order.status === 'pending') {
          const r = await api.post(`/orders/${encodeURIComponent(o.number)}/release`, { token: o.token });
          if (r.paymentStatus === 'paid') {
            if (takePaidCardOrder(o.number)) setItems([]);
            return;
          }
          if (r.status !== 'cancelled') return; // Stripe unreachable: try again next visit
        }
        forgetCardOrder();
        setStockVersion((v) => v + 1);
      })
      .catch((err) => {
        if (err.status === 404) forgetCardOrder();
      });
  }, []);

  /** `max`: the stock when known; the line never goes above it (the server checks again). */
  const add = useCallback((product, variant, quantity = 1, max = null) => {
    const key = lineKey(product.id, variant?.id);
    const cap = (n) => (max == null ? n : Math.min(n, max));
    setItems((list) => {
      const existing = list.find((l) => l.key === key);
      if (existing) return list.map((l) => (l.key === key ? { ...l, quantity: cap(l.quantity + quantity), max } : l));
      return [
        ...list,
        {
          key,
          productId: product.id,
          variantId: variant?.id ?? null,
          slug: product.slug,
          name: product.name,
          variantName: variant?.name ?? '',
          price: variant?.price ?? product.price,
          image: product.images?.[0] ?? null,
          quantity: cap(quantity),
          max,
        },
      ];
    });
    setDrawerOpen(true);
  }, []);

  const setQuantity = useCallback((key, quantity) => {
    setItems((list) => (quantity <= 0 ? list.filter((l) => l.key !== key) : list.map((l) => (l.key === key ? { ...l, quantity } : l))));
  }, []);

  const remove = useCallback((key) => setItems((list) => list.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  // Signing out empties the cart, so the next person on this device does not see it.
  // (A guest who signs in keeps their cart.)
  const { user } = useAuth();
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (user) wasSignedIn.current = true;
    else if (user === null && wasSignedIn.current) {
      wasSignedIn.current = false;
      clear();
    }
  }, [user, clear]);

  /** Updates snapshots from a server quote (fresh prices, names, images). */
  const syncFromQuote = useCallback((quote) => {
    setItems((list) =>
      list.map((l) => {
        const q = quote.lines.find((x) => x.key === l.key);
        return q ? { ...l, name: q.name, variantName: q.variantName, price: q.price, image: q.image, slug: q.slug } : l;
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, l) => n + l.quantity, 0),
      subtotal: items.reduce((n, l) => n + l.price * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      syncFromQuote,
      drawerOpen,
      stockVersion,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      payload: items.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    }),
    [items, add, setQuantity, remove, clear, syncFromQuote, drawerOpen, stockVersion],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
