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

let lastPath = null;

/**
 * Counts a page view for the shop's own statistics (Admin → Dashboard). Only the
 * page's path is sent, never its query or #; where the visitor came from is sent
 * with the first page of a visit only. Never throws and never slows the page.
 */
export function trackView(pathname) {
  if (pathname === lastPath || pathname === '/admin' || pathname.startsWith('/admin/')) return;
  lastPath = pathname;
  let referrer = '';
  try {
    if (!sessionStorage.getItem('shop.visit')) {
      sessionStorage.setItem('shop.visit', '1');
      referrer = document.referrer || '';
    }
  } catch {
    /* storage blocked: the source is simply unknown */
  }
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, referrer }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* an old browser: no count */
  }
}
