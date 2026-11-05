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
      // Locally, show the links (password reset, order page…) so they can be opened from the terminal.
      if (!config.isProd) for (const [, href] of html.matchAll(/href="([^"]+)"/g)) console.log(`[mail]   link: ${href.replaceAll('&amp;', '&')}`);
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
    ${footer(settings)}
  </div></body></html>`;
}

const SOCIAL = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
];

/** Shop contact details and social links (text, not icons: many inboxes block images). */
function footer(settings) {
  const contact = [settings.contact.email, settings.contact.phone].filter(Boolean).map(esc).join(' · ');
  const social = SOCIAL.filter(([key]) => settings.social?.[key])
    .map(([key, name]) => `<a href="${esc(settings.social[key])}" style="color:#52525b;text-decoration:underline">${name}</a>`)
    .join(' &nbsp;·&nbsp; ');
  if (!contact && !social) return '';
  return `<div style="text-align:center;color:#71717a;font-size:12px;line-height:1.8;padding-top:12px">
    ${contact ? `<div>${contact}</div>` : ''}${social ? `<div>${social}</div>` : ''}</div>`;
}


const button = (href, label, color) =>
  `<a href="${href}" style="background:${esc(color)};color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(label)}</a>`;
const p = (html) => `<p>${html}</p>`;
const heading = (text) => `<h2 style="margin-top:0">${esc(text)}</h2>`;
const small = (html) => `<p style="color:#71717a;font-size:13px">${html}</p>`;
/** "Μαρία" rather than "Μαρία Παπαδοπούλου" in greetings. */
const firstName = (name) => String(name ?? '').trim().split(/\s+/)[0];
const num = (order) => `<strong>#${esc(order.number)}</strong>`;

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
    ${line(order.address ? `${t('Shipping')} (${esc(order.shippingName)})` : esc(order.shippingName), order.shippingCost ? m(order.shippingCost) : t('Free'))}
    ${order.paymentFee ? line(t('Payment fee'), m(order.paymentFee)) : ''}
    <tr><td style="padding:8px 0;font-weight:bold;border-top:1px solid #e4e4e7">${t('Total')}</td>
    <td style="padding:8px 0;font-weight:bold;text-align:right;border-top:1px solid #e4e4e7">${m(order.total)}</td></tr></table>`;
}

/** Where the order goes: the delivery address, or the shop's address for store pickup. */
function deliveryBlock(order, settings, t) {
  const a = order.address;
  if (a) {
    return `<p style="margin-top:20px"><strong>${t('Delivery address')}</strong><br>${esc(order.customerName)}<br>${esc(a.street)}<br>${esc(a.postalCode)} ${esc(a.city)}${a.region ? `, ${esc(a.region)}` : ''}</p>`;
  }
  const c = settings.contact;
  return `<p style="margin-top:20px"><strong>${t('Pickup from the store')}</strong>${c.address ? `<br>${esc(c.address)}` : ''}${c.hours ? `<br>${esc(c.hours)}` : ''}</p>`;
}

/** Tracking number and/or the courier's tracking link, in a grey box. Empty when there is neither. */
function trackingBlock(order, t, settings) {
  const { trackingNumber: number, trackingUrl: url } = order;
  if (!number && !url) return '';
  const numberLine = number ? `${t('Tracking number')}: <strong>${esc(number)}</strong><br>` : '';
  const help = url
    ? t('Press the button to see where your parcel is right now.')
    : t('You can use it on the courier website to see where your parcel is.');
  const link = url ? `<p style="margin:12px 0 0">${button(esc(url), t('Track your parcel'), settings.theme.primary)}</p>` : '';
  return `<div style="background:#f4f4f5;border-radius:8px;padding:12px 16px;margin:16px 0">${numberLine}
    <span style="color:#52525b;font-size:13px">${help}</span>${link}</div>`;
}

const orderLink = (order) => `${config.publicUrl}/order/${order.number}?token=${order.accessToken}`;

/** Common frame of the emails to a customer about their order. Replies go to the shop. */
async function sendOrderEmail(order, build) {
  const s = await getSettings();
  const t = translator(order.language || s.language);
  const total = formatMoney(order.total, s);
  const { subject, title, body, details = true } = build({ s, t, total, pickup: !order.address, cod: order.paymentMethod === 'cod' });
  const html = `${heading(title)}
    ${p(t('Hi {name},', { name: esc(firstName(order.customerName)) }))}
    ${body}
    ${details ? orderTable(order, s, t) + deliveryBlock(order, s, t) : ''}
    <p style="margin-top:24px">${button(orderLink(order), t('View order'), s.theme.primary)}</p>`;
  return sendMail({ to: order.email, subject, html: layout(s, html), replyTo: s.contact.email || undefined });
}

/** Sent once per order: right away for cash on delivery, after payment for card orders. */
export function sendOrderConfirmation(order) {
  return sendOrderEmail(order, ({ t, total, pickup, cod }) => {
    const paid = order.paymentStatus === 'paid';
    const next = cod
      ? t('We will keep you posted by email on its progress.')
      : pickup
        ? t('We will email you again as soon as it is ready for pickup.')
        : t('We will email you again as soon as it ships.');
    return {
      subject: paid ? t('Your order #{number} is confirmed', { number: order.number }) : t('We received your order #{number}', { number: order.number }),
      title: paid ? t('Your order is confirmed') : t('Thank you for your order!'),
      body: `${p(paid ? t('We received your payment and your order {number} is confirmed.', { number: num(order) }) : t('We received your order {number}.', { number: num(order) }))}
        ${cod ? p(t('You will pay {total} in cash when you receive it.', { total: `<strong>${total}</strong>` })) : ''}
        ${p(next)}`,
    };
  });
}

/**
 * One email per change the admin makes (when "notify the customer" is ticked):
 * a status change, or a tracking number / tracking link added to an order already shipped.
 */
export function sendStatusUpdate(order, before) {
  const trackingOnly = before && order.status === before.status;
  return sendOrderEmail(order, ({ s, t, total, pickup, cod }) => {
    const n = { number: order.number };
    const nb = { number: num(order) };
    if (trackingOnly) {
      const linkOnly = !order.trackingNumber;
      return {
        subject: linkOnly ? t('Follow the parcel of your order #{number}', n) : t('Tracking number for your order #{number}', n),
        title: t('Track your order'),
        body:
          p(linkOnly ? t('You can now follow the parcel of your order {number}.', nb) : t('Here is the tracking number for your order {number}:', nb)) +
          trackingBlock(order, t, s),
        details: false,
      };
    }
    switch (order.status) {
      case 'processing':
        return {
          subject: t('We are preparing your order #{number}', n),
          title: t('We are preparing your order'),
          body: p(t('Your order {number} is confirmed and we are now preparing it.', nb)) +
            p(pickup ? t('We will email you again as soon as it is ready for pickup.') : t('We will email you again as soon as it ships.')),
        };
      case 'shipped':
        if (pickup) {
          return {
            subject: t('Your order #{number} is ready for pickup', n),
            title: t('Your order is ready for pickup'),
            body: p(t('Your order {number} is ready and waiting for you at the store.', nb)) +
              (cod ? p(t('The amount to pay at pickup is {total}.', { total: `<strong>${total}</strong>` })) : ''),
          };
        }
        return {
          subject: t('Your order #{number} is on its way', n),
          title: t('Your order is on its way'),
          body: p(t('Good news: your order {number} has been sent with {courier} and is on its way to you.', { ...nb, courier: esc(order.shippingName) })) +
            trackingBlock(order, t, s) +
            (cod ? p(t('Please have {total} ready in cash for the courier.', { total: `<strong>${total}</strong>` })) : ''),
        };
      case 'delivered':
        return {
          subject: t('Your order #{number} has been delivered', n),
          title: t('Thank you for shopping with us!'),
          body: p(t('Your order {number} has been delivered.', nb)) +
            p(t('We hope you enjoy your purchase! If anything is not right, just reply to this email and we will sort it out.')),
          details: false,
        };
      case 'cancelled': {
        const refund =
          order.paymentStatus === 'refunded'
            ? t('The amount of {total} has been refunded to your card. Depending on your bank, it may take a few business days to show.', { total: `<strong>${total}</strong>` })
            : order.paymentStatus === 'paid'
              ? t('Since you have already paid, we will refund {total} to your card.', { total: `<strong>${total}</strong>` })
              : '';
        return {
          subject: t('Your order #{number} has been cancelled', n),
          title: t('Your order has been cancelled'),
          body: p(t('Your order {number} has been cancelled.', nb)) + (refund ? p(refund) : '') + p(t('If you have any questions, just reply to this email.')),
          details: false,
        };
      }
      default:
        return {
          subject: t('Update on your order #{number}', n),
          title: t('Your order is active again'),
          body: p(t('Your order {number} is active again.', nb)) + p(t('We will keep you posted by email on its progress.')),
        };
    }
  });
}

/** Sent to the shop owner; always in the shop's language. Replying writes to the customer. */
export async function sendAdminNewOrder(order) {
  const s = await getSettings();
  const t = translator(s.language);
  const to = s.notifications.orderEmail || s.contact.email;
  const total = formatMoney(order.total, s);
  const payment =
    order.paymentMethod === 'cod'
      ? t('Cash on delivery – collect {total}', { total })
      : order.paymentStatus === 'paid'
        ? t('Card – paid')
        : t('Card – awaiting payment');
  const body = `${heading(`${t('New order')} #${order.number}`)}
    <p><strong>${t('Customer')}</strong><br>${esc(order.customerName)}<br>${esc(order.email)}${order.phone ? `<br>${esc(order.phone)}` : ''}</p>
    <p><strong>${t('Payment')}</strong><br>${esc(payment)}</p>
    ${deliveryBlock(order, s, t)}
    ${order.notes ? `<p><strong>${t('Customer notes')}</strong><br><span style="white-space:pre-line">${esc(order.notes)}</span></p>` : ''}
    ${orderTable(order, s, t)}
    <p style="margin-top:24px">${button(`${config.publicUrl}/admin/orders/${order.id}`, t('Open in admin'), s.theme.primary)}</p>`;
  return sendMail({ to, subject: `${t('New order')} #${order.number} – ${total}`, html: layout(s, body), replyTo: order.email });
}

