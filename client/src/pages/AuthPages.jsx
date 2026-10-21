import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { t, providerName } from '../lib/i18n.js';
import { Field, FormAlert, Spinner, useTitle } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import SocialLogin from '../components/SocialLogin.jsx';

/** Only allow redirects inside the shop. */
const safeNext = (next, fallback) => (next && next.startsWith('/') && !next.startsWith('//') ? next : fallback);

export function Login() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const v = useValidation();
  const [busy, setBusy] = useState(false);
  useTitle(t('Sign in'));
  const set = (k) => (e) => {
    v.clear(k);
    setForm({ ...form, [k]: e.target.value });
  };

  if (user) return <Navigate to={safeNext(params.get('next'), user.role === 'admin' ? '/admin' : '/account')} replace />;

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Sign in')}</h1>
        <SocialLogin next={safeNext(params.get('next'), '/account')} />
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!v.validate(form, { email: [rules.required(), rules.email()], password: [rules.required()] })) return;
            setBusy(true);
            try {
              const u = await login(form.email, form.password);
              navigate(safeNext(params.get('next'), u.role === 'admin' ? '/admin' : '/account'), { replace: true });
            } catch (err) {
              v.show({
                _: err.status === 429
                  ? t('Too many attempts, please try again later')
                  : err.details?.provider
                    ? t('This account was created with {provider}. Use that button above, or reset your password.', {
                        provider: providerName(err.details.provider),
                      })
                    : t('Wrong email or password'),
              });
              setBusy(false);
            }
          }}
        >
          <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={v.errors.email} />
          <Field label={t('Password')} type="password" autoComplete="current-password" value={form.password} onChange={set('password')} error={v.errors.password} />
          <FormAlert message={v.errors._} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy && <Spinner />} {t('Sign in')}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/account/forgot">{t('Forgot your password?')}</Link>
          <span>
            {t('New here?')} <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`}>{t('Create an account')}</Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: params.get('email') || '', phone: '', password: '' });
  const v = useValidation();
  const [busy, setBusy] = useState(false);
  useTitle(t('Create an account'));

  if (user) return <Navigate to={safeNext(params.get('next'), '/account')} replace />;
  const set = (k) => (e) => {
    v.clear(k);
    setForm({ ...form, [k]: e.target.value });
  };

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Create an account')}</h1>
        <p className="muted">{t('Faster checkout and all your orders in one place.')}</p>
        <SocialLogin next={safeNext(params.get('next'), '/account')} />
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = v.validate(form, {
              name: [rules.required(), rules.maxLength(100)],
              email: [rules.required(), rules.email()],
              phone: [rules.maxLength(40)],
              password: [rules.required(), rules.minLength(8)],
            });
            if (!ok) return;
            setBusy(true);
            try {
              await register(form);
              navigate(safeNext(params.get('next'), '/account'), { replace: true });
            } catch (err) {
              if (err.details?.email === 'exists') v.show({ email: t('An account with this email already exists') });
              else v.fail(err);
              setBusy(false);
            }
          }}
        >
          <Field label={t('Full name')} autoComplete="name" value={form.name} onChange={set('name')} error={v.errors.name} />
          <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={v.errors.email} />
          <Field label={t('Phone (optional)')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={v.errors.phone} />
          <Field
            label={t('Password')}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={v.errors.password}
            hint={t('At least 8 characters')}
          />
          <FormAlert message={v.errors._} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy && <Spinner />} {t('Create account')}
          </button>
        </form>
        <div className="auth-links">
          <span>
            {t('Already have an account?')} <Link to="/login">{t('Sign in')}</Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = useValidation();
  useTitle(t('Reset password'));
  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Reset password')}</h1>
        {sent ? (
          <p>{t('If an account exists for {email}, we sent a link to reset your password.', { email })}</p>
        ) : (
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              if (!v.validate({ email }, { email: [rules.required(), rules.email()] })) return;
              setBusy(true);
              try {
                await api.post('/auth/forgot', { email });
                setSent(true);
              } catch (err) {
                v.fail(err);
                setBusy(false);
              }
            }}
          >
            <p className="muted">{t('Enter your email and we will send you a link to choose a new password.')}</p>
            <Field
              label={t('Email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                v.clear('email');
                setEmail(e.target.value);
              }}
              error={v.errors.email}
            />
            <FormAlert message={v.errors._} />
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy && <Spinner />} {t('Send link')}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link to="/login">{t('Back to sign in')}</Link>
        </div>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const v = useValidation();
  useTitle(t('Reset password'));
  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Choose a new password')}</h1>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!v.validate({ password }, { password: [rules.required(), rules.minLength(8)] })) return;
            setBusy(true);
            try {
              const r = await api.post('/auth/reset', { token: params.get('token'), password });
              setUser(r.user);
              navigate('/account', { replace: true });
            } catch (err) {
              v.fail(err);
              setBusy(false);
            }
          }}
        >
          <Field
            label={t('New password')}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              v.clear('password');
              setPassword(e.target.value);
            }}
            error={v.errors.password}
            hint={t('At least 8 characters')}
          />
          <FormAlert message={v.errors._} />
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy && <Spinner />} {t('Save password')}
          </button>
        </form>
      </div>
    </div>
  );
}
