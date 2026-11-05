/**
 * Payment statuses that make sense for each order status, per payment method.
 * Card orders are paid before they are prepared; cash on delivery is collected
 * at delivery. A cancelled order may be unpaid, failed, paid (refund owed) or
 * refunded; a delivered one may be refunded after a return.
 * The server enforces the same table (server/src/services/orders.js).
 */
const ALLOWED_PAYMENT = {
  card: {
    pending: ['pending'],
    processing: ['paid'],
    shipped: ['paid'],
    delivered: ['paid', 'refunded'],
    cancelled: ['pending', 'failed', 'paid', 'refunded'],
    returned: ['paid', 'refunded'],
  },
  cod: {
    pending: ['pending'],
    processing: ['pending'],
    shipped: ['pending'],
    delivered: ['pending', 'paid', 'refunded'],
    cancelled: ['pending', 'failed', 'paid', 'refunded'],
    returned: ['paid', 'refunded'],
  },
};

export const pairAllowed = (method, status, paymentStatus) =>
  (ALLOWED_PAYMENT[method] || ALLOWED_PAYMENT.cod)[status]?.includes(paymentStatus) ?? false;

/** Order statuses that can go with `paymentStatus`. The saved status always stays listed. */
export const statusOptions = (method, statuses, paymentStatus, saved) =>
  statuses.filter(
    (s) =>
      s === saved ||
      // "Returned" is offered only for a delivered order.
      ((s !== 'returned' || saved === 'delivered') && pairAllowed(method, s, paymentStatus)),
  );

/** A card payment Stripe confirmed cannot become unpaid or failed again. */
export const paymentStepAllowed = (method, saved, next) =>
  !(method === 'card' && ['paid', 'refunded'].includes(saved) && ['pending', 'failed'].includes(next));

/** Payment statuses that can go with `status`. The saved one always stays listed. */
export const paymentOptions = (method, payments, status, saved) =>
  payments.filter((p) => p === saved || (pairAllowed(method, status, p) && paymentStepAllowed(method, saved, p)));
