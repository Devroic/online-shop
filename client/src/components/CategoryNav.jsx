import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { t } from '../lib/i18n.js';

const GAP = 4; // .main-nav gap
const MORE_WIDTH = 130; // room kept for the "More" button when not everything fits

/** How many categories fit next to "All products" in `width`; when not all do, room is kept for "More". */
export function fitCount(width, allWidth, catWidths) {
  const room = width - allWidth;
  if (catWidths.reduce((a, b) => a + b, 0) <= room) return catWidths.length;
  let used = 0;
  let n = 0;
  while (n < catWidths.length && used + catWidths[n] <= room - MORE_WIDTH) used += catWidths[n++];
  return n;
}

/**
 * Desktop category menu: as many categories as fit in full, the rest under
 * "More", so a name is never cut. A hidden copy of all the links is kept only
 * for measuring; the visible menu shows the first `count` of them.
 */
export default function CategoryNav({ categories }) {
  const navRef = useRef(null);
  const measureRef = useRef(null);
  const [count, setCount] = useState(categories.length);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const key = categories.map((c) => `${c.id}:${c.name}`).join('|');

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;
    const fit = () => {
      if (!nav.clientWidth) return; // hidden (phone layout)
      const [all = 0, ...cats] = [...measure.children].map((el) => el.offsetWidth + GAP);
      setCount(fitCount(nav.clientWidth, all, cats));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(nav);
    document.fonts?.ready.then(fit); // widths change once the web font loads
    return () => ro.disconnect();
  }, [key]);

  // Close the "More" list on navigation and on a click elsewhere.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !navRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const rest = categories.slice(count);

  return (
    <nav ref={navRef} className="main-nav only-desktop" aria-label={t('Categories')}>
      <div ref={measureRef} className="main-nav-measure" aria-hidden="true">
        <span>{t('All products')}</span>
        {categories.map((c) => (
          <span key={c.id}>{c.name}</span>
        ))}
      </div>
      <NavLink to="/products" end>
        {t('All products')}
      </NavLink>
      {categories.slice(0, count).map((c) => (
        <NavLink key={c.id} to={`/category/${c.slug}`}>
          {c.name}
        </NavLink>
      ))}
      {rest.length > 0 && (
        <div className="nav-more">
          <button type="button" className={`nav-more-btn ${open ? 'active' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {t('More')} <ChevronDown size={16} />
          </button>
          {open && (
            <div className="nav-more-list">
              {rest.map((c) => (
                <NavLink key={c.id} to={`/category/${c.slug}`}>
                  {c.name}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
