import express, { Router } from 'express';
import { config } from '../config.js';
import { applySession, getStripe } from '../services/payments.js';
import { notifyNewOrder } from './orders.js';

const router = Router();

// Stripe needs the raw body to verify the signature, so this router is
// mounted before the JSON body parser.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe || !config.stripe.webhookSecret) return res.status(404).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) {
    const result = await applySession(event.data.object);
    if (result?.justPaid) notifyNewOrder(result.order);
  }
  res.json({ received: true });
});

export default router;
