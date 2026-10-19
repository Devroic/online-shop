import { MessageSquare, Mail, Phone, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { dateTime } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { EmptyState, PageLoader } from '../components/ui.jsx';
import { PageHeader } from './components.jsx';

export default function Messages({ onChange }) {
  const { data, setData } = useFetch('/admin/messages');

  const markRead = async (m, read) => {
    await api.put(`/admin/messages/${m.id}`, { read });
    setData((list) => list.map((x) => (x.id === m.id ? { ...x, read } : x)));
    onChange?.();
  };
  const remove = async (m) => {
    if (!window.confirm(t('Delete this message?'))) return;
    await api.del(`/admin/messages/${m.id}`);
    setData((list) => list.filter((x) => x.id !== m.id));
    onChange?.();
  };

  return (
    <>
      <PageHeader title={t('Messages')} subtitle={t('Sent from the contact form.')} />
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon={MessageSquare} title={t('No messages yet')} />
      ) : (
        <div className="card-list">
          {data.map((m) => (
            <article key={m.id} className={`card message ${m.read ? '' : 'unread'}`} onClick={() => !m.read && markRead(m, true)}>
              <div className="message-head">
                <strong>{m.name}</strong>
                <span className="muted small">{dateTime(m.createdAt)}</span>
              </div>
              <div className="row-gap small">
                <a href={`mailto:${m.email}`} className="icon-line">
                  <Mail size={14} /> {m.email}
                </a>
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="icon-line">
                    <Phone size={14} /> {m.phone}
                  </a>
                )}
              </div>
              <p className="message-body">{m.message}</p>
              <div className="row-gap">
                <a className="btn btn-outline btn-sm" href={`mailto:${m.email}?subject=Re:`}>
                  {t('Reply')}
                </a>
                {m.read && (
                  <button className="btn btn-ghost btn-sm" onClick={() => markRead(m, false)}>
                    {t('Mark as unread')}
                  </button>
                )}
                <button className="icon-btn" onClick={() => remove(m)} aria-label={t('Delete')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
