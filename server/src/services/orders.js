import { getDb } from '../db.js';
import { getSettings } from '../settings.js';
import { HttpError, badRequest, parseJson, randomToken } from '../utils.js';

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

/** Which payment methods are currently offered, based on settings + env. */
export function availablePaymentMethods(settings, stripeReady) {
  const p = settings.payments;
  const out = [];
  if (p.card.enabled && stripeReady) out.push('card');
  if (p.cod.enabled) out.push('cod');
  if (p.bank.enabled) out.push('bank');
  return out;
}

export function findCoupon(code) {
  if (!code) return null;
  return getDb().prepare('SELECT * FROM coupons WHERE code = ?').get(String(code).trim()) || null;
}

/** Returns an error code if the coupon can't be used for `subtotal`, else null. */
export function couponError(coupon, subtotal) {
  if (!coupon || !coupon.active) return 'coupon_invalid';
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return 'coupon_expired';
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) return 'coupon_used_up';
  if (subtotal < coupon.min_order) return 'coupon_min_order';
  return null;
}

/**
 * Prices a cart from the database (never trusting client prices).
 * Returns per-line problems instead of throwing, so the cart page can show
 * them; `createOrder` refuses to continue when any exist.
 */
export function quoteCart({ items = [], couponCode, shippingMethodId, paymentMethod }) {
  const db = getDb();
  const settings = getSettings();
  const lines = [];
  const problems = [];

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1');
  const getVariant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND product_id = ?');
  const countVariants = db.prepare('SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?');
  const firstImage = db.prepare('SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1');

  // Merge duplicate lines so stock checks see the real quantity.
  const merged = new Map();
  for (const it of items) {
    const key = `${it.productId}:${it.variantId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { ...it, quantity: (prev?.quantity || 0) + Math.max(1, Math.floor(it.quantity || 1)) });
  }

  for (const it of merged.values()) {
    const key = `${it.productId}:${it.variantId ?? ''}`;
    const p = getProduct.get(it.productId);
    if (!p) {
      problems.push({ key, code: 'unavailable' });
      continue;
    }
    let variant = null;
    if (countVariants.get(p.id).n > 0) {
      variant = it.variantId ? getVariant.get(it.variantId, p.id) : null;
      if (!variant) {
        problems.push({ key, code: 'variant_required', name: p.name });
        continue;
      }
    }
    const available = p.track_stock ? (variant ? variant.stock : p.stock) : null;
    const quantity = it.quantity;
    if (available != null && quantity > available) {
      problems.push({ key, code: available > 0 ? 'insufficient_stock' : 'out_of_stock', available, name: p.name });
    }
    lines.push({
      key,
      productId: p.id,
      variantId: variant?.id ?? null,
      slug: p.slug,
      name: p.name,
      variantName: variant?.name ?? '',
      sku: variant?.sku || p.sku,
      image: firstImage.get(p.id)?.url ?? null,
      price: variant?.price ?? p.price,
      compareAtPrice: p.compare_at_price,
      quantity,
      available,
    });
  }

  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  let discount = 0;
  let coupon = null;
  let couponProblem = null;
  if (couponCode) {
    const c = findCoupon(couponCode);
    couponProblem = couponError(c, subtotal);
    if (!couponProblem) {
      coupon = c;
      if (c.type === 'percent') discount = Math.round((subtotal * Math.min(c.value, 100)) / 100);
      else if (c.type === 'fixed') discount = Math.min(c.value, subtotal);
    }
  }

  const methods = db.prepare('SELECT * FROM shipping_methods WHERE active = 1 ORDER BY sort_order, id').all();
  const afterDiscount = subtotal - discount;
  const shippingOptions = methods.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    requiresAddress: !!m.requires_address,
    freeOver: m.free_over,
    cost: coupon?.type === 'free_shipping' || (m.free_over != null && afterDiscount >= m.free_over) ? 0 : m.price,
  }));
  const shipping = shippingOptions.find((m) => m.id === Number(shippingMethodId)) || null;
  const shippingCost = shipping ? shipping.cost : 0;
  const paymentFee = paymentMethod === 'cod' ? settings.payments.cod.fee || 0 : 0;

  return {
    lines,
    problems,
    subtotal,
    discount,
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
    couponError: couponProblem,
    shippingOptions,
    shipping,
    shippingCost,
    paymentFee,
    total: afterDiscount + shippingCost + paymentFee,
  };
}

function adjustStock(db, items, direction) {
  const prod = db.prepare('UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ? AND track_stock = 1');
  const vari = db.prepare(
    'UPDATE product_variants SET stock = MAX(0, stock + ?) WHERE id = ? AND product_id IN (SELECT id FROM products WHERE track_stock = 1)',
  );
  for (const it of items) {
    const delta = direction * it.quantity;
    if (it.variant_id ?? it.variantId) vari.run(delta, it.variant_id ?? it.variantId);
    else if (it.product_id ?? it.productId) prod.run(delta, it.product_id ?? it.productId);
  }
}

export function addEvent(orderId, type, message = '') {
  getDb().prepare('INSERT INTO order_events (order_id, type, message) VALUES (?, ?, ?)').run(orderId, type, message);
}

/** Validates and stores an order atomically. Throws 409 on stock / price problems. */
export function createOrder(input, { user, stripeReady }) {
  const db = getDb();
  const settings = getSettings();

  if (!availablePaymentMethods(settings, stripeReady).includes(input.paymentMethod)) {
    throw badRequest('Payment method not available', { paymentMethod: 'invalid' });
  }
  if (!user && !settings.checkout.allowGuest) throw new HttpError(401, 'Please sign in to checkout');

  return db.transaction(() => {
    const quote = quoteCart(input);
    if (!quote.lines.length) throw badRequest('Your cart is empty');
    if (quote.problems.length) throw new HttpError(409, 'Some items in your cart changed', { problems: quote.problems });
    if (input.couponCode && quote.couponError) throw new HttpError(409, 'Coupon cannot be used', { coupon: quote.couponError });
    if (!quote.shipping) throw badRequest('Choose a shipping method', { shippingMethodId: 'required' });
    if (quote.shipping.requiresAddress && !input.address) throw badRequest('Address is required', { address: 'required' });

    const token = randomToken();
    const info = db
      .prepare(
        `INSERT INTO orders (number, access_token, user_id, email, phone, customer_name, shipping_address,
          shipping_method_id, shipping_name, shipping_cost, payment_method, payment_fee, subtotal, discount,
          coupon_code, total, notes)
         VALUES (@number, @token, @userId, @email, @phone, @name, @address, @shippingId, @shippingName,
          @shippingCost, @paymentMethod, @paymentFee, @subtotal, @discount, @coupon, @total, @notes)`,
      )
      .run({
        number: `tmp-${token}`,
        token,
        userId: user?.id ?? null,
        email: input.email,
        phone: input.phone || '',
        name: input.name,
        address: quote.shipping.requiresAddress ? JSON.stringify(input.address) : null,
        shippingId: quote.shipping.id,
        shippingName: quote.shipping.name,
        shippingCost: quote.shippingCost,
        paymentMethod: input.paymentMethod,
        paymentFee: quote.paymentFee,
        subtotal: quote.subtotal,
        discount: quote.discount,
        coupon: quote.coupon?.code ?? null,
        total: quote.total,
        notes: input.notes || '',
      });
    const id = Number(info.lastInsertRowid);
    db.prepare('UPDATE orders SET number = ? WHERE id = ?').run(`${settings.orderPrefix || ''}${1000 + id}`, id);

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_name, sku, image, price, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const l of quote.lines) {
      insertItem.run(id, l.productId, l.variantId, l.name, l.variantName, l.sku, l.image, l.price, l.quantity);
    }
    adjustStock(db, quote.lines, -1);
    if (quote.coupon) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(quote.coupon.code);

    if (user && input.saveAddress && input.address) {
      db.prepare('UPDATE users SET address = ?, phone = COALESCE(NULLIF(?, \'\'), phone) WHERE id = ?').run(
        JSON.stringify(input.address),
        input.phone || '',
        user.id,
      );
    }
    addEvent(id, 'created', '');
    return getOrder({ id });
  })();
}

export function serializeOrder(o, items, events) {
  return {
    id: o.id,
    number: o.number,
    accessToken: o.access_token,
    userId: o.user_id,
    email: o.email,
    phone: o.phone,
    customerName: o.customer_name,
    address: parseJson(o.shipping_address),
    shippingMethodId: o.shipping_method_id,
    shippingName: o.shipping_name,
    shippingCost: o.shipping_cost,
    paymentMethod: o.payment_method,
    paymentFee: o.payment_fee,
    paymentStatus: o.payment_status,
    status: o.status,
    subtotal: o.subtotal,
    discount: o.discount,
    couponCode: o.coupon_code,
    total: o.total,
    notes: o.notes,
    adminNotes: o.admin_notes,
    trackingNumber: o.tracking_number,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    itemCount: items ? items.reduce((n, i) => n + i.quantity, 0) : o.item_count,
    items: items?.map((i) => ({
      id: i.id,
      productId: i.product_id,
      variantId: i.variant_id,
      name: i.name,
      variantName: i.variant_name,
      sku: i.sku,
      image: i.image,
      price: i.price,
      quantity: i.quantity,
      slug: i.slug,
    })),
    events: events?.map((e) => ({ type: e.type, message: e.message, createdAt: e.created_at })),
  };
}

export function getOrder({ id, number }) {
  const db = getDb();
  const o = id
    ? db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM orders WHERE number = ?').get(number);
  if (!o) return null;
  const items = db
    .prepare('SELECT oi.*, p.slug FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE order_id = ? ORDER BY oi.id')
    .all(o.id);
  const events = db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').all(o.id);
  return serializeOrder(o, items, events);
}

/**
 * Applies admin (or payment-provider) changes to an order, restoring stock
 * when an order is cancelled and taking it again if it is re-opened.
 */
export function updateOrder(id, patch, { actor = 'admin' } = {}) {
  const db = getDb();
  return db.transaction(() => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!o) return null;
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    const sets = [];
    const params = {};
    if (patch.status && patch.status !== o.status) {
      if (patch.status === 'cancelled') adjustStock(db, items, +1);
      else if (o.status === 'cancelled') adjustStock(db, items, -1);
      sets.push('status = @status');
      params.status = patch.status;
      addEvent(id, 'status', `${o.status} → ${patch.status}${actor !== 'admin' ? ` (${actor})` : ''}`);
    }
    if (patch.paymentStatus && patch.paymentStatus !== o.payment_status) {
      sets.push('payment_status = @paymentStatus');
      params.paymentStatus = patch.paymentStatus;
      addEvent(id, 'payment', `${o.payment_status} → ${patch.paymentStatus}${actor !== 'admin' ? ` (${actor})` : ''}`);
    }
    for (const [key, col] of [
      ['trackingNumber', 'tracking_number'],
      ['adminNotes', 'admin_notes'],
      ['stripeSessionId', 'stripe_session_id'],
    ]) {
      if (patch[key] !== undefined && patch[key] !== o[col]) {
        sets.push(`${col} = @${key}`);
        params[key] = patch[key];
        if (key === 'trackingNumber' && patch[key]) addEvent(id, 'tracking', patch[key]);
      }
    }
    if (sets.length) {
      db.prepare(`UPDATE orders SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...params, id });
    }
    return getOrder({ id });
  })();
}
