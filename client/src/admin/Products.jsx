import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Copy, ExternalLink, Package, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { EmptyState, Field, PageLoader, Pagination, Spinner, fieldErrors } from '../components/ui.jsx';
import { ImageUploader, MoneyInput, PageHeader, SearchInput, Toggle } from './components.jsx';
import ProductImport from './ProductImport.jsx';

function StockCell({ product, onSaved }) {
  const [value, setValue] = useState(product.stock);
  const toast = useToast();
  useEffect(() => {
    setValue(product.stock);
  }, [product.stock]);
  if (!product.trackStock) return <span className="muted">∞</span>;
  if (product.variants.length) {
    return (
      <span className={`stock-pill ${product.stock === 0 ? 'zero' : ''}`} title={t('Sum of all options')}>
        {product.stock}
      </span>
    );
  }
  const save = async () => {
    if (value === product.stock) return;
    try {
      onSaved(await api.patch(`/admin/products/${product.id}`, { stock: value }));
      toast.success(t('Stock updated'));
    } catch {
      toast.error(t('Could not save'));
    }
  };
  return (
    <input
      className="input inline-num"
      type="number"
      min="0"
      value={value}
      onChange={(e) => setValue(Math.max(0, parseInt(e.target.value, 10) || 0))}
      onBlur={save}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label={t('Stock')}
    />
  );
}

