/**
 * Vercel Web Analytics: page views only, no cookies. Before anything is sent, the
 * address is cleaned so it never carries private data:
 * - the admin panel is not counted at all;
 * - query strings and #fragments are dropped (order links carry an access token,
 *   password-reset and sign-in links carry codes);
 * - an order's number is replaced, so one customer's visits cannot be followed.
 */
export function cleanPageView(event) {
  let url;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return null;
  const path = url.pathname.replace(/^\/order\/[^/]+/, '/order/[number]');
  return { ...event, url: `${url.origin}${path}` };
}
