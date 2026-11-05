import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Folder, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, FieldWrap, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { ImageUploader, Modal, PageHeader, Toggle } from './components.jsx';

function CategoryModal({ category, onClose, onSaved }) {
  const [form, setForm] = useState(category || { name: '', slug: '', description: '', image: null, active: true });
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
    });
    if (!ok) return;
    setBusy(true);
    try {
      const body = { name: form.name, slug: form.slug || undefined, description: form.description, image: form.image, active: form.active };
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
      </div>
      <Toggle checked={form.active} onChange={(on) => set('active', on)} label={t('Visible in shop')} />
      <FormAlert message={errors._} />
    </Modal>
  );
}

export default function Categories() {
  const { data, reload, setData } = useFetch('/admin/categories');
  const { reload: reloadShop } = useShop();
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const setVisible = async (c, active) => {
    setData((list) => list.map((x) => (x.id === c.id ? { ...x, active } : x)));
    try {
      await api.patch(`/admin/categories/${c.id}`, { active });
      reloadShop();
    } catch {
      toast.error(t('Could not save'));
      reload();
    }
  };

  /** Swaps a category with its neighbour and saves the whole order. */
  const move = async (i, step) => {
    const list = [...data];
    [list[i], list[i + step]] = [list[i + step], list[i]];
    setData(list);
    try {
      await api.put('/admin/categories/order', { ids: list.map((c) => c.id) });
      reloadShop();
    } catch {
      toast.error(t('Something went wrong. Please try again.'));
      reload();
    }
  };

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
            <table className="table clickable">
              <thead>
                <tr>
                  <th>{t('Category')}</th>
                  <th>{t('Products')}</th>
                  <th>{t('Visible')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((c, i) => (
                  <tr key={c.id} className={c.active ? '' : 'dim'}>
                    <td>
                      <button type="button" className="prod-cell row-link" onClick={() => setEditing(c)}>
                        {c.image ? <img src={c.image} alt="" /> : <span className="thumb-empty" />}
                        <span>
                          <strong>{c.name}</strong>
                          <span className="muted small">/category/{c.slug}</span>
                        </span>
                      </button>
                    </td>
                    <td>
                      <Link to={`/admin/products?category=${c.id}`} className="link-btn">
                        {c.productCount}
                      </Link>
                    </td>
                    <td>
                      <Toggle checked={c.active} onChange={() => setVisible(c, !c.active)} label="" />
                    </td>
                    <td className="num nowrap">
                      <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Move up')}>
                        <ArrowUp size={16} />
                      </button>
                      <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === data.length - 1} aria-label={t('Move down')}>
                        <ArrowDown size={16} />
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
