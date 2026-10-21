import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { FONT_OPTIONS, applyTheme, useShop } from '../context/ShopContext.jsx';
import { darkPalette } from '../lib/theme.js';
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

function ColorField({ label, value, onChange, placeholder }) {
  return (
    <div className="field color-field">
      <label>{label}</label>
      <div className="color-input">
        <input type="color" value={value || placeholder} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} maxLength={7} />
        {placeholder && value && (
          <button type="button" className="link-btn small" onClick={() => onChange('')}>
            {t('Auto')}
          </button>
        )}
      </div>
    </div>
  );
}

function Brand({ s, set }) {
  return (
    <section className="card">
      <h3>{t('Logo')}</h3>
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
  );
}

/** Admin → Store details: name, contact, emails, region, sign-in, stock, SEO. */
export function StoreDetails(props) {
  const { s, set } = props;
  return (
    <>
      <section className="card">
        <h3>{t('Store')}</h3>
        <div className="grid-2">
          <Field label={t('Store name')} value={s.storeName} onChange={(e) => set('storeName', e.target.value)} />
          <Field label={t('Tagline')} value={s.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </div>
      </section>
      <section className="card">
        <h3>{t('Region')}</h3>
        <div className="grid-3">
          <Field as="select" label={t('Default language')} value={s.language} onChange={(e) => set('language', e.target.value)}>
            <option value="el">{t('Greek')}</option>
            <option value="en">{t('English')}</option>
          </Field>
          <Field as="select" label={t('Currency')} value={s.currency} onChange={(e) => set('currency', e.target.value)}>
            {['EUR', 'USD', 'GBP', 'CHF', 'RON', 'BGN', 'PLN', 'CZK', 'SEK', 'DKK', 'NOK'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Field>
          <Field as="select" label={t('Number & date format')} value={s.locale} onChange={(e) => set('locale', e.target.value)}>
            {[
              ['el-GR', `${t('Greece')} (1.234,50 €)`],
              ['el-CY', `${t('Cyprus')} (1.234,50 €)`],
              ['en-IE', `${t('Ireland')} (€1,234.50)`],
              ['en-GB', `${t('United Kingdom')} (£1,234.50)`],
              ['en-US', `${t('United States')} ($1,234.50)`],
              ['de-DE', `${t('Germany')} (1.234,50 €)`],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Field>
        </div>
        <Toggle
          checked={s.languageSwitch}
          onChange={(v) => set('languageSwitch', v)}
          label={t('Let visitors switch between Greek and English')}
          hint={t('Menus, buttons and emails change language. Product names, descriptions and pages stay as you wrote them.')}
        />
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
      <Notifications {...props} />
      <CustomerSignIn {...props} />
      <Inventory {...props} />
      <Seo {...props} />
    </>
  );
}

/** Admin → Appearance: logo, light/dark mode, colours, font. */
export function Appearance({ s, set, preview, setPreview }) {
  const th = s.theme;
  const auto = darkPalette({ ...th, dark: {} });
  return (
    <>
      <Brand s={s} set={set} />
      <section className="card">
        <h3>{t('Light & dark appearance')}</h3>
        <div className="options">
          {[
            ['auto', t('Automatic (recommended)'), t('Follows each visitor’s device, with a light/dark switch in the header')],
            ['light', t('Always light'), ''],
            ['dark', t('Always dark'), ''],
          ].map(([v, label, hint]) => (
            <label key={v} className={`option ${th.mode === v ? 'active' : ''}`}>
              <input type="radio" name="mode" checked={th.mode === v} onChange={() => set('theme.mode', v)} />
              <div className="grow">
                <strong>{label}</strong>
                {hint && <div className="muted small">{hint}</div>}
              </div>
            </label>
          ))}
        </div>
      </section>
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
        {th.mode === 'auto' && (
          <div className="seg mt">
            <button type="button" className={preview === 'light' ? 'active' : ''} onClick={() => setPreview('light')}>
              {t('Preview light')}
            </button>
            <button type="button" className={preview === 'dark' ? 'active' : ''} onClick={() => setPreview('dark')}>
              {t('Preview dark')}
            </button>
          </div>
        )}
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
      {th.mode !== 'light' && (
        <section className="card">
          <h3>{t('Dark mode colours')}</h3>
          <p className="muted small">{t('Leave empty to have them calculated from the colours above.')}</p>
          <div className="color-grid">
            <ColorField label={t('Primary (buttons, header bar)')} value={th.dark.primary} placeholder={auto.primary} onChange={(v) => set('theme.dark.primary', v)} />
            <ColorField label={t('Accent (links, highlights)')} value={th.dark.accent} placeholder={auto.accent} onChange={(v) => set('theme.dark.accent', v)} />
            <ColorField label={t('Background')} value={th.dark.background} placeholder={auto.background} onChange={(v) => set('theme.dark.background', v)} />
            <ColorField label={t('Surface (cards, sections)')} value={th.dark.surface} placeholder={auto.surface} onChange={(v) => set('theme.dark.surface', v)} />
            <ColorField label={t('Text')} value={th.dark.text} placeholder={auto.text} onChange={(v) => set('theme.dark.text', v)} />
          </div>
        </section>
      )}
    </>
  );
}

/** Admin → Pages → Home page: announcement bar and hero banner. */
export function HomePage({ s, set }) {
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

/** Admin → Shipping & payments → Payments: payment methods and checkout options. */
export function Payments({ s, set, meta, pages }) {
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
    </>
  );
}

function CustomerSignIn({ s, set, meta }) {
  return (
    <section className="card">
      <h3>{t('Customer sign-in')}</h3>
      <p className="muted small">{t('Email & password sign-in is always available. Google and Apple sign-in must first be enabled in the shop’s Supabase project (see the setup guide).')}</p>
      <Toggle checked={s.login.google} onChange={(v) => set('login.google', v)} label={t('Sign in with Google')} />
      <Toggle checked={s.login.apple} onChange={(v) => set('login.apple', v)} label={t('Sign in with Apple')} hint={t('Requires an Apple Developer account (paid yearly by the shop owner).')} />
      {(s.login.google || s.login.apple) && !meta.socialLoginConfigured && (
        <p className="notice small">
          <Info size={16} /> {t('SUPABASE_URL and SUPABASE_ANON_KEY are not set on the server, so these buttons are hidden from customers.')}
        </p>
      )}
      {(s.login.google || s.login.apple) && meta.supabaseUrl && (
        <p className="muted small">
          {t('Redirect URL to add in Supabase → Authentication → URL Configuration:')} <code className="code">{window.location.origin}/auth/callback</code>
        </p>
      )}
    </section>
  );
}

function Inventory({ s, set }) {
  return (
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
  );
}

function Notifications({ s, set, meta }) {
  return (
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
      {!meta.emailConfigured && (
        <p className="notice small">
          <Info size={16} /> {t('Email sending (Resend or SMTP) is not configured on the server, so emails are not sent yet.')}
        </p>
      )}
    </section>
  );
}

function Seo({ s, set }) {
  return (
    <section className="card">
      <h3>{t('Search engines (SEO)')}</h3>
      <Field label={t('Page title')} value={s.seo.title} onChange={(e) => set('seo.title', e.target.value)} placeholder={s.storeName} />
      <Field as="textarea" rows={3} label={t('Description')} value={s.seo.description} onChange={(e) => set('seo.description', e.target.value)} placeholder={s.tagline} hint={t('About 150 characters, shown in Google results.')} />
    </section>
  );
}

const setPath = (obj, path, value) => {
  const [head, ...rest] = path.split('.');
  return { ...obj, [head]: rest.length ? setPath(obj[head], rest.join('.'), value) : value };
};

/**
 * Loads the shop settings, lets `render(props)` edit them and saves them all
 * together. Used by Appearance, Store details, Pages → Home page and
 * Shipping & payments → Payments.
 */
export function SettingsForm({ title, subtitle, tabs, render }) {
  const { data, setData } = useFetch('/admin/settings');
  const { settings: live, pages, reload, appearance } = useShop();
  const [preview, setPreview] = useState(appearance);
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (data) setS(data);
  }, [data]);
  // Live-preview colours; restore the published theme when leaving.
  useEffect(() => {
    if (s) applyTheme(s.theme, s.theme.mode === 'auto' ? preview : s.theme.mode);
  }, [s?.theme, preview]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => applyTheme(live.theme, appearance), [live.theme, appearance]);

  const set = (path, value) => setS((cur) => setPath(cur, path, value));
  const dirty = !!s && JSON.stringify(s) !== JSON.stringify(data);

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

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving && <Spinner />} {dirty ? t('Save changes') : t('Saved')}
          </button>
        }
      />
      {tabs}
      {!s ? (
        <PageLoader />
      ) : (
        <div className="stack settings-body">{render({ s, set, meta: s._meta || {}, pages, errors, preview, setPreview })}</div>
      )}
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

export function AppearancePage() {
  return <SettingsForm title={t('Appearance')} subtitle={t('Logo, colours, light/dark mode and font.')} render={(p) => <Appearance {...p} />} />;
}

export function StoreDetailsPage() {
  return (
    <SettingsForm
      title={t('Store details')}
      subtitle={t('Name, contact details, emails, customer sign-in, stock and search engines.')}
      render={(p) => <StoreDetails {...p} />}
    />
  );
}
