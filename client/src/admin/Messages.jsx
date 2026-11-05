import { useState } from 'react';
import { MessageSquare, Mail, Phone, Trash2, ChevronDown } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { dateTime } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { EmptyState, PageLoader } from '../components/ui.jsx';
import { PageHeader } from './components.jsx';

/** Contact form messages: one line each (subject, sender, date); click to read. */
export default function Messages({ onChange }) {
  const { data, setData } = useFetch('/admin/messages');
  const [openId, setOpenId] = useState(null);

  const markRead = async (m, read) => {
    await api.put(`/admin/messages/${m.id}`, { read });
    setData((list) => list.map((x) => (x.id === m.id ? { ...x, read } : x)));
    onChange?.();
  };
  const toggle = (m) => {
    const opening = openId !== m.id;
    setOpenId(opening ? m.id : null);
    if (opening && !m.read) markRead(m, true);
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
          {data.map((m) => {
            const open = openId === m.id;
            // Messages sent before subjects existed show the start of the text instead.
            const subject = m.subject || m.message.slice(0, 80);
            return (
              <article key={m.id} className={`card message ${m.read ? '' : 'unread'}`}>
                <button type="button" className="message-row" onClick={() => toggle(m)} aria-expanded={open}>
                  <span className="message-subject">{subject}</span>
                  <span className="muted small row-gap">
                    {dateTime(m.createdAt)}
                    <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
                  </span>
                  <span className="message-from muted small">
                    {m.name} · {m.email}
                  </span>
                </button>
                {open && (
                  <div className="message-open">
                    <div className="row-gap small" style={{ marginTop: 12 }}>
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
                      <a className="btn btn-outline btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${subject}`)}`}>
                        {t('Reply')}
                      </a>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setOpenId(null); markRead(m, false); }}>
                        {t('Mark as unread')}
                      </button>
                      <button className="icon-btn" onClick={() => remove(m)} aria-label={t('Delete')}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
