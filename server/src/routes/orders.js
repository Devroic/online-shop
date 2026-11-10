import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from '../db.js';
import { getSettings } from '../settings.js';
import { requireUser } from '../auth.js';
import { HttpError, notFound, validate } from '../utils.js';
import { createOrder, getOrder, serializeOrder, updateOrder } from '../services/orders.js';
import { createCheckoutSession, refreshCardPayment, releaseCardOrder, stripeReady } from '../services/payments.js';
import { background, sendAdminNewOrder, sendOrderConfirmation } from '../email.js';
import { addressSchema, phoneSchema } from './auth.js';
import { config } from '../config.js';
import { requestLanguage } from '../i18n.js';

const router = Router();

const checkoutLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: config.isTest ? 1000 : 20, standardHeaders: true, legacyHeaders: false });

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        variantId: z.number().int().positive().nullish(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .min(1)
    .max(100),
  email: z.email().max(200),
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  address: addressSchema.nullish(),
  shippingMethodId: z.number().int().positive(),
  paymentMethod: z.enum(['card', 'cod']),
  couponCode: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional().default(''),
  saveAddress: z.boolean().optional(),
  acceptTerms: z.literal(true, { message: 'accept_terms' }),
  // This browser's earlier card order that was never paid (see releaseCardOrder).
  replaceOrder: z.object({ number: z.string().max(40), token: z.string().max(200) }).optional(),
});

const tokenSchema = z.object({ token: z.string().max(200) });

/** The order, only for whoever holds its secret link token. */
async function orderByToken(number, token) {
  const order = await getOrder({ number: String(number) });
  return order && token && token === order.accessToken ? order : null;
}

export function notifyNewOrder(order) {
  return background(Promise.all([sendOrderConfirmation(order), sendAdminNewOrder(order)]));
}

router.post('/', checkoutLimiter, async (req, res) => {
  const { replaceOrder, ...data } = validate(checkoutSchema, req.body);
  const settings = await getSettings();
  if (settings.checkout.requirePhone && !data.phone) {
    throw new HttpError(400, 'Validation failed', { phone: 'required' });
  }
  // Checking out again after leaving a card payment: the old order lets go of its stock
  // first, so it does not block this one. If it was paid meanwhile, nothing new is created.
  if (replaceOrder) {
    const previous = await orderByToken(replaceOrder.number, replaceOrder.token);
    if (previous) {
      const released = await releaseCardOrder(previous);
      if (released.paid) {
        if (released.justPaid) notifyNewOrder(released.order);
        return res.json({ order: released.order, alreadyPaid: true });
      }
    }
  }
  const order = await createOrder({ ...data, language: requestLanguage(req, settings) }, { user: req.user, stripeReady: stripeReady() });

  if (order.paymentMethod === 'card') {
    try {
      const url = await createCheckoutSession(order);
      return res.status(201).json({ order, redirectUrl: url });
    } catch (err) {
      console.error('[stripe] session failed:', err.message);
      await updateOrder(order.id, { status: 'cancelled', paymentStatus: 'failed' }, { actor: 'stripe' });
      throw new HttpError(502, 'Card payment is unavailable right now. Please choose another payment method.');
    }
  }
  notifyNewOrder(order);
  res.status(201).json({ order });
});

router.get('/mine', requireUser, async (req, res) => {
  const rows = await db().all(
    `SELECT o.*, (SELECT SUM(quantity)::int FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o WHERE user_id = $1 ORDER BY id DESC LIMIT 200`,
    [req.user.id],
  );
  res.json(rows.map((o) => serializeOrder(o)));
});

/** "Track my order": exchanges order number + email for the order link. */
router.post('/lookup', checkoutLimiter, async (req, res) => {
  const { number, email } = validate(z.object({ number: z.string().trim().max(40), email: z.string().trim().max(200) }), req.body);
  const order = await getOrder({ number: number.replace(/^#/, '') });
  if (!order || order.email.toLowerCase() !== email.toLowerCase()) throw notFound('Order not found');
  res.json({ number: order.number, token: order.accessToken });
});

/** "Back" on the Stripe page: the unpaid order is cancelled at once and gives its stock back. */
router.post('/:number/release', checkoutLimiter, async (req, res) => {
  const { token } = validate(tokenSchema, req.body);
  const order = await orderByToken(req.params.number, token);
  if (!order) throw notFound('Order not found');
  const result = await releaseCardOrder(order);
  if (result.justPaid) notifyNewOrder(result.order);
  res.json({ status: result.order.status, paymentStatus: result.order.paymentStatus });
});

/** Order page: visible to its owner, an admin, or anyone holding the secret link token. */
router.get('/:number', async (req, res) => {
  let order = await getOrder({ number: req.params.number });
  const allowed =
    order &&
    (req.query.token === order.accessToken || (req.user && (req.user.role === 'admin' || req.user.id === order.userId)));
  if (!allowed) throw notFound('Order not found');

  if (order.paymentMethod === 'card' && order.paymentStatus === 'pending') {
    const result = await refreshCardPayment(order);
    order = result.order;
    if (result.justPaid) notifyNewOrder(order);
  }
  const { adminNotes, ...visible } = order;
  res.json({ order: visible });
});

export default router;
