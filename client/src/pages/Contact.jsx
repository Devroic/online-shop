import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, CircleCheck } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { Field, FormAlert, Spinner, useTitle } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';

export default function Contact() {
  const { settings } = useShop();
  const { contact } = settings;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const v = useValidation();
  const [state, setState] = useState('idle');
  useTitle(t('Contact'));
  const set = (k) => (e) => {
    v.clear(k);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  return (
    <div className="container">
      <h1 className="page-title">{t('Contact us')}</h1>
      <div className="two-col contact">
        <div className="card">
          {state === 'sent' ? (
            <div className="sent">
              <CircleCheck size={40} />
              <h3>{t('Message sent!')}</h3>
              <p className="muted">{t('We will get back to you as soon as possible.')}</p>
            </div>
          ) : (
            <form
              noValidate
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = v.validate(form, {
                  name: [rules.required(), rules.maxLength(100)],
                  email: [rules.required(), rules.email()],
                  phone: [rules.maxLength(40)],
                  message: [rules.required(), rules.minLength(5), rules.maxLength(5000)],
                });
                if (!ok) return;
                setState('sending');
                try {
                  await api.post('/contact', form);
                  setState('sent');
                } catch (err) {
                  if (err.status === 429) v.show({ _: t('Too many messages. Please try again later.') });
                  else v.fail(err);
                  setState('idle');
                }
              }}
            >
              <div className="grid-2">
                <Field label={t('Name')} autoComplete="name" value={form.name} onChange={set('name')} error={v.errors.name} />
                <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={v.errors.email} />
              </div>
              <Field label={t('Phone (optional)')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={v.errors.phone} />
              <Field as="textarea" rows={6} label={t('Message')} value={form.message} onChange={set('message')} error={v.errors.message} />
              <FormAlert message={v.errors._} />
              <button className="btn btn-primary" disabled={state === 'sending'}>
                {state === 'sending' && <Spinner />} {t('Send message')}
              </button>
            </form>
          )}
        </div>
        <aside className="card contact-info">
          {contact.phone && (
            <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>
              <Phone size={20} /> {contact.phone}
            </a>
          )}
          {contact.email && (
            <a href={`mailto:${contact.email}`}>
              <Mail size={20} /> {contact.email}
            </a>
          )}
          {contact.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`} target="_blank" rel="noreferrer">
              <MapPin size={20} /> {contact.address}
            </a>
          )}
          {contact.hours && (
            <div>
              <Clock size={20} /> {contact.hours}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
