import { Fragment, createElement } from 'react';
import el from './locales/el.js';

// UI text is written in English in the code; other languages map the English
// text to a translation. Missing entries fall back to English.
const dictionaries = { el, en: {} };
let dict = dictionaries.el;

export function setLanguage(lang) {
  dict = dictionaries[lang] || {};
  document.documentElement.lang = lang;
}

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

export const ORDER_STATUS = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export const PAYMENT_METHOD = {
  card: 'Credit / debit card',
  cod: 'Cash on delivery',
  bank: 'Bank transfer',
};
