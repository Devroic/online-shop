import Stripe from 'stripe';
import { config } from '../config.js';
import { getSettings } from '../settings.js';
import { getDb } from '../db.js';
import { getOrder, updateOrder } from './orders.js';

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
  const settings = getSettings();
  const currency = settings.currency.toLowerCase();
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
          currency,
          unit_amount: order.total,
          product_data: {
            name: `${settings.storeName} #${order.number}`,
            description: order.items.map((i) => `${i.quantity}× ${i.name}${i.variantName ? ` (${i.variantName})` : ''}`).join(', ').slice(0, 500),
          },
        },
      },
    ],
    success_url: orderUrl(order, '&paid=1'),
    cancel_url: `${config.publicUrl}/checkout?cancelled=${order.number}`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  updateOrder(order.id, { stripeSessionId: session.id }, { actor: 'stripe' });
  return session.url;
}

/** Applies a Checkout Session's state to its order (used by webhook and polling). */
export function applySession(session) {
  const id = Number(session.metadata?.orderId || session.client_reference_id);
  const order = id && getOrder({ id });
  if (!order || order.paymentMethod !== 'card') return null;
  if (session.payment_status === 'paid' && order.paymentStatus !== 'paid') {
    return { order: updateOrder(id, { paymentStatus: 'paid', status: order.status === 'pending' ? 'processing' : undefined }, { actor: 'stripe' }), justPaid: true };
  }
  if (session.status === 'expired' && order.paymentStatus === 'pending' && order.status !== 'cancelled') {
    return { order: updateOrder(id, { paymentStatus: 'failed', status: 'cancelled' }, { actor: 'stripe' }), justPaid: false };
  }
  return { order, justPaid: false };
}

/** If the webhook hasn't arrived yet, ask Stripe directly. */
export async function refreshCardPayment(order) {
  const s = getStripe();
  if (!s || order.paymentMethod !== 'card' || order.paymentStatus !== 'pending') return { order, justPaid: false };
  const row = getDb().prepare('SELECT stripe_session_id FROM orders WHERE id = ?').get(order.id);
  if (!row?.stripe_session_id) return { order, justPaid: false };
  try {
    const session = await s.checkout.sessions.retrieve(row.stripe_session_id);
    return applySession(session) || { order, justPaid: false };
  } catch (err) {
    console.error('[stripe] retrieve failed:', err.message);
    return { order, justPaid: false };
  }
}
