import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Folder, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, FieldWrap, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { ImageUploader, Modal, PageHeader, Toggle } from './components.jsx';

function CategoryModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState(category || { name: '', slug: '', description: '', image: null, sortOrder: 0, active: true });
  const v = useValidation();
  const { errors } = v;
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k, value) => {
    v.clear(k);
    setForm((f) => ({ ...f, [k]: value }));
  };

  const save = async () => {
    const ok = v.validate(form, {
      name: [rules.required(), rules.maxLength(100)],
      slug: [rules.maxLength(100)],
      description: [rules.maxLength(2000)],
      sortOrder: [rules.integer()],
    });
    if (!ok) return;
    setBusy(true);
    try {
      const body = { name: form.name, slug: form.slug || undefined, description: form.description, image: form.image, sortOrder: Number(form.sortOrder) || 0, active: form.active };
      if (category) await api.put(`/admin/categories/${category.id}`, body);
      else await api.post('/admin/categories', body);
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      v.fail(err);
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
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoFocus />
      <Field as="textarea" rows={3} label={t('Description (optional)')} value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
      <FieldWrap label={t('Image (optional)')} error={errors.image}>
        <ImageUploader multiple={false} value={form.image ? [form.image] : []} onChange={(list) => set('image', list[0] || null)} />
      </FieldWrap>
      <div className="grid-2">
        <Field label={t('URL')} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={t('Generated from the name')} error={errors.slug} />
        <Field label={t('Sort order')} inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} hint={t('Lower numbers come first')} error={errors.sortOrder} />
      </div>
      <Toggle checked={form.active} onChange={(on) => set('active', on)} label={t('Visible in shop')} />
      <FormAlert message={errors._} />
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
