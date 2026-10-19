import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Folder, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, PageLoader, Spinner, fieldErrors } from '../components/ui.jsx';
import { ImageUploader, Modal, PageHeader, Toggle } from './components.jsx';

function CategoryModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState(category || { name: '', slug: '', description: '', image: null, sortOrder: 0, active: true });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const body = { name: form.name, slug: form.slug || undefined, description: form.description, image: form.image, sortOrder: Number(form.sortOrder) || 0, active: form.active };
      if (category) await api.put(`/admin/categories/${category.id}`, body);
      else await api.post('/admin/categories', body);
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(t('Delete this category? Its products will stay, without a category.'))) return;
    await api.del(`/admin/categories/${category.id}`);
    onSaved();
  };

  return (
    <Modal
      title={category ? t('Edit category') : t('New category')}
      onClose={onClose}
      footer={
        <>
          {category && (
            <button className="btn btn-ghost danger-text mr-auto" onClick={remove}>
              {t('Delete')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoFocus />
      <Field as="textarea" rows={3} label={t('Description (optional)')} value={form.description} onChange={(e) => set('description', e.target.value)} />
      <div className="field">
        <label>{t('Image (optional)')}</label>
        <ImageUploader multiple={false} value={form.image ? [form.image] : []} onChange={(v) => set('image', v[0] || null)} />
      </div>
      <div className="grid-2">
        <Field label={t('URL')} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={t('Generated from the name')} />
        <Field label={t('Sort order')} type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} hint={t('Lower numbers come first')} />
      </div>
      <Toggle checked={form.active} onChange={(v) => set('active', v)} label={t('Visible in shop')} />
    </Modal>
  );
}

export default function Categories() {
  const { data, reload } = useFetch('/admin/categories');
  const { reload: reloadShop } = useShop();
  const [editing, setEditing] = useState(null);

  return (
    <>
      <PageHeader
        title={t('Categories')}
        subtitle={t('Group products so customers find them quickly.')}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> {t('Add category')}
          </button>
        }
      />
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon={Folder} title={t('No categories yet')} />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Category')}</th>
                  <th>{t('Products')}</th>
                  <th>{t('Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className={c.active ? '' : 'dim'}>
                    <td>
                      <div className="prod-cell">
                        {c.image ? <img src={c.image} alt="" /> : <span className="thumb-empty" />}
                        <span>
                          <strong>{c.name}</strong>
                          <span className="muted small">/category/{c.slug}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link to={`/admin/products?category=${c.id}`} className="link-btn">
                        {c.productCount}
                      </Link>
                    </td>
                    <td>{c.active ? <span className="status status-delivered">{t('Visible')}</span> : <span className="status">{t('Hidden')}</span>}</td>
                    <td className="num">
                      <button className="icon-btn" onClick={() => setEditing(c)} aria-label={t('Edit')}>
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && (
        <CategoryModal
          category={editing.id ? editing : null}
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
