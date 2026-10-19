import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Info } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { FONT_OPTIONS, applyTheme, useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Field, PageLoader, Spinner, fieldErrors } from '../components/ui.jsx';
import { ImageUploader, MoneyInput, PageHeader, Toggle } from './components.jsx';

const PRESETS = [
  ['Classic', { primary: '#111827', accent: '#2563eb', background: '#ffffff', surface: '#f6f7f9', text: '#111827' }],
  ['Forest', { primary: '#14532d', accent: '#16a34a', background: '#ffffff', surface: '#f3f7f4', text: '#0f1f14' }],
  ['Ocean', { primary: '#0c4a6e', accent: '#0891b2', background: '#ffffff', surface: '#f0f7fa', text: '#0b2533' }],
  ['Rose', { primary: '#9f1239', accent: '#e11d48', background: '#fffbfb', surface: '#fdf2f4', text: '#2a0a12' }],
  ['Sand', { primary: '#78350f', accent: '#d97706', background: '#fffdf8', surface: '#f8f3ea', text: '#2b1a08' }],
  ['Violet', { primary: '#4c1d95', accent: '#7c3aed', background: '#ffffff', surface: '#f6f4fd', text: '#1e1033' }],
];

function ColorField({ label, value, onChange }) {
  return (
    <div className="field color-field">
      <label>{label}</label>
      <div className="color-input">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} />
      </div>
    </div>
  );
}