const confirmEmailBlock = (t, s, token) => `${p(t('Please confirm your email address, so we can link your earlier orders and keep your account safe.'))}
  <p style="margin-top:24px">${button(`${config.publicUrl}/account/verify?token=${token}`, t('Confirm my email'), s.theme.primary)}</p>
  ${small(t('The link expires in 7 days. If you did not create this account, ignore this email.'))}`;

export async function sendEmailConfirmation(user, token, lang) {
  const s = await getSettings();
  const t = translator(lang || s.language);
  const body = `${p(t('Hi {name},', { name: esc(firstName(user.name)) }))}${confirmEmailBlock(t, s, token)}`;
  return sendMail({ to: user.email, subject: t('Confirm your email for {store}', { store: s.storeName }), html: layout(s, body) });
}

export async function sendPasswordReset(user, token, lang) {
  const s = await getSettings();
  const t = translator(lang || s.language);
  const link = `${config.publicUrl}/account/reset?token=${token}`;
  const body = `${p(t('Hi {name},', { name: esc(firstName(user.name)) }))}
    ${p(t('We received a request to change your password. Press the button below to choose a new one.'))}
    <p style="margin-top:24px">${button(link, t('Choose a new password'), s.theme.primary)}</p>
    ${small(t('The link expires in 1 hour. If you did not ask for this, ignore this email: your password will not change.'))}`;
  return sendMail({ to: user.email, subject: t('Change your password – {store}', { store: s.storeName }), html: layout(s, body) });
}

