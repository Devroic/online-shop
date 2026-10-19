import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, LoaderCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';

export function Spinner({ size = 20 }) {
  return <LoaderCircle size={size} className="spin" aria-hidden="true" />;
}

export function PageLoader() {
  return (
    <div className="page-loader" aria-busy="true">
      <Spinner size={28} />
    </div>
  );
}

export function useTitle(title) {
  const { settings } = useShop();
  useEffect(() => {
    const store = settings?.storeName || '';
    document.title = title ? `${title} | ${store}` : settings?.seo?.title || store;
  }, [title, settings]);
}

export function Price({ price, compareAt, from, className = '' }) {
  return (
    <span className={`price ${className}`}>
      {from && <span className="price-from">{t('from')} </span>}
      <span className={compareAt > price ? 'price-sale' : ''}>{money(price)}</span>
      {compareAt > price && <s className="price-compare">{money(compareAt)}</s>}
    </span>
  );
}

export function QuantityStepper({ value, onChange, max, min = 1, size = 'md' }) {
  return (
    <div className={`qty qty-${size}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={t('Decrease quantity')}>
        <Minus size={16} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max ?? undefined}
        aria-label={t('Quantity')}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.max(min, max != null ? Math.min(n, max) : n));
        }}
      />
      <button type="button" onClick={() => onChange(value + 1)} disabled={max != null && value >= max} aria-label={t('Increase quantity')}>
        <Plus size={16} />
      </button>
    </div>
  );
}

/** Labelled input with inline error. Pass `as="textarea"` or `as="select"`. */
export function Field({ label, error, hint, as: Tag = 'input', className = '', children, ...props }) {
  const id = useId();
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <Tag id={id} aria-invalid={!!error} {...props}>
        {children}
      </Tag>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={28} />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="icon-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('Previous')}>
        <ChevronLeft size={18} />
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="pagination-gap">…</span>
        ) : (
          <button key={n} className={n === page ? 'active' : ''} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>
            {n}
          </button>
        ),
      )}
      <button className="icon-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t('Next')}>
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="product-card skeleton-card">
          <div className="skeleton product-card-media" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">{t('Home')}</Link>
      {items.map((it, i) => (
        <span key={i}>
          <ChevronRight size={14} />
          {it.to ? <Link to={it.to}>{it.label}</Link> : <span aria-current="page">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Translates API validation details (field → code) into readable messages. */
export function fieldErrors(err) {
  const out = {};
  for (const [k, v] of Object.entries(err?.details || {})) {
    if (typeof v !== 'string') continue;
    const key = k.split('.').pop();
    out[key] =
      v === 'required'
        ? t('This field is required')
        : v === 'exists'
          ? t('Already in use')
          : v === 'wrong'
            ? t('Incorrect')
            : /email/i.test(v)
              ? t('Enter a valid email')
              : /at least 8/.test(v)
                ? t('At least 8 characters')
                : /accept the terms/.test(v)
                  ? t('Please accept the terms')
                  : t('Please check this field');
  }
  return out;
}

const svg = (path) =>
  function Icon({ size = 20 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={path} />
      </svg>
    );
  };

export const FacebookIcon = svg('M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2C16.7 2.1 15.6 2 14.4 2 11.8 2 10 3.6 10 6.5v2H7.3v3.7H10V22h4v-9.8h2.8l.4-3.7H14z');
export const InstagramIcon = svg('M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zm0 4.7a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2zm0 8.4a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6zm5.3-9.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z');
export const TiktokIcon = svg('M16.6 2h-3.3v13.4a2.9 2.9 0 1 1-2-2.7V9.3a6.2 6.2 0 1 0 5.3 6.1V8.7a7.6 7.6 0 0 0 4.4 1.4V6.8a4.4 4.4 0 0 1-4.4-4.4V2z');
