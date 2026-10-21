import nodemailer from 'nodemailer';
import { config } from './config.js';
import { waitUntil } from '@vercel/functions';
import { getSettings } from './settings.js';
import { formatMoney } from './utils.js';
import { translator } from './i18n.js';

let transport;
function smtpTransport() {
  if (transport !== undefined) return transport;
  transport = config.smtp.host
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      })
    : null;
  return transport;
}

export const emailConfigured = () => !!(config.resendKey || config.smtp.host);

/**
 * Sends one email through Resend (RESEND_API_KEY) or SMTP. Without either it
 * only logs, so development never breaks. Never throws: an email problem
 * must not make an order fail.
 */
export async function sendMail({ to, subject, html, replyTo }) {
  if (!to) return;
  const settings = await getSettings();
  const from = config.mailFrom || `"${settings.storeName}" <${config.smtp.user || 'onboarding@resend.dev'}>`;
  try {
    if (config.resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, reply_to: replyTo }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    } else if (smtpTransport()) {
      await smtpTransport().sendMail({ from, to, subject, html, replyTo });
    } else if (!config.isTest) {
      console.log(`[mail] (email not configured) to=${to} subject="${subject}"`);
    }
  } catch (err) {
    console.error('[mail] failed:', err.message);
  }
}

/**
 * Runs work after the response has been sent. On Vercel the function would
 * otherwise be frozen as soon as it responds and the emails would be lost.
 */
export function background(promise) {
  const p = Promise.resolve(promise).catch((err) => console.error('[background]', err));
  waitUntil(p);
  return p;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(settings, body) {
  const color = settings.theme.primary;
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;overflow:hidden">
      <div style="background:${esc(color)};color:#fff;padding:20px 24px;font-size:20px;font-weight:bold">${esc(settings.storeName)}</div>
      <div style="padding:24px;line-height:1.5">${body}</div>
    </div>
    <p style="text-align:center;color:#71717a;font-size:12px">${esc(settings.contact.email)} ${esc(settings.contact.phone)}</p>
  </div></body></html>`;
}

const STATUS_TEXT = { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

const button = (href, label, color) =>
  `<a href="${href}" style="background:${esc(color)};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(label)}</a>`;

function orderTable(order, settings, t) {
  const m = (c) => formatMoney(c, settings);
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:6px 0">${esc(i.name)}${i.variantName ? ` <span style="color:#71717a">(${esc(i.variantName)})</span>` : ''} × ${i.quantity}</td>
      <td style="padding:6px 0;text-align:right">${m(i.price * i.quantity)}</td></tr>`,
    )
    .join('');
  const line = (label, value) =>
    `<tr><td style="padding:4px 0;color:#52525b">${label}</td><td style="padding:4px 0;text-align:right">${value}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;margin-top:12px">${rows}
    ${line(t('Subtotal'), m(order.subtotal))}
    ${order.discount ? line(t('Discount'), '-' + m(order.discount)) : ''}
    ${line(`${t('Shipping')} (${esc(order.shippingName)})`, m(order.shippingCost))}
    ${order.paymentFee ? line(t('Payment fee'), m(order.paymentFee)) : ''}
    <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #e4e4e7">${t('Total')}</td>
    <td style="padding:8px 0;font-weight:bold;text-align:right;border-top:1px solid #e4e4e7">${m(order.total)}</td></tr></table>`;
}

const orderLink = (order) => `${config.publicUrl}/order/${order.number}?token=${order.accessToken}`;

export async function sendOrderConfirmation(order) {
  const s = await getSettings();
  const t = translator(order.language || s.language);
  const body = `<h2 style="margin-top:0">${t('Thank you for your order!')}</h2>
    <p>${t('Hi {name},', { name: esc(order.customerName) })}<br>${t('we have received your order {number}.', { number: `<strong>#${esc(order.number)}</strong>` })}</p>
    ${orderTable(order, s, t)}
    <p style="margin-top:24px">${button(orderLink(order), t('View order'), s.theme.primary)}</p>`;
  return sendMail({ to: order.email, subject: `${t('Order confirmation')} #${order.number}`, html: layout(s, body) });
}

/** Sent to the shop owner; always in the shop's language. */
export async function sendAdminNewOrder(order) {
  const s = await getSettings();
  const t = translator(s.language);
  const to = s.notifications.orderEmail || s.contact.email;
  const body = `<h2 style="margin-top:0">${t('New order')} #${esc(order.number)}</h2>
    <p>${esc(order.customerName)} · ${esc(order.email)} · ${esc(order.phone)}<br>${t('Payment')}: ${esc(order.paymentMethod)}</p>
    ${orderTable(order, s, t)}
    <p>${button(`${config.publicUrl}/admin/orders/${order.id}`, t('Open in admin'), s.theme.primary)}</p>`;
  return sendMail({ to, subject: `${t('New order')} #${order.number} – ${formatMoney(order.total, s)}`, html: layout(s, body) });
}

export async function sendStatusUpdate(order) {
  const s = await getSettings();
  const t = translator(order.language || s.language);
  const statusText = t(STATUS_TEXT[order.status]);
  const tracking = order.trackingNumber ? `<p>${t('Tracking number')}: <strong>${esc(order.trackingNumber)}</strong></p>` : '';
  const body = `<h2 style="margin-top:0">${t('Order update')} #${esc(order.number)}</h2>
    <p>${t('Your order status is now')}: <strong>${statusText}</strong></p>
    ${tracking}<p>${button(orderLink(order), t('View order'), s.theme.primary)}</p>`;
  return sendMail({ to: order.email, subject: `#${order.number}: ${statusText}`, html: layout(s, body) });
}

export async function sendPasswordReset(user, token, lang) {
  const s = await getSettings();
  const t = translator(lang || s.language);
  const link = `${config.publicUrl}/account/reset?token=${token}`;
  const body = `<p>${t('We received a request to reset your password.')}</p>
    <p>${button(link, t('Choose a new password'), s.theme.primary)}</p>
    <p style="color:#71717a;font-size:13px">${t('The link expires in 1 hour. If you did not ask for this, ignore this email.')}</p>`;
  return sendMail({ to: user.email, subject: t('Password reset'), html: layout(s, body) });
}

export async function sendContactMessage(msg) {
  const s = await getSettings();
  const t = translator(s.language);
  const body = `<p><strong>${esc(msg.name)}</strong> &lt;${esc(msg.email)}&gt; ${esc(msg.phone)}</p><p style="white-space:pre-line">${esc(msg.message)}</p>`;
  return sendMail({ to: s.contact.email, subject: `${t('Contact form')}: ${msg.name}`, html: layout(s, body), replyTo: msg.email });
}

export async function sendWelcome(user, lang) {
  const s = await getSettings();
  const t = translator(lang || s.language);
  const body = `<h2 style="margin-top:0">${t('Welcome, {name}!', { name: esc(user.name) })}</h2>
    <p>${t('Your account at {store} is ready.', { store: `<strong>${esc(s.storeName)}</strong>` })}</p>
    <p>${t('From your account you can follow your orders and save your address for faster checkout.')}</p>
    <p style="margin-top:24px">${button(`${config.publicUrl}/products`, t('Start shopping'), s.theme.primary)}</p>`;
  return sendMail({ to: user.email, subject: t('Welcome to {store}', { store: s.storeName }), html: layout(s, body) });
}
