import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

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

// Card orders leave the site for Stripe before the cart can be emptied. The order
// number is kept for this tab so the order page can empty the cart on return.
const CARD_ORDER_KEY = 'shop.cardOrder';

export function rememberCardOrder(number) {
  try {
    sessionStorage.setItem(CARD_ORDER_KEY, String(number));
  } catch {
    /* storage blocked: the cart simply stays */
  }
}

/** True once per remembered card order, when it comes back paid. */
export function takePaidCardOrder(number) {
  try {
    if (sessionStorage.getItem(CARD_ORDER_KEY) !== String(number)) return false;
    sessionStorage.removeItem(CARD_ORDER_KEY);
    return true;
  } catch {
    return false;
  }
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
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      payload: items.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    }),
    [items, add, setQuantity, remove, clear, syncFromQuote, drawerOpen],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
