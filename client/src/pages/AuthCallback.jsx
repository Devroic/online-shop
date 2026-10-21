import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../context/ShopContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getSupabase } from '../lib/supabase.js';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { FormAlert, PageLoader, useTitle } from '../components/ui.jsx';

const safeNext = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/account');

/** Google/Facebook send the visitor back here; we turn that into a shop session. */
export default function AuthCallback() {
  const [params] = useSearchParams();
  const { settings } = useShop();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);
  useTitle(t('Sign in'));

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the code is single-use
    started.current = true;
    (async () => {
      try {
        if (params.get('error')) throw new Error(params.get('error_description') || params.get('error'));
        const sb = await getSupabase(settings.supabase);
        const { data, error: err } = await sb.auth.exchangeCodeForSession(params.get('code'));
        if (err) throw err;
        const r = await api.post('/auth/oauth', { accessToken: data.session.access_token });
        await sb.auth.signOut({ scope: 'local' }).catch(() => {});
        setUser(r.user);
        navigate(r.user.role === 'admin' ? '/admin' : safeNext(params.get('next')), { replace: true });
      } catch (err) {
        setError(
          err?.details?.reason === 'no_email'
            ? t('Your account did not share an email address, which we need for your orders. Please sign in with email instead.')
            : t('Sign-in failed. Please try again.'),
        );
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!error) return <PageLoader />;
  return (
    <div className="container narrow">
      <div className="card auth-card">
        <FormAlert message={error} />
        <Link to="/login" className="btn btn-primary btn-block">
          {t('Back to sign in')}
        </Link>
      </div>
    </div>
  );
}
