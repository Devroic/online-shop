import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { Field, Spinner, useTitle } from '../components/ui.jsx';

export default function TrackOrder() {
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useTitle(t('Track order'));

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Track order')}</h1>
        <p className="muted">{t('Enter your order number and the email you used at checkout.')}</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await api.post('/orders/lookup', { number, email });
              navigate(`/order/${r.number}?token=${r.token}`);
            } catch {
              setError(t('We could not find an order with these details.'));
              setBusy(false);
            }
          }}
        >
          <Field label={t('Order number')} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1001" required />
          <Field label={t('Email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="field-error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy && <Spinner />} {t('Find my order')}
          </button>
        </form>
      </div>
    </div>
  );
}
