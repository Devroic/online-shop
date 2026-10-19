import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, CircleCheck } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { api } from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { Field, Spinner, fieldErrors, useTitle } from '../components/ui.jsx';

export default function Contact() {
  const { settings } = useShop();
  const { contact } = settings;
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  useTitle(t('Contact'));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
              onSubmit={async (e) => {
                e.preventDefault();
                setState('sending');
                try {
                  await api.post('/contact', form);
                  setState('sent');
                } catch (err) {
                  setErrors(fieldErrors(err));
                  setState(err.status === 429 ? 'limited' : 'idle');
                }
              }}
            >
              <div className="grid-2">
                <Field label={t('Name')} value={form.name} onChange={set('name')} error={errors.name} required />
                <Field label={t('Email')} type="email" value={form.email} onChange={set('email')} error={errors.email} required />
              </div>
              <Field label={t('Phone (optional)')} type="tel" value={form.phone} onChange={set('phone')} />
              <Field as="textarea" rows={6} label={t('Message')} value={form.message} onChange={set('message')} error={errors.message} required />
              {state === 'limited' && <p className="field-error">{t('Too many messages. Please try again later.')}</p>}
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