/** Contact form message to the shop. Replying answers the visitor directly. */
export async function sendContactMessage(msg) {
  const s = await getSettings();
  const t = translator(s.language);
  const body = `${small(t('New message from the contact form'))}
    ${heading(msg.subject)}
    <p><strong>${esc(msg.name)}</strong><br>${esc(msg.email)}${msg.phone ? `<br>${esc(msg.phone)}` : ''}</p>
    <p style="white-space:pre-line;overflow-wrap:anywhere;word-break:break-word;background:#f4f4f5;border-radius:8px;padding:12px 16px">${esc(msg.message)}</p>
    ${small(t('Reply to this email to answer {name} directly.', { name: esc(msg.name) }))}`;
  return sendMail({ to: s.contact.email, subject: `${msg.subject} – ${msg.name}`, html: layout(s, body), replyTo: msg.email });
}

/** Welcome email. With `verifyToken` (email & password sign-up) it also asks to confirm the address. */
export async function sendWelcome(user, lang, verifyToken) {
  const s = await getSettings();
  const t = translator(lang || s.language);
  const action = verifyToken
    ? confirmEmailBlock(t, s, verifyToken)
    : `<p style="margin-top:24px">${button(`${config.publicUrl}/products`, t('Start shopping'), s.theme.primary)}</p>`;
  const body = `${heading(t('Welcome, {name}!', { name: firstName(user.name) }))}
    ${p(t('Your account at {store} is ready.', { store: `<strong>${esc(s.storeName)}</strong>` }))}
    ${p(t('From your account you can follow your orders and save your address for faster checkout.'))}
    ${action}`;
  return sendMail({ to: user.email, subject: t('Welcome to {store}', { store: s.storeName }), html: layout(s, body) });
}
