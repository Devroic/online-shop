import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Plus, FileText, Pencil, ExternalLink } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { date } from '../lib/format.js';
import { renderMarkdown } from '../lib/markdown.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, PageLoader, Spinner } from '../components/ui.jsx';
import { Modal, PageHeader, Toggle } from './components.jsx';
import { HomePage, SettingsForm } from './Settings.jsx';

function PageModal({ page, onClose, onSaved }) {
  const [form, setForm] = useState(page || { slug: '', title: '', content: '', showInFooter: true });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/admin/pages/${encodeURIComponent(page?.slug || form.slug || form.title)}`, { ...form, slug: form.slug || form.title });
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(t('Delete this page?'))) return;
    await api.del(`/admin/pages/${page.slug}`);
    onSaved();
  };

  return (
    <Modal
      wide
      title={page ? t('Edit page') : t('New page')}
      onClose={onClose}
      footer={
        <>
          {page && (
            <button className="btn btn-ghost danger-text mr-auto" onClick={remove}>
              {t('Delete')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !form.title.trim()}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label={t('Title')} value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        <Field label={t('URL')} value={form.slug} onChange={(e) => set('slug', e.target.value)} hint={form.slug && `/p/${form.slug}`} placeholder={t('Generated from the name')} />
      </div>
      <div className="tabs">
        <button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>
          {t('Edit')}
        </button>
        <button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>
          {t('Preview')}
        </button>
      </div>
      {preview ? (
        <div className="prose preview-box" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
      ) : (
        <Field
          as="textarea"
          rows={14}
          value={form.content}
          onChange={(e) => set('content', e.target.value)}
          hint={t('## Heading · **bold** · *italic* · - list item · [link text](https://…)')}
        />
      )}
      <Toggle
        checked={form.showInFooter}
        onChange={(v) => set('showInFooter', v)}
        label={t('Show in the footer, under “Help”')}
        hint={t('Turn off for pages you only link to yourself.')}
      />
    </Modal>
  );
}

function HelpPages() {
  const { data, reload } = useFetch('/admin/pages');
  const { reload: reloadShop } = useShop();
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        title={t('Pages')}
        subtitle={t('Text pages such as about us, terms and privacy policy. They are listed in the shop’s footer, under “Help”.')}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> {t('Add page')}
          </button>
        }
      />
      <PageTabs />
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon={FileText} title={t('No pages yet')} />
      ) : (
        <div className="card-list">
          {data.map((p) => (
            <div key={p.slug} className="card list-card">
              <FileText size={20} className="muted" />
              <div className="grow">
                <strong>{p.title}</strong>
                <div className="muted small">
                  /p/{p.slug} · {t('Updated {date}', { date: date(p.updatedAt) })}
                </div>
              </div>
              <span className={`status ${p.showInFooter ? 'status-delivered' : ''}`}>{p.showInFooter ? t('In footer (Help)') : t('Not in footer')}</span>
              <a className="icon-btn" href={`/p/${p.slug}`} target="_blank" rel="noreferrer" aria-label={t('View')}>
                <ExternalLink size={16} />
              </a>
              <button className="icon-btn" onClick={() => setEditing(p)} aria-label={t('Edit')}>
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <PageModal
          page={editing.slug ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
            reloadShop();
          }}
        />
      )}
    </>
  );
}

function PageTabs() {
  return (
    <nav className="tabs">
      <NavLink to="/admin/pages" end>
        {t('Home page')}
      </NavLink>
      <NavLink to="/admin/pages/help">{t('Help')}</NavLink>
    </nav>
  );
}

/** Admin → Pages: the home page (banner, announcement) and the text pages under “Help”. */
export default function Pages() {
  return (
    <Routes>
      <Route
        index
        element={<SettingsForm title={t('Pages')} subtitle={t('The banner and announcement bar on the home page.')} tabs={<PageTabs />} render={(props) => <HomePage {...props} />} />}
      />
      <Route path="help" element={<HelpPages />} />
      <Route path="*" element={<Navigate to="/admin/pages" replace />} />
    </Routes>
  );
}
