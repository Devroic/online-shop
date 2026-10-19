import { useState } from 'react';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { startSocialLogin } from '../lib/supabase.js';
import { t } from '../lib/i18n.js';
import { Spinner } from './ui.jsx';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
  </svg>
);

/** "Continue with Google / Apple" buttons; renders nothing if neither is enabled. */
export default function SocialLogin({ next = '/account' }) {
  const { settings } = useShop();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const providers = [
    ['google', t('Continue with Google'), GoogleIcon],
    ['apple', t('Continue with Apple'), AppleIcon],
  ].filter(([p]) => settings.login?.[p] && settings.supabase);
  if (!providers.length) return null;

  const go = async (provider) => {
    setBusy(provider);
    try {
      await startSocialLogin(settings.supabase, provider, next);
    } catch {
      setBusy(null);
      toast.error(t('Sign-in failed. Please try again.'));
    }
  };

  return (
    <div className="social-login">
      {providers.map(([p, label, Icon]) => (
        <button key={p} type="button" className={`btn btn-social btn-${p} btn-block`} onClick={() => go(p)} disabled={!!busy}>
          {busy === p ? <Spinner size={18} /> : <Icon />} {label}
        </button>
      ))}
      <div className="divider">
        <span>{t('or with email')}</span>
      </div>
    </div>
  );
}
