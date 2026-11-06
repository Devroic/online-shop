import { Fragment, createElement } from 'react';
import el from './locales/el.js';
import { one as enOne } from './locales/en.js';

// UI text is written in English in the code; other languages map the English
// text to a translation. Missing entries fall back to English.
const dictionaries = { el, en: {} };
let dict = dictionaries.el;
let current = 'el';

export const LANGUAGES = ['el', 'en'];

export function setLanguage(lang) {
  current = lang;
  dict = dictionaries[lang] || {};
  document.documentElement.lang = lang;
}

export const getLanguage = () => current;

/**
 * Counted texts ("{n} items") have a singular: a translation can be [one, other],
 * chosen by the language's plural rules from `vars.n`. "1 τεμάχιο", "2 τεμάχια".
 */
function pick(text, vars) {
  const entry = dict[text];
  const n = vars?.n != null ? Number(vars.n) : NaN;
  const isOne = Number.isFinite(n) && new Intl.PluralRules(current).select(n) === 'one';
  if (Array.isArray(entry)) return isOne ? entry[0] : entry[1];
  if (entry != null) return entry;
  return isOne && current === 'en' ? (enOne[text] ?? text) : text;
}

export function t(text, vars) {
  let out = pick(text, vars);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** Like t(), but placeholders can be React nodes: tx('Add {amount} more', { amount: <b>5€</b> }). */
export function tx(text, nodes) {
  const out = pick(text, nodes);
  return out.split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return createElement(Fragment, { key: i }, m && m[1] in nodes ? nodes[m[1]] : part);
  });
}

/** Display name of a sign-in provider ("google" → "Google"). */
export const providerName = (p) => ({ google: 'Google', facebook: 'Facebook' })[p] || p;

export const ORDER_STATUS = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

// Store pickup orders (no delivery address) name two steps differently.
const PICKUP_STATUS = { shipped: 'Ready for pickup', delivered: 'Picked up' };

/** The status name for an order: "Ready for pickup" instead of "Shipped" when it is collected from the shop. */
export const statusName = (status, order) => t((order && !order.address && PICKUP_STATUS[status]) || ORDER_STATUS[status]);

/** "Pay at the store" instead of "Cash on delivery" for store pickup orders. */
export const paymentName = (method, order) => t(method === 'cod' && order && !order.address ? 'Pay at the store' : PAYMENT_METHOD[method]);

export const PAYMENT_STATUS = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

/**
 * For the customer. An unpaid cash order is not late: the method ("Cash on delivery",
 * "Pay at the store") already says when it is paid, so there is no status label (null).
 */
export const paymentStatusName = (order) =>
  order.paymentMethod === 'cod' && order.paymentStatus === 'pending' && order.status !== 'cancelled' ? null : t(PAYMENT_STATUS[order.paymentStatus]);

export const PAYMENT_METHOD = {
  card: 'Credit / debit card',
  cod: 'Cash on delivery',
};
