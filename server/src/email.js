import nodemailer from 'nodemailer';
import { config } from './config.js';
import { waitUntil } from '@vercel/functions';
import { getSettings } from './settings.js';
import { formatMoney } from './utils.js';

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

const el = (settings) => settings.language === 'el';

const STATUS_TEXT = {
  el: { pending: 'Σε αναμονή', processing: 'Σε επεξεργασία', shipped: 'Απεστάλη', delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε' },
  en: { pending: 'Pending', processing: 'Processing', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' },
};

function orderTable(order, settings) {
  const m = (c) => formatMoney(c, settings);
  const gr = el(settings);
  const rows = order.items
    .map(
      (i) => `<tr><td style="padding:6px 0">${esc(i.name)}${i.variantName ? ` <span style="color:#71717a">(${esc(i.variantName)})</span>` : ''} × ${i.quantity}</td>
      <td style="padding:6px 0;text-align:right">${m(i.price * i.quantity)}</td></tr>`,
    )
    .join('');
  const line = (label, value) =>
    `<tr><td style="padding:4px 0;color:#52525b">${label}</td><td style="padding:4px 0;text-align:right">${value}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;margin-top:12px">${rows}
    ${line(gr ? 'Υποσύνολο' : 'Subtotal', m(order.subtotal))}
    ${order.discount ? line(gr ? 'Έκπτωση' : 'Discount', '-' + m(order.discount)) : ''}
    ${line(`${gr ? 'Αποστολή' : 'Shipping'} (${esc(order.shippingName)})`, m(order.shippingCost))}
    ${order.paymentFee ? line(gr ? 'Χρέωση πληρωμής' : 'Payment fee', m(order.paymentFee)) : ''}
    <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #e4e4e7">${gr ? 'Σύνολο' : 'Total'}</td>
    <td style="padding:8px 0;font-weight:bold;text-align:right;border-top:1px solid #e4e4e7">${m(order.total)}</td></tr></table>`;
}

const orderLink = (order) => `${config.publicUrl}/order/${order.number}?token=${order.accessToken}`;

export async function sendOrderConfirmation(order) {
  const s = await getSettings();
  const gr = el(s);
  const bank =
    order.paymentMethod === 'bank' && s.payments.bank.details
      ? `<div style="background:#f4f4f5;padding:12px;border-radius:8px;margin-top:16px;white-space:pre-line">
         <strong>${gr ? 'Στοιχεία τραπεζικής κατάθεσης' : 'Bank transfer details'}</strong><br>${esc(s.payments.bank.details)}<br>
         ${gr ? 'Αιτιολογία' : 'Reference'}: <strong>${esc(order.number)}</strong></div>`
      : '';
  const body = `<h2 style="margin-top:0">${gr ? 'Ευχαριστούμε για την παραγγελία σας!' : 'Thank you for your order!'}</h2>
    <p>${gr ? 'Γεια σας' : 'Hi'} ${esc(order.customerName)},<br>${
      gr ? 'λάβαμε την παραγγελία σας' : 'we have received your order'
    } <strong>#${esc(order.number)}</strong>.</p>
    ${orderTable(order, s)}${bank}
    <p style="margin-top:24px"><a href="${orderLink(order)}" style="background:${esc(s.theme.primary)};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${
      gr ? 'Προβολή παραγγελίας' : 'View order'
    }</a></p>`;
  return sendMail({
    to: order.email,
    subject: `${gr ? 'Επιβεβαίωση παραγγελίας' : 'Order confirmation'} #${order.number}`,
    html: layout(s, body),
  });
}

export async function sendAdminNewOrder(order) {
  const s = await getSettings();
  const to = s.notifications.orderEmail || s.contact.email;
  const body = `<h2 style="margin-top:0">New order #${esc(order.number)}</h2>
    <p>${esc(order.customerName)} · ${esc(order.email)} · ${esc(order.phone)}<br>Payment: ${esc(order.paymentMethod)}</p>
    ${orderTable(order, s)}
    <p><a href="${config.publicUrl}/admin/orders/${order.id}">Open in admin</a></p>`;
  return sendMail({ to, subject: `New order #${order.number} – ${formatMoney(order.total, s)}`, html: layout(s, body) });
}

export async function sendStatusUpdate(order) {
  const s = await getSettings();
  const gr = el(s);
  const statusText = STATUS_TEXT[gr ? 'el' : 'en'][order.status];
  const tracking = order.trackingNumber
    ? `<p>${gr ? 'Αριθμός αποστολής' : 'Tracking number'}: <strong>${esc(order.trackingNumber)}</strong></p>`
    : '';
  const body = `<h2 style="margin-top:0">${gr ? 'Ενημέρωση παραγγελίας' : 'Order update'} #${esc(order.number)}</h2>
    <p>${gr ? 'Η κατάσταση της παραγγελίας σας είναι τώρα' : 'Your order status is now'}: <strong>${statusText}</strong></p>
    ${tracking}<p><a href="${orderLink(order)}">${gr ? 'Προβολή παραγγελίας' : 'View order'}</a></p>`;
  return sendMail({ to: order.email, subject: `#${order.number}: ${statusText}`, html: layout(s, body) });
}

export async function sendPasswordReset(user, token) {
  const s = await getSettings();
  const gr = el(s);
  const link = `${config.publicUrl}/account/reset?token=${token}`;
  const body = `<p>${gr ? 'Λάβαμε αίτημα επαναφοράς κωδικού.' : 'We received a request to reset your password.'}</p>
    <p><a href="${link}">${gr ? 'Ορισμός νέου κωδικού' : 'Choose a new password'}</a></p>
    <p style="color:#71717a;font-size:13px">${
      gr ? 'Ο σύνδεσμος λήγει σε 1 ώρα. Αν δεν το ζητήσατε εσείς, αγνοήστε αυτό το email.' : 'The link expires in 1 hour. If you did not ask for this, ignore this email.'
    }</p>`;
  return sendMail({ to: user.email, subject: gr ? 'Επαναφορά κωδικού' : 'Password reset', html: layout(s, body) });
}

export async function sendContactMessage(msg) {
  const s = await getSettings();
  const body = `<p><strong>${esc(msg.name)}</strong> &lt;${esc(msg.email)}&gt; ${esc(msg.phone)}</p><p style="white-space:pre-line">${esc(msg.message)}</p>`;
  return sendMail({ to: s.contact.email, subject: `Contact form: ${msg.name}`, html: layout(s, body), replyTo: msg.email });
}

export async function sendWelcome(user) {
  const s = await getSettings();
  const gr = el(s);
  const body = `<h2 style="margin-top:0">${gr ? 'Καλώς ήρθατε' : 'Welcome'}, ${esc(user.name)}!</h2>
    <p>${gr ? 'Ο λογαριασμός σας στο' : 'Your account at'} <strong>${esc(s.storeName)}</strong> ${gr ? 'δημιουργήθηκε.' : 'is ready.'}</p>
    <p>${gr ? 'Από τον λογαριασμό σας μπορείτε να βλέπετε τις παραγγελίες σας και να αποθηκεύσετε τη διεύθυνσή σας για γρηγορότερες αγορές.' : 'From your account you can follow your orders and save your address for faster checkout.'}</p>
    <p style="margin-top:24px"><a href="${config.publicUrl}/products" style="background:${esc(s.theme.primary)};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${
      gr ? 'Ξεκινήστε τις αγορές' : 'Start shopping'
    }</a></p>`;
  return sendMail({ to: user.email, subject: gr ? `Καλώς ήρθατε στο ${s.storeName}` : `Welcome to ${s.storeName}`, html: layout(s, body) });
}
