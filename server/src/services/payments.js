import Stripe from 'stripe';
import { config } from '../config.js';
import { getSettings } from '../settings.js';
import { db } from '../db.js';
import { addEvent, getOrder, updateOrder } from './orders.js';

let stripe;
export function getStripe() {
  if (!config.stripe.secretKey) return null;
  stripe ??= new Stripe(config.stripe.secretKey);
  return stripe;
}

export const stripeReady = () => !!config.stripe.secretKey;

const orderUrl = (order, extra = '') => `${config.publicUrl}/order/${order.number}?token=${order.accessToken}${extra}`;

/** Creates a hosted Stripe Checkout page for the order and returns its URL. */
export async function createCheckoutSession(order) {
  const s = getStripe();
  const settings = await getSettings();
  // One line with the final total keeps discounts, shipping and fees exact.
  const session = await s.checkout.sessions.create({
    mode: 'payment',
    customer_email: order.email,
    client_reference_id: String(order.id),
    metadata: { orderId: String(order.id), orderNumber: order.number },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: settings.currency.toLowerCase(),
          unit_amount: order.total,
          product_data: {
            name: `${settings.storeName} #${order.number}`,
            description: order.items
              .map((i) => `${i.quantity}× ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`)
              .join(', ')
              .slice(0, 500),
          },
        },
      },
    ],
    success_url: orderUrl(order, '&paid=1'),
    cancel_url: `${config.publicUrl}/checkout?cancelled=${order.number}`,
    // The page (and the stock it holds) lasts about 30 minutes, the shortest Stripe allows
    // (one minute more, so a clock slightly behind Stripe's is never refused). A customer
    // who comes back sooner releases it at once (see releaseCardOrder).
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  });
  await updateOrder(order.id, { stripeSessionId: session.id }, { actor: 'stripe' });
  return session.url;
}

/**
 * Applies a Checkout Session's state to its order (used by webhook and polling).
 * Only to the order that session was made for: several shops may share one Stripe
 * account (a test sandbox), and Stripe sends every event to every shop's webhook, so
 * another shop's order 5 must not mark this shop's order 5 as paid. Session ids are
 * unique across Stripe; anything else is ignored.
 */
export async function applySession(session) {
  const id = Number(session.metadata?.orderId || session.client_reference_id);
  const row = id ? await db().one('SELECT stripe_session_id FROM orders WHERE id = $1', [id]) : null;
  if (!row || !session.id || row.stripe_session_id !== session.id) return null;
  const order = await getOrder({ id });
  if (!order || order.paymentMethod !== 'card') return null;
  if (session.payment_status === 'paid' && order.paymentStatus !== 'paid') {
    // Conditional update: the webhook and the order page may both get here;
    // only the first one counts, so the customer gets one confirmation email.
    const r = await db().query(
      `UPDATE orders SET payment_status = 'paid',
         status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END, updated_at = now()
       WHERE id = $1 AND payment_status <> 'paid'`,
      [id],
    );
    if (!r.rowCount) return { order: await getOrder({ id }), justPaid: false };
    await addEvent(db(), id, 'payment', `${order.paymentStatus} → paid (stripe)`);
    return { order: await getOrder({ id }), justPaid: true };
  }
  if (session.status === 'expired' && order.paymentStatus === 'pending' && order.status !== 'cancelled') {
    return { order: await updateOrder(id, { paymentStatus: 'failed', status: 'cancelled' }, { actor: 'stripe' }), justPaid: false };
  }
  return { order, justPaid: false };
}

/**
 * The customer left a card payment unfinished and is checking out again (or came back
 * with "Back" on Stripe). The old unpaid order is cancelled at once, so it gives its
 * stock and coupon back instead of holding them for up to 30 minutes, and its Stripe page
 * is closed first so it cannot be paid as well.
 * Returns { order, paid } when it was paid in the meantime (then it is kept),
 * { order, released: true } when cancelled, { order, released: false } when left alone
 * (not a pending card order, or Stripe could not be reached: better than a double payment).
 */
export async function releaseCardOrder(order) {
  if (order.paymentMethod !== 'card' || order.paymentStatus !== 'pending' || order.status !== 'pending') {
    return { order, released: false, paid: order.paymentStatus === 'paid' };
  }
  const s = getStripe();
  const row = await db().one('SELECT stripe_session_id FROM orders WHERE id = $1', [order.id]);
  if (s && row?.stripe_session_id) {
    try {
      const session = await s.checkout.sessions.retrieve(row.stripe_session_id);
      if (session.status === 'open') {
        await s.checkout.sessions.expire(session.id);
      } else if (session.payment_status === 'paid') {
        const result = await applySession(session);
        return { order: result?.order ?? order, paid: true, justPaid: !!result?.justPaid };
      }
    } catch (err) {
      console.error('[stripe] could not close the old payment page:', err.message);
      return { order, released: false };
    }
  }
  const cancelled = await updateOrder(order.id, { status: 'cancelled', paymentStatus: 'failed' }, { actor: 'customer' });
  return { order: cancelled, released: true };
}

/** If the webhook hasn't arrived yet, ask Stripe directly. */
export async function refreshCardPayment(order) {
  const s = getStripe();
  if (!s || order.paymentMethod !== 'card' || order.paymentStatus !== 'pending') return { order, justPaid: false };
  const row = await db().one('SELECT stripe_session_id FROM orders WHERE id = $1', [order.id]);
  if (!row?.stripe_session_id) return { order, justPaid: false };
  try {
    const session = await s.checkout.sessions.retrieve(row.stripe_session_id);
    return (await applySession(session)) || { order, justPaid: false };
  } catch (err) {
    console.error('[stripe] retrieve failed:', err.message);
    return { order, justPaid: false };
  }
}
