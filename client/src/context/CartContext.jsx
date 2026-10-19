import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  const add = useCallback((product, variant, quantity = 1) => {
    const key = lineKey(product.id, variant?.id);
    setItems((list) => {
      const existing = list.find((l) => l.key === key);
      if (existing) return list.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l));
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
          quantity,
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
