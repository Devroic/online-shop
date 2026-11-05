import { Fragment, createElement } from 'react';
import el from './locales/el.js';

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

export function t(text, vars) {
  let out = dict[text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, v);
  return out;
}

/** Like t(), but placeholders can be React nodes: tx('Add {amount} more', { amount: <b>5€</b> }). */
export function tx(text, nodes) {
  const out = dict[text] ?? text;
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

export const PAYMENT_METHOD = {
  card: 'Credit / debit card',
  cod: 'Cash on delivery',
};
