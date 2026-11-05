import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Package, LogOut, LayoutDashboard, ChevronRight, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { date, money } from '../lib/format.js';
import { countryName, shippingCountries } from '../lib/countries.js';
import { useShop } from '../context/ShopContext.jsx';
import { t, ORDER_STATUS, providerName, statusName } from '../lib/i18n.js';
import { EmptyState, Field, FormAlert, PageLoader, Spinner, useTitle } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';

function Orders() {
  const { data, loading } = useFetch('/orders/mine');
  if (loading && !data) return <PageLoader />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={Package}
        title={t('No orders yet')}
        text={t('When you place an order it will appear here.')}
        action={
          <Link to="/products" className="btn btn-primary">
            {t('Start shopping')}
          </Link>
        }
      />
    );
  }
  return (
    <div className="order-list">
      {data.map((o) => (
        <Link key={o.id} to={`/order/${o.number}`} className="order-row card">
          <div>
            <strong>#{o.number}</strong>
            <div className="muted small">
              {date(o.createdAt)} · {t('{n} items', { n: o.itemCount })}
            </div>
          </div>
          <span className={`status status-${o.status}`}>{statusName(o.status, o)}</span>
          <strong>{money(o.total)}</strong>
          <ChevronRight size={18} className="muted" />
        </Link>
      ))}
    </div>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const { settings } = useShop();
  const countries = shippingCountries(settings);
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone,
    street: user.address?.street || '',
    city: user.address?.city || '',
    postalCode: user.address?.postalCode || '',
    region: user.address?.region || '',
    country: countries.includes(user.address?.country) ? user.address.country : countries[0],
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const v = useValidation();
  const pv = useValidation();
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    v.clear(k);
    setForm({ ...form, [k]: e.target.value });
  };
  const setPassword = (k) => (e) => {
    pv.clear(k);
    setPw({ ...pw, [k]: e.target.value });
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    // The address is optional, but once started it needs street, city and postal code.
    const hasAddress = [form.street, form.city, form.postalCode, form.region].some((x) => x.trim());
    const addressRule = hasAddress ? [rules.required()] : [];
    const ok = v.validate(form, {
      name: [rules.required(), rules.maxLength(100)],
      phone: [rules.maxLength(40)],
      street: [...addressRule, rules.maxLength(200)],
      city: [...addressRule, rules.maxLength(100)],
      postalCode: [...addressRule, rules.maxLength(20)],
      region: [rules.maxLength(100)],
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api.put('/auth/me', {
        name: form.name,
        phone: form.phone,
        address: hasAddress ? { street: form.street, city: form.city, postalCode: form.postalCode, region: form.region, country: form.country } : null,
      });
      setUser(r.user);
      v.reset();
      toast.success(t('Saved'));
    } catch (err) {
      v.fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <form className="card" onSubmit={saveProfile} noValidate>
        <h3>{t('Personal details')}</h3>
        <div className="grid-2">
          <Field label={t('Full name')} autoComplete="name" value={form.name} onChange={set('name')} error={v.errors.name} />
          <Field label={t('Phone')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={v.errors.phone} />
        </div>
        <Field label={t('Email')} value={user.email} disabled />
        <h3>{t('Default address')}</h3>
        <div className="grid-2">
          <Field as="select" label={t('Country')} autoComplete="country" value={form.country} onChange={set('country')} error={v.errors.country} disabled={countries.length === 1}>
            {countries.map((c) => (
              <option key={c} value={c}>
                {countryName(c)}
              </option>
            ))}
          </Field>
          <Field label={t('City')} autoComplete="address-level2" value={form.city} onChange={set('city')} error={v.errors.city} />
        </div>
        <div className="grid-2">
          <Field label={t('Area (optional)')} value={form.region} onChange={set('region')} error={v.errors.region} />
          <Field label={t('Postal code')} autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} error={v.errors.postalCode} />
        </div>
        <Field label={t('Street address')} autoComplete="street-address" value={form.street} onChange={set('street')} error={v.errors.street} />
        <FormAlert message={v.errors._} />
        <button className="btn btn-primary" disabled={busy}>
          {busy && <Spinner />} {t('Save')}
        </button>
      </form>

      <form
        className="card"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = pv.validate(pw, {
            currentPassword: user.hasPassword ? [rules.required()] : [],
            newPassword: [rules.required(), rules.minLength(8)],
          });
          if (!ok) return;
          try {
            const r = await api.put('/auth/me/password', pw);
            setUser(r.user);
            setPw({ currentPassword: '', newPassword: '' });
            pv.reset();
            toast.success(t('Password changed'));
          } catch (err) {
            if (err.details?.currentPassword === 'wrong') pv.show({ currentPassword: t('The current password is wrong') });
            else pv.fail(err);
          }
        }}
      >
        <h3>{user.hasPassword ? t('Change password') : t('Set a password')}</h3>
        {!user.hasPassword && <p className="muted small">{t('You sign in with {provider}. You can also set a password to sign in with your email.', { provider: providerName(user.provider) })}</p>}
        <div className="grid-2">
          {user.hasPassword && (
          <Field
            label={t('Current password')}
            type="password"
            autoComplete="current-password"
            value={pw.currentPassword}
            onChange={setPassword('currentPassword')}
            error={pv.errors.currentPassword}
          />
          )}
          <Field
            label={t('New password')}
            type="password"
            autoComplete="new-password"
            value={pw.newPassword}
            onChange={setPassword('newPassword')}
            error={pv.errors.newPassword}
            hint={t('At least 8 characters')}
          />
        </div>
        <FormAlert message={pv.errors._} />
        <button className="btn btn-outline">{user.hasPassword ? t('Change password') : t('Set a password')}</button>
      </form>
    </div>
  );
}

