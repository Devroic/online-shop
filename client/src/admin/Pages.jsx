import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Plus, FileText, ExternalLink, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { date } from '../lib/format.js';
import { renderMarkdown } from '../lib/markdown.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { Modal, PageHeader, Toggle, useConfirm } from './components.jsx';
import { HomePage, SETTINGS_RULES, SettingsForm } from './Settings.jsx';

function PageModal({ page, onClose, onSaved }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(page || { slug: '', title: '', content: '', showInFooter: true });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = useValidation();
  const { errors } = v;
  const toast = useToast();
  const set = (k, value) => {
    v.clear(k);
    setForm((f) => ({ ...f, [k]: value }));
  };

  const save = async () => {
    const ok = v.validate(form, {
      title: [rules.required(), rules.maxLength(200)],
      slug: [rules.maxLength(80)],
      content: [rules.maxLength(100000)],
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.put(`/admin/pages/${encodeURIComponent(page?.slug || form.slug || form.title)}`, { ...form, slug: form.slug || form.title });
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      v.fail(err);
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirm({ title: t('Delete this page?'), message: t('Links to it will stop working.'), confirmLabel: t('Delete'), danger: true }))) return;
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
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label={t('Title')} value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} autoFocus />
        <Field label={t('URL')} value={form.slug} onChange={(e) => set('slug', e.target.value)} hint={form.slug && `/p/${form.slug}`} placeholder={t('Generated from the name')} error={errors.slug} />
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
          error={errors.content}
          hint={t('## Heading · **bold** · *italic* · - list item · [link text](https://…)')}
        />
      )}
      <Toggle
        checked={form.showInFooter}
        onChange={(on) => set('showInFooter', on)}
        label={t('Show in the shop’s footer')}
        hint={t('When off, the page is hidden from the footer but still opens from its address, e.g. through a link in the banner.')}
      />
      <FormAlert message={errors._} />
    </Modal>
  );
}

function HelpPages() {
  const { data, reload, setData } = useFetch('/admin/pages');
  const { reload: reloadShop } = useShop();
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  /** Swaps a page with its neighbour and saves the order (the footer follows it). */
  const move = async (i, step) => {
    const list = [...data];
    [list[i], list[i + step]] = [list[i + step], list[i]];
    setData(list);
    try {
      await api.put('/admin/pages-order', { slugs: list.map((x) => x.slug) });
      reloadShop();
    } catch {
      toast.error(t('Something went wrong. Please try again.'));
      reload();
    }
  };
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
          {data.map((p, i) => (
            <div key={p.slug} className="card list-card clickable">
              <FileText size={20} className="muted" />
              <div className="grow">
                <button type="button" className="row-link plain-btn" onClick={() => setEditing(p)}>
                  <strong>{p.title}</strong>
                </button>
                <div className="muted small">
                  /p/{p.slug} · {t('Updated {date}', { date: date(p.updatedAt) })}
                </div>
              </div>
              {!p.showInFooter && <span className="status">{t('Hidden from the footer')}</span>}
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Move up')}>
                <ArrowUp size={16} />
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === data.length - 1} aria-label={t('Move down')}>
                <ArrowDown size={16} />
              </button>
              <a className="icon-btn" href={`/p/${p.slug}`} target="_blank" rel="noreferrer" aria-label={t('View')}>
                <ExternalLink size={16} />
              </a>
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
        element={<SettingsForm title={t('Pages')} subtitle={t('The banner and announcement bar on the home page.')} tabs={<PageTabs />} schema={SETTINGS_RULES.home} render={(props) => <HomePage {...props} />} />}
      />
      <Route path="help" element={<HelpPages />} />
      <Route path="*" element={<Navigate to="/admin/pages" replace />} />
    </Routes>
  );
}