export function ProductList() {
  const [params, setParams] = useSearchParams();
  const categories = useFetch('/admin/categories').data || [];
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const page = Number(params.get('page') || 1);
  const { data, setData, loading, reload } = useFetch(`/admin/products${qs({ q, category, page })}`);
  const toast = useToast();
  const { reload: reloadShop } = useShop();
  const [importing, setImporting] = useState(false);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const replace = (p) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === p.id ? p : x)) }));
  const toggle = async (p, field) => {
    try {
      replace(await api.patch(`/admin/products/${p.id}`, { [field]: !p[field] }));
    } catch {
      toast.error(t('Could not save'));
    }
  };

  return (
    <>
      <PageHeader
        title={t('Products')}
        subtitle={data && t('{n} products', { n: data.total })}
        actions={
          <>
            <button className="btn btn-outline" onClick={() => setImporting(true)}>
              <FileSpreadsheet size={18} /> {t('Import from Excel')}
            </button>
            <Link to="/admin/products/new" className="btn btn-primary">
              <Plus size={18} /> {t('Add product')}
            </Link>
          </>
        }
      />
      {importing && (
        <ProductImport
          onClose={() => setImporting(false)}
          onDone={() => {
            reload();
            reloadShop();
          }}
        />
      )}
      <div className="a-filters">
        <SearchInput value={q} onChange={(v) => update({ q: v })} placeholder={t('Search by name or code…')} />
        <select className="input" value={category} onChange={(e) => update({ category: e.target.value })}>
          <option value="">{t('All categories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {!data ? (
        <PageLoader />
      ) : !data.items.length ? (
        <EmptyState
          icon={Package}
          title={q ? t('No products found') : t('No products yet')}
          text={!q && t('Add your first product to start selling, or import them all at once from Excel.')}
          action={
            !q && (
              <div className="row-gap center">
                <Link to="/admin/products/new" className="btn btn-primary">
                  <Plus size={18} /> {t('Add product')}
                </Link>
                <button className="btn btn-outline" onClick={() => setImporting(true)}>
                  <FileSpreadsheet size={18} /> {t('Import from Excel')}
                </button>
              </div>
            )
          }
        />
      ) : (
        <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Product')}</th>
                  <th>{t('Price')}</th>
                  <th>{t('Stock')}</th>
                  <th>{t('Featured')}</th>
                  <th>{t('Visible')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className={p.active ? '' : 'dim'}>
                    <td>
                      <Link to={`/admin/products/${p.id}`} className="prod-cell">
                        {p.images[0] ? <img src={p.images[0]} alt="" /> : <span className="thumb-empty" />}
                        <span>
                          <strong>{p.name}</strong>
                          <span className="muted small">
                            {p.category?.name || t('No category')}
                            {p.variants.length > 0 && ` · ${t('{n} options', { n: p.variants.length })}`}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="nowrap">
                      {money(p.minPrice)}
                      {p.maxPrice !== p.minPrice && ` – ${money(p.maxPrice)}`}
                    </td>
                    <td>
                      <StockCell product={p} onSaved={replace} />
                    </td>
                    <td>
                      <Toggle checked={p.featured} onChange={() => toggle(p, 'featured')} label="" />
                    </td>
                    <td>
                      <Toggle checked={p.active} onChange={() => toggle(p, 'active')} label="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pagination page={page} pages={data.pages} onChange={(p) => update({ page: p > 1 ? String(p) : '' })} />}
    </>
  );
}

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  compareAtPrice: null,
  sku: '',
  stock: 0,
  trackStock: true,
  categoryId: null,
  featured: false,
  active: true,
  images: [],
  variants: [],
};

export function ProductEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { reload: reloadShop } = useShop();
  const categories = useFetch('/admin/categories').data || [];
  const existing = useFetch(isNew ? null : `/admin/products/${id}`, { keepPrevious: false });
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) setForm(EMPTY);
    else if (existing.data) {
      const p = existing.data;
      setForm({
        ...EMPTY,
        ...p,
        variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, price: v.priceOverride, stock: v.stock })),
      });
    }
  }, [isNew, existing.data]);

  if (!isNew && !existing.data) return <PageLoader />;

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setVariant = (i, k, v) => set('variants', form.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const body = () => ({
    name: form.name,
    slug: form.slug || undefined,
    description: form.description,
    price: form.price,
    compareAtPrice: form.compareAtPrice || null,
    sku: form.sku,
    stock: form.stock,
    trackStock: form.trackStock,
    categoryId: form.categoryId || null,
    featured: form.featured,
    active: form.active,
    images: form.images,
    variants: form.variants.filter((v) => v.name.trim()),
  });

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: t('This field is required') });
      return;
    }
    setSaving(true);
    try {
      const saved = isNew ? await api.post('/admin/products', body()) : await api.put(`/admin/products/${id}`, body());
      toast.success(t('Product saved'));
      reloadShop();
      if (isNew) navigate(`/admin/products/${saved.id}`, { replace: true });
      else existing.setData(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(t('Please check the highlighted fields.'));
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    const copy = { ...body(), name: `${form.name} (${t('copy')})`, slug: undefined, active: false, variants: body().variants.map(({ id: _id, ...v }) => v) };
    const saved = await api.post('/admin/products', copy);
    toast.success(t('Product duplicated'));
    navigate(`/admin/products/${saved.id}`);
  };

  const remove = async () => {
    if (!window.confirm(t('Delete this product? This cannot be undone.'))) return;
    await api.del(`/admin/products/${id}`);
    toast.success(t('Product deleted'));
    reloadShop();
    navigate('/admin/products', { replace: true });
  };

  return (
    <form onSubmit={save}>
      <Link to="/admin/products" className="back-link">
        <ArrowLeft size={16} /> {t('Products')}
      </Link>
      <PageHeader
        title={isNew ? t('New product') : form.name || t('Product')}
        actions={
          <>
            {!isNew && (
              <>
                <a href={`/product/${existing.data.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  <ExternalLink size={16} /> {t('View')}
                </a>
                <button type="button" className="btn btn-ghost" onClick={duplicate}>
                  <Copy size={16} /> {t('Duplicate')}
                </button>
              </>
            )}
            <button className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />} {t('Save')}
            </button>
          </>
        }
      />
      <div className="a-edit">
        <div className="stack">
          <section className="card">
            <Field label={t('Name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoFocus={isNew} />
            <Field
              as="textarea"
              rows={8}
              label={t('Description')}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              hint={t('Tip: **bold**, - bullet lists and ## headings are supported.')}
            />
          </section>

          <section className="card">
            <h3>{t('Images')}</h3>
            <p className="muted small">{t('The first image is shown in listings. Drag to reorder. Square photos look best.')}</p>
            <ImageUploader value={form.images} onChange={(v) => set('images', v)} />
          </section>

          <section className="card">
            <h3>{t('Pricing')}</h3>
            <div className="grid-2">
              <div className="field">
                <label>{t('Price')}</label>
                <MoneyInput value={form.price} onChange={(v) => set('price', v)} />
              </div>
              <div className="field">
                <label>{t('Compare-at price (optional)')}</label>
                <MoneyInput value={form.compareAtPrice} onChange={(v) => set('compareAtPrice', v)} allowEmpty />
                <span className="field-hint">{t('Shown crossed out, to display a sale.')}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>{t('Inventory')}</h3>
            <Toggle checked={form.trackStock} onChange={(v) => set('trackStock', v)} label={t('Track stock')} hint={t('Stop selling when stock reaches zero')} />
            <div className="grid-2 mt">
              <Field label={t('Code (SKU)')} value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              {form.trackStock && !form.variants.length && (
                <Field label={t('Stock')} type="number" min="0" value={form.stock} onChange={(e) => set('stock', Math.max(0, parseInt(e.target.value, 10) || 0))} />
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h3>{t('Options')}</h3>
                <p className="muted small">{t('Sizes, colours, scents… Each option can have its own stock and price.')}</p>
              </div>
            </div>
            {form.variants.length > 0 && (
              <div className="variants-table">
                <div className="variants-row head">
                  <span>{t('Option name')}</span>
                  <span>{t('Price')}</span>
                  {form.trackStock && <span>{t('Stock')}</span>}
                  <span>{t('Code (SKU)')}</span>
                  <span />
                </div>
                {form.variants.map((v, i) => (
                  <div key={v.id || `new-${i}`} className="variants-row">
                    <input className="input" value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)} placeholder={t('e.g. Medium')} aria-label={t('Option name')} />
                    <MoneyInput value={v.price} onChange={(val) => setVariant(i, 'price', val)} allowEmpty placeholder={(form.price / 100).toFixed(2)} aria-label={t('Price')} />
                    {form.trackStock && (
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={v.stock}
                        onChange={(e) => setVariant(i, 'stock', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        aria-label={t('Stock')}
                      />
                    )}
                    <input className="input" value={v.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} aria-label={t('Code (SKU)')} />
                    <button type="button" className="icon-btn" onClick={() => set('variants', form.variants.filter((_, j) => j !== i))} aria-label={t('Remove')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => set('variants', [...form.variants, { name: '', sku: '', price: null, stock: 0 }])}>
              <Plus size={16} /> {t('Add option')}
            </button>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h3>{t('Status')}</h3>
            <Toggle checked={form.active} onChange={(v) => set('active', v)} label={t('Visible in shop')} />
            <Toggle checked={form.featured} onChange={(v) => set('featured', v)} label={t('Featured on home page')} />
          </section>
          <section className="card">
            <h3>{t('Organisation')}</h3>
            <Field as="select" label={t('Category')} value={form.categoryId || ''} onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t('No category')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Field>
            {categories.length === 0 && (
              <p className="muted small">
                <Link to="/admin/categories">{t('Create categories')}</Link>
              </p>
            )}
            <Field label={t('URL')} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={t('Generated from the name')} hint={form.slug && `/product/${form.slug}`} />
          </section>
          {!isNew && (
            <button type="button" className="btn btn-ghost danger-text" onClick={remove}>
              <Trash2 size={16} /> {t('Delete product')}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
