import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { Field, Spinner, fieldErrors, useTitle } from '../components/ui.jsx';

/** Only allow redirects inside the shop. */
const safeNext = (next, fallback) => (next && next.startsWith('/') && !next.startsWith('//') ? next : fallback);

export function Login() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useTitle(t('Sign in'));

  if (user) return <Navigate to={safeNext(params.get('next'), user.role === 'admin' ? '/admin' : '/account')} replace />;

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Sign in')}</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const u = await login(form.email, form.password);
              navigate(safeNext(params.get('next'), u.role === 'admin' ? '/admin' : '/account'), { replace: true });
            } catch (err) {
              setError(err.status === 429 ? t('Too many attempts, please try again later') : t('Wrong email or password'));
              setBusy(false);
            }
          }}
        >
          <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Field
            label={t('Password')}
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="field-error">{error}</p>}
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
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useTitle(t('Create an account'));

  if (user) return <Navigate to={safeNext(params.get('next'), '/account')} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Create an account')}</h1>
        <p className="muted">{t('Faster checkout and all your orders in one place.')}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await register(form);
              navigate(safeNext(params.get('next'), '/account'), { replace: true });
            } catch (err) {
              const fe = fieldErrors(err);
              if (fe.email === t('Already in use')) fe.email = t('An account with this email already exists');
              setErrors(fe);
              setBusy(false);
            }
          }}
        >
          <Field label={t('Full name')} autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} required />
          <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} required />
          <Field label={t('Phone (optional)')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          <Field
            label={t('Password')}
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            hint={t('At least 8 characters')}
            minLength={8}
            required
          />
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
  useTitle(t('Reset password'));
  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Reset password')}</h1>
        {sent ? (
          <p>{t('If an account exists for {email}, we sent a link to reset your password.', { email })}</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await api.post('/auth/forgot', { email }).catch(() => {});
              setSent(true);
            }}
          >
            <p className="muted">{t('Enter your email and we will send you a link to choose a new password.')}</p>
            <Field label={t('Email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button className="btn btn-primary btn-block" disabled={busy}>
              {t('Send link')}
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
  const [error, setError] = useState('');
  useTitle(t('Reset password'));
  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Choose a new password')}</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api.post('/auth/reset', { token: params.get('token'), password });
              setUser(r.user);
              navigate('/account', { replace: true });
            } catch (err) {
              setError(err.details?.password ? t('At least 8 characters') : t('This link is invalid or has expired'));
            }
          }}
        >
          <Field label={t('New password')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn-primary btn-block">{t('Save password')}</button>
        </form>
      </div>
    </div>
  );
}