function General({ s, set }) {
  return (
    <>
      <section className="card">
        <h3>{t('Store')}</h3>
        <div className="grid-2">
          <Field label={t('Store name')} value={s.storeName} onChange={(e) => set('storeName', e.target.value)} />
          <Field label={t('Tagline')} value={s.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>{t('Logo')}</label>
            <ImageUploader multiple={false} kind="logo" value={s.logoUrl ? [s.logoUrl] : []} onChange={(v) => set('logoUrl', v[0] || '')} />
            <span className="field-hint">{t('PNG or SVG with transparent background works best. Without a logo the store name is shown.')}</span>
          </div>
          <div className="field">
            <label>{t('Browser icon (favicon)')}</label>
            <ImageUploader multiple={false} kind="logo" value={s.faviconUrl ? [s.faviconUrl] : []} onChange={(v) => set('faviconUrl', v[0] || '')} />
            <span className="field-hint">{t('Square image. If empty, the logo is used.')}</span>
          </div>
        </div>
      </section>
      <section className="card">
        <h3>{t('Region')}</h3>
        <div className="grid-3">
          <Field as="select" label={t('Language')} value={s.language} onChange={(e) => set('language', e.target.value)}>
            <option value="el">Ελληνικά</option>
            <option value="en">English</option>
          </Field>
          <Field as="select" label={t('Currency')} value={s.currency} onChange={(e) => set('currency', e.target.value)}>
            {['EUR', 'USD', 'GBP', 'CHF', 'RON', 'BGN', 'PLN', 'CZK', 'SEK', 'DKK', 'NOK'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Field>
          <Field as="select" label={t('Number & date format')} value={s.locale} onChange={(e) => set('locale', e.target.value)}>
            {[
              ['el-GR', 'Ελλάδα (1.234,50 €)'],
              ['el-CY', 'Κύπρος (1.234,50 €)'],
              ['en-IE', 'Ireland (€1,234.50)'],
              ['en-GB', 'UK (£1,234.50)'],
              ['en-US', 'US ($1,234.50)'],
              ['de-DE', 'Deutschland (1.234,50 €)'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Field>
        </div>
      </section>
      <section className="card">
        <h3>{t('Contact details')}</h3>
        <p className="muted small">{t('Shown in the footer, the contact page and emails.')}</p>
        <div className="grid-2">
          <Field label={t('Email')} value={s.contact.email} onChange={(e) => set('contact.email', e.target.value)} />
          <Field label={t('Phone')} value={s.contact.phone} onChange={(e) => set('contact.phone', e.target.value)} />
        </div>
        <div className="grid-2">
          <Field label={t('Address')} value={s.contact.address} onChange={(e) => set('contact.address', e.target.value)} />
          <Field label={t('Opening hours')} value={s.contact.hours} onChange={(e) => set('contact.hours', e.target.value)} />
        </div>
        <h3 className="mt">{t('Social media')}</h3>
        <div className="grid-3">
          <Field label="Facebook" value={s.social.facebook} onChange={(e) => set('social.facebook', e.target.value)} placeholder="https://facebook.com/…" />
          <Field label="Instagram" value={s.social.instagram} onChange={(e) => set('social.instagram', e.target.value)} placeholder="https://instagram.com/…" />
          <Field label="TikTok" value={s.social.tiktok} onChange={(e) => set('social.tiktok', e.target.value)} placeholder="https://tiktok.com/@…" />
        </div>
      </section>
    </>
  );
}

function Appearance({ s, set }) {
  const th = s.theme;
  return (
    <section className="card">
      <h3>{t('Colour presets')}</h3>
      <div className="presets">
        {PRESETS.map(([name, p]) => (
          <button key={name} type="button" className="preset" onClick={() => set('theme', { ...th, ...p })}>
            <span style={{ background: p.primary }} />
            <span style={{ background: p.accent }} />
            <span style={{ background: p.surface }} />
            {name}
          </button>
        ))}
      </div>
      <h3 className="mt">{t('Colours')}</h3>
      <p className="muted small">{t('Changes preview live on this page. Save to publish them.')}</p>
      <div className="color-grid">
        <ColorField label={t('Primary (buttons, header bar)')} value={th.primary} onChange={(v) => set('theme.primary', v)} />
        <ColorField label={t('Accent (links, highlights)')} value={th.accent} onChange={(v) => set('theme.accent', v)} />
        <ColorField label={t('Background')} value={th.background} onChange={(v) => set('theme.background', v)} />
        <ColorField label={t('Surface (cards, sections)')} value={th.surface} onChange={(v) => set('theme.surface', v)} />
        <ColorField label={t('Text')} value={th.text} onChange={(v) => set('theme.text', v)} />
      </div>
      <div className="grid-2 mt">
        <Field as="select" label={t('Font')} value={th.font} onChange={(e) => set('theme.font', e.target.value)}>
          {FONT_OPTIONS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </Field>
        <div className="field">
          <label>
            {t('Corner roundness')}: {th.radius}px
          </label>
          <input type="range" min="0" max="24" value={th.radius} onChange={(e) => set('theme.radius', Number(e.target.value))} />
        </div>
      </div>
      <div className="theme-preview">
        <button type="button" className="btn btn-primary">
          {t('Add to cart')}
        </button>
        <button type="button" className="btn btn-outline">
          {t('View cart')}
        </button>
        <a href="#preview" onClick={(e) => e.preventDefault()} className="link-btn">
          {t('A link')}
        </a>
        <span className="badge badge-sale">-20%</span>
      </div>
    </section>
  );
}

function HomeTab({ s, set }) {
  return (
    <>
      <section className="card">
        <h3>{t('Announcement bar')}</h3>
        <Field
          value={s.announcement}
          onChange={(e) => set('announcement', e.target.value)}
          placeholder={t('e.g. Free shipping over 50€')}
          hint={t('A thin bar at the very top of every page. Leave empty to hide it.')}
        />
      </section>
      <section className="card">
        <h3>{t('Hero banner')}</h3>
        <Field label={t('Title')} value={s.hero.title} onChange={(e) => set('hero.title', e.target.value)} />
        <Field as="textarea" rows={2} label={t('Subtitle')} value={s.hero.subtitle} onChange={(e) => set('hero.subtitle', e.target.value)} />
        <div className="grid-2">
          <Field label={t('Button text')} value={s.hero.ctaText} onChange={(e) => set('hero.ctaText', e.target.value)} />
          <Field label={t('Button link')} value={s.hero.ctaLink} onChange={(e) => set('hero.ctaLink', e.target.value)} placeholder="/products" />
        </div>
        <div className="field">
          <label>{t('Background image (optional)')}</label>
          <ImageUploader multiple={false} value={s.hero.imageUrl ? [s.hero.imageUrl] : []} onChange={(v) => set('hero.imageUrl', v[0] || '')} />
          <span className="field-hint">{t('Wide image, at least 1600px. Text is shown in white over it.')}</span>
        </div>
      </section>
    </>
  );
}

function Checkout({ s, set, meta, pages }) {
  return (
    <>
      <section className="card">
        <h3>{t('Payment methods')}</h3>
        <div className="pay-block">
          <Toggle checked={s.payments.card.enabled} onChange={(v) => set('payments.card.enabled', v)} label={t('Credit / debit card')} hint={t('Via Stripe. Money goes straight to your Stripe account.')} />
          {s.payments.card.enabled && !meta.stripeConfigured && (
            <p className="notice small">
              <Info size={16} /> {t('Stripe keys are not configured on the server yet, so card payments are hidden from customers.')}
            </p>
          )}
        </div>
        <div className="pay-block">
          <Toggle checked={s.payments.cod.enabled} onChange={(v) => set('payments.cod.enabled', v)} label={t('Cash on delivery')} />
          {s.payments.cod.enabled && (
            <div className="field indent">
              <label>{t('Extra fee')}</label>
              <MoneyInput value={s.payments.cod.fee} onChange={(v) => set('payments.cod.fee', v)} />
            </div>
          )}
        </div>
        <div className="pay-block">
          <Toggle checked={s.payments.bank.enabled} onChange={(v) => set('payments.bank.enabled', v)} label={t('Bank transfer')} />
          {s.payments.bank.enabled && (
            <Field
              className="indent"
              as="textarea"
              rows={4}
              label={t('Bank details shown to the customer')}
              value={s.payments.bank.details}
              onChange={(e) => set('payments.bank.details', e.target.value)}
              placeholder={'Τράπεζα: …\nIBAN: GR…\nΔικαιούχος: …'}
            />
          )}
        </div>
      </section>
      <section className="card">
        <h3>{t('Checkout')}</h3>
        <Toggle checked={s.checkout.allowGuest} onChange={(v) => set('checkout.allowGuest', v)} label={t('Allow guest checkout')} hint={t('Recommended: customers can order without creating an account.')} />
        <Toggle checked={s.checkout.requirePhone} onChange={(v) => set('checkout.requirePhone', v)} label={t('Phone number is required')} />
        <Toggle checked={s.checkout.pricesIncludeTax} onChange={(v) => set('checkout.pricesIncludeTax', v)} label={t('Show “Price includes VAT”')} />
        <div className="grid-2 mt">
          <Field as="select" label={t('Terms page')} value={s.checkout.termsPage} onChange={(e) => set('checkout.termsPage', e.target.value)}>
            <option value="">—</option>
            {pages.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </Field>
          <Field label={t('Order number prefix')} value={s.orderPrefix} onChange={(e) => set('orderPrefix', e.target.value.toUpperCase())} placeholder="e.g. AB-" hint={t('Order numbers look like {n}', { n: `${s.orderPrefix}1001` })} />
        </div>
      </section>
      <section className="card">
        <h3>{t('Inventory')}</h3>
        <div className="grid-2">
          <Field
            label={t('Low stock warning at')}
            type="number"
            min="0"
            value={s.inventory.lowStockThreshold}
            onChange={(e) => set('inventory.lowStockThreshold', Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
        <Toggle checked={s.inventory.hideOutOfStock} onChange={(v) => set('inventory.hideOutOfStock', v)} label={t('Hide sold-out products from the shop')} />
      </section>
    </>
  );
}

function Advanced({ s, set, meta }) {
  return (
    <>
      <section className="card">
        <h3>{t('Notifications')}</h3>
        <Field
          label={t('Send new order emails to')}
          type="email"
          value={s.notifications.orderEmail}
          onChange={(e) => set('notifications.orderEmail', e.target.value)}
          placeholder={s.contact.email}
          hint={t('If empty, the contact email is used.')}
        />
        {!meta.smtpConfigured && (
          <p className="notice small">
            <Info size={16} /> {t('Email (SMTP) is not configured on the server, so emails are not sent yet.')}
          </p>
        )}
      </section>
      <section className="card">
        <h3>{t('Search engines (SEO)')}</h3>
        <Field label={t('Page title')} value={s.seo.title} onChange={(e) => set('seo.title', e.target.value)} placeholder={s.storeName} />
        <Field as="textarea" rows={3} label={t('Description')} value={s.seo.description} onChange={(e) => set('seo.description', e.target.value)} placeholder={s.tagline} hint={t('About 150 characters, shown in Google results.')} />
      </section>
    </>
  );
}

const setPath = (obj, path, value) => {
  const [head, ...rest] = path.split('.');
  return { ...obj, [head]: rest.length ? setPath(obj[head], rest.join('.'), value) : value };
};

export default function Settings() {
  const { data, setData } = useFetch('/admin/settings');
  const { settings: live, pages, reload } = useShop();
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (data) setS(data);
  }, [data]);
  // Live-preview colours; restore the published theme when leaving.
  useEffect(() => {
    if (s) applyTheme(s.theme);
  }, [s?.theme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => applyTheme(live.theme), [live.theme]);

  if (!s) return <PageLoader />;
  const set = (path, value) => setS((cur) => setPath(cur, path, value));
  const dirty = JSON.stringify(s) !== JSON.stringify(data);

  const save = async () => {
    setSaving(true);
    try {
      const { _meta, ...body } = s;
      const saved = await api.put('/admin/settings', body);
      setData({ ...saved, _meta });
      setErrors({});
      await reload();
      toast.success(t('Settings saved'));
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      toast.error(Object.keys(err.details || {}).length ? `${t('Please check')}: ${Object.keys(err.details).join(', ')}` : err.message);
    } finally {
      setSaving(false);
    }
  };

  const props = { s, set, meta: s._meta || {}, pages, errors };
  return (
    <>
      <PageHeader
        title={t('Settings')}
        actions={
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving && <Spinner />} {dirty ? t('Save changes') : t('Saved')}
          </button>
        }
      />
      <nav className="tabs">
        <NavLink to="/admin/settings" end>
          {t('General')}
        </NavLink>
        <NavLink to="/admin/settings/appearance">{t('Appearance')}</NavLink>
        <NavLink to="/admin/settings/home">{t('Home page')}</NavLink>
        <NavLink to="/admin/settings/checkout">{t('Checkout & payments')}</NavLink>
        <NavLink to="/admin/settings/advanced">{t('Emails & SEO')}</NavLink>
      </nav>
      <div className="stack settings-body">
        <Routes>
          <Route index element={<General {...props} />} />
          <Route path="appearance" element={<Appearance {...props} />} />
          <Route path="home" element={<HomeTab {...props} />} />
          <Route path="checkout" element={<Checkout {...props} />} />
          <Route path="advanced" element={<Advanced {...props} />} />
          <Route path="*" element={<Navigate to="/admin/settings" replace />} />
        </Routes>
      </div>
      {dirty && (
        <div className="save-bar">
          <span>{t('You have unsaved changes')}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setS(data)}>
            {t('Discard')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {t('Save changes')}
          </button>
        </div>
      )}
    </>
  );
}