/** Shown until the customer clicks the link in the welcome email. */
function ConfirmEmailNotice({ email }) {
  const [state, setState] = useState('idle');
  const toast = useToast();
  const resend = async () => {
    setState('sending');
    try {
      await api.post('/auth/verify/resend');
      setState('sent');
    } catch (err) {
      toast.error(err.message);
      setState('idle');
    }
  };
  return (
    <div className="notice confirm-email">
      <MailCheck size={20} />
      <div className="grow">
        <strong>{t('Please confirm your email')}</strong>
        <div className="small">
          {t('We sent a link to {email}. Your earlier orders with this email appear here once you confirm it.', { email })}
        </div>
      </div>
      {state === 'sent' ? (
        <span className="small">{t('Sent!')}</span>
      ) : (
        <button type="button" className="btn btn-outline btn-sm" onClick={resend} disabled={state === 'sending'}>
          {state === 'sending' && <Spinner size={16} />} {t('Send again')}
        </button>
      )}
    </div>
  );
}

export default function Account() {
  const { user, loading, logout } = useAuth();
  useTitle(t('My account'));
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login?next=/account" replace />;

  return (
    <div className="container">
      <div className="account-head">
        <div>
          <h1 className="page-title">{t('Hello, {name}', { name: user.name.split(' ')[0] || user.email })}</h1>
          <p className="muted">{user.email}</p>
        </div>
        <div className="row-gap">
          {user.role === 'admin' && (
            <Link to="/admin" className="btn btn-primary">
              <LayoutDashboard size={18} /> {t('Admin panel')}
            </Link>
          )}
          <button className="btn btn-ghost" onClick={logout}>
            <LogOut size={18} /> {t('Sign out')}
          </button>
        </div>
      </div>
      {!user.emailVerified && <ConfirmEmailNotice email={user.email} />}
      <nav className="tabs">
        <NavLink to="/account" end>
          {t('My orders')}
        </NavLink>
        <NavLink to="/account/profile">{t('Profile')}</NavLink>
      </nav>
      <Routes>
        <Route index element={<Orders />} />
        <Route path="profile" element={<Profile />} />
      </Routes>
    </div>
  );
}
