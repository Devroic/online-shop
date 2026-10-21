import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { Field, FormAlert, Spinner, useTitle } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';

export default function TrackOrder() {
  const [number, setNumber] = useState('');
  const [email, setEmail] = useState('');
  const v = useValidation();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useTitle(t('Track order'));

  return (
    <div className="container narrow">
      <div className="card auth-card">
        <h1>{t('Track order')}</h1>
        <p className="muted">{t('Enter your order number and the email you used at checkout.')}</p>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (!v.validate({ number, email }, { number: [rules.required()], email: [rules.required(), rules.email()] })) return;
            setBusy(true);
            try {
              const r = await api.post('/orders/lookup', { number, email });
              navigate(`/order/${r.number}?token=${r.token}`);
            } catch (err) {
              if (err.status === 404) v.show({ _: t('We could not find an order with these details.') });
              else v.fail(err);
              setBusy(false);
            }
          }}
        >
          <Field
            label={t('Order number')}
            value={number}
            onChange={(e) => {
              v.clear('number');
              setNumber(e.target.value);
            }}
            placeholder="1001"
            error={v.errors.number}
          />
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
            {busy && <Spinner />} {t('Find my order')}
          </button>
        </form>
      </div>
    </div>
  );
}
