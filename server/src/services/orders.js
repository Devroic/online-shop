import { db, tx } from '../db.js';
import { getSettings } from '../settings.js';
import { HttpError, badRequest, randomToken } from '../utils.js';

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

/** Which payment methods are currently offered, based on settings + env. */
export function availablePaymentMethods(settings, stripeReady) {
  const p = settings.payments;
  const out = [];
  if (p.card.enabled && stripeReady) out.push('card');
  if (p.cod.enabled) out.push('cod');
  return out;
}

export function findCoupon(code, conn = db()) {
  if (!code) return null;
  return conn.one('SELECT * FROM coupons WHERE code = $1', [String(code).trim().toUpperCase()]);
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
export async function quoteCart({ items = [], couponCode, shippingMethodId, paymentMethod }, conn = db()) {
  const settings = await getSettings();
  const lines = [];
  const problems = [];

  // Merge duplicate lines so stock checks see the real quantity.
  const merged = new Map();
  for (const it of items) {
    const key = `${it.productId}:${it.variantId ?? ''}`;
    const prev = merged.get(key);
    merged.set(key, { ...it, quantity: (prev?.quantity || 0) + Math.max(1, Math.floor(it.quantity || 1)) });
  }

  const productIds = [...new Set([...merged.values()].map((i) => i.productId))];
  const products = await conn.all('SELECT * FROM products WHERE id = ANY($1) AND active', [productIds]);
  const variants = await conn.all('SELECT * FROM product_variants WHERE product_id = ANY($1)', [productIds]);
  const images = await conn.all(
    'SELECT DISTINCT ON (product_id) product_id, url FROM product_images WHERE product_id = ANY($1) ORDER BY product_id, sort_order, id',
    [productIds],
  );

  for (const [key, it] of merged) {
    const p = products.find((x) => x.id === it.productId);
    if (!p) {
      problems.push({ key, code: 'unavailable' });
      continue;
    }
    const own = variants.filter((v) => v.product_id === p.id);
    let variant = null;
    if (own.length) {
      variant = own.find((v) => v.id === it.variantId) || null;
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
      image: images.find((i) => i.product_id === p.id)?.url ?? null,
      price: variant?.price ?? p.price,
      compareAtPrice: p.compare_at_price,
      quantity,
      available,
      trackStock: p.track_stock,
    });
  }

  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  let discount = 0;
  let coupon = null;
  let couponProblem = null;
  if (couponCode) {
    const c = await findCoupon(couponCode, conn);
    couponProblem = couponError(c, subtotal);
    if (!couponProblem) {
      coupon = c;
      if (c.type === 'percent') discount = Math.round((subtotal * Math.min(c.value, 100)) / 100);
      else if (c.type === 'fixed') discount = Math.min(c.value, subtotal);
    }
  }

  const methods = await conn.all('SELECT * FROM shipping_methods WHERE active ORDER BY sort_order, id');
  const afterDiscount = subtotal - discount;
  const shippingOptions = methods.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    requiresAddress: m.requires_address,
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

/** Changes stock for order lines. When taking stock, fails if another order got there first. */
async function adjustStock(conn, items, direction, { guarded = direction < 0 } = {}) {
  for (const it of items) {
    const variantId = it.variant_id ?? it.variantId;
    const productId = it.product_id ?? it.productId;
    const delta = direction * it.quantity;
    const guard = guarded ? `AND stock >= ${Number(it.quantity)}` : '';
    let r;
    if (variantId) {
      r = await conn.query(
        `UPDATE product_variants SET stock = GREATEST(0, stock + $1) WHERE id = $2 ${guard}
           AND product_id IN (SELECT id FROM products WHERE track_stock)`,
        [delta, variantId],
      );
    } else if (productId) {
      r = await conn.query(`UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2 AND track_stock ${guard}`, [delta, productId]);
    }
    const tracked = it.trackStock ?? true;
    if (guarded && tracked && r && r.rowCount === 0) {
      throw new HttpError(409, 'Some items in your cart changed', { problems: [{ key: it.key, code: 'insufficient_stock' }] });
    }
  }
}

export function addEvent(conn, orderId, type, message = '') {
  return conn.query('INSERT INTO order_events (order_id, type, message) VALUES ($1, $2, $3)', [orderId, type, message]);
}

/** Validates and stores an order atomically. Throws 409 on stock / price problems. */
export async function createOrder(input, { user, stripeReady }) {
  const settings = await getSettings();
  if (!availablePaymentMethods(settings, stripeReady).includes(input.paymentMethod)) {
    throw badRequest('Payment method not available', { paymentMethod: 'invalid' });
  }
  if (!user && !settings.checkout.allowGuest) throw new HttpError(401, 'Please sign in to checkout');

  const id = await tx(async (t) => {
    const quote = await quoteCart(input, t);
    if (!quote.lines.length) throw badRequest('Your cart is empty');
    if (quote.problems.length) throw new HttpError(409, 'Some items in your cart changed', { problems: quote.problems });
    if (input.couponCode && quote.couponError) throw new HttpError(409, 'Coupon cannot be used', { coupon: quote.couponError });
    if (!quote.shipping) throw badRequest('Choose a shipping method', { shippingMethodId: 'required' });
    if (quote.shipping.requiresAddress && !input.address) throw badRequest('Address is required', { address: 'required' });

    const token = randomToken();
    const { id } = await t.one(
      `INSERT INTO orders (number, access_token, user_id, email, phone, customer_name, shipping_address,
         shipping_method_id, shipping_name, shipping_cost, payment_method, payment_fee, subtotal, discount,
         coupon_code, total, notes, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
      [
        `tmp-${token}`,
        token,
        user?.id ?? null,
        input.email.trim().toLowerCase(),
        input.phone || '',
        input.name,
        quote.shipping.requiresAddress ? JSON.stringify(input.address) : null,
        quote.shipping.id,
        quote.shipping.name,
        quote.shippingCost,
        input.paymentMethod,
        quote.paymentFee,
        quote.subtotal,
        quote.discount,
        quote.coupon?.code ?? null,
        quote.total,
        input.notes || '',
        input.language || null,
      ],
    );
    await t.query('UPDATE orders SET number = $1 WHERE id = $2', [`${settings.orderPrefix || ''}${1000 + id}`, id]);

    for (const l of quote.lines) {
      await t.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, name, variant_name, sku, image, price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, l.productId, l.variantId, l.name, l.variantName, l.sku, l.image, l.price, l.quantity],
      );
    }
    await adjustStock(t, quote.lines, -1);
    if (quote.coupon) {
      const r = await t.query(
        'UPDATE coupons SET used_count = used_count + 1 WHERE code = $1 AND (max_uses IS NULL OR used_count < max_uses)',
        [quote.coupon.code],
      );
      if (!r.rowCount) throw new HttpError(409, 'Coupon cannot be used', { coupon: 'coupon_used_up' });
    }
    if (user && input.saveAddress && input.address) {
      await t.query("UPDATE users SET address = $1, phone = COALESCE(NULLIF($2, ''), phone) WHERE id = $3", [
        JSON.stringify(input.address),
        input.phone || '',
        user.id,
      ]);
    }
    await addEvent(t, id, 'created');
    return id;
  });
  return getOrder({ id });
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
    address: o.shipping_address,
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
    language: o.language,
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

export async function getOrder({ id, number }, conn = db()) {
  const o = id
    ? await conn.one('SELECT * FROM orders WHERE id = $1', [id])
    : await conn.one('SELECT * FROM orders WHERE number = $1', [number]);
  if (!o) return null;
  const items = await conn.all(
    'SELECT oi.*, p.slug FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE order_id = $1 ORDER BY oi.id',
    [o.id],
  );
  const events = await conn.all('SELECT * FROM order_events WHERE order_id = $1 ORDER BY id', [o.id]);
  return serializeOrder(o, items, events);
}

/**
 * Applies admin (or payment-provider) changes to an order, restoring stock
 * when an order is cancelled and taking it again if it is re-opened.
 */
export async function updateOrder(id, patch, { actor = 'admin' } = {}) {
  const found = await tx(async (t) => {
    const o = await t.one('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    if (!o) return false;
    const items = await t.all('SELECT * FROM order_items WHERE order_id = $1', [id]);
    const sets = [];
    const vals = [];
    const set = (col, v) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    const by = actor !== 'admin' ? ` (${actor})` : '';
    if (patch.status && patch.status !== o.status) {
      // Re-opening a cancelled order takes the stock again (never below zero).
      if (patch.status === 'cancelled') await adjustStock(t, items, +1);
      else if (o.status === 'cancelled') await adjustStock(t, items, -1, { guarded: false });
      set('status', patch.status);
      await addEvent(t, id, 'status', `${o.status} → ${patch.status}${by}`);
    }
    if (patch.paymentStatus && patch.paymentStatus !== o.payment_status) {
      set('payment_status', patch.paymentStatus);
      await addEvent(t, id, 'payment', `${o.payment_status} → ${patch.paymentStatus}${by}`);
    }
    for (const [key, col] of [
      ['trackingNumber', 'tracking_number'],
      ['adminNotes', 'admin_notes'],
      ['stripeSessionId', 'stripe_session_id'],
    ]) {
      if (patch[key] !== undefined && patch[key] !== o[col]) {
        set(col, patch[key]);
        if (key === 'trackingNumber' && patch[key]) await addEvent(t, id, 'tracking', patch[key]);
      }
    }
    if (sets.length) {
      vals.push(id);
      await t.query(`UPDATE orders SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
    }
    return true;
  });
  return found ? getOrder({ id }) : null;
}
