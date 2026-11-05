import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Copy, ExternalLink, Package, ArrowLeft, FileSpreadsheet, Percent } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { EmptyState, Field, FieldWrap, FormAlert, PageLoader, Pagination, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { ImageUploader, Modal, MoneyInput, PageHeader, SaveBar, SaveButton, SearchInput, Toggle, useConfirm } from './components.jsx';
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
  const [selected, setSelected] = useState([]);
  const [discounting, setDiscounting] = useState(false);
  const currentCategory = categories.find((c) => String(c.id) === category) || null;
  const pageIds = data?.items.map((p) => p.id) || [];
  const allTicked = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const tick = (id) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

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
        <button className="btn btn-outline" onClick={() => setDiscounting(true)} disabled={!selected.length && !currentCategory}>
          <Percent size={16} /> {t('Discount')}
          {selected.length > 0 && <span className="tab-count">{selected.length}</span>}
        </button>
      </div>
      {!selected.length && !currentCategory && data?.items.length > 0 && (
        <p className="muted small">{t('Tick products, or choose a category, to give them a discount.')}</p>
      )}
      {discounting && (
        <DiscountModal
          ids={selected}
          category={currentCategory}
          onClose={() => setDiscounting(false)}
          onDone={() => {
            setDiscounting(false);
            setSelected([]);
            reload();
            reloadShop();
          }}
        />
      )}
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
            <table className="table clickable">
              <thead>
                <tr>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      checked={allTicked}
                      onChange={() => setSelected(allTicked ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])}
                      aria-label={t('Select all on this page')}
                    />
                  </th>
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
                    <td className="check-col">
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => tick(p.id)} aria-label={t('Select {name}', { name: p.name })} />
                    </td>
                    <td>
                      <Link to={`/admin/products/${p.id}`} className="prod-cell row-link">
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
                      {p.discountPercent > 0 && <span className="badge badge-sale badge-inline">-{p.discountPercent}%</span>}
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

/** Sets or removes a percentage discount on the ticked products, or on a whole category. */
function DiscountModal({ ids, category, onClose, onDone }) {
  const [target, setTarget] = useState(ids.length ? 'selected' : 'category');
  const [percent, setPercent] = useState('');
  const [busy, setBusy] = useState(false);
  const v = useValidation();
  const toast = useToast();
  const apply = async (value) => {
    if (value !== 0 && !v.validate({ percent }, { percent: [rules.required(), rules.integer(), rules.min(1), rules.max(90)] })) return;
    setBusy(true);
    try {
      const body = target === 'selected' ? { ids, percent: value } : { categoryId: Number(category.id), percent: value };
      const r = await api.post('/admin/products/discount', body);
      toast.success(value ? t('Discount set on {n} products', { n: r.updated }) : t('Discount removed from {n} products', { n: r.updated }));
      onDone();
    } catch (err) {
      v.fail(err);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t('Discount %')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost mr-auto" onClick={() => apply(0)} disabled={busy}>
            {t('Remove discount')}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => apply(Number(percent))} disabled={busy}>
            {busy && <Spinner />} {t('Apply discount')}
          </button>
        </>
      }
    >
      <div className="stack-sm">
        {ids.length > 0 && (
          <label className="checkbox">
            <input type="radio" name="target" checked={target === 'selected'} onChange={() => setTarget('selected')} />
            <span>{t('The {n} ticked products', { n: ids.length })}</span>
          </label>
        )}
        {category && (
          <label className="checkbox">
            <input type="radio" name="target" checked={target === 'category'} onChange={() => setTarget('category')} />
            <span>{t('All products in “{name}”', { name: category.name })}</span>
          </label>
        )}
      </div>
      <Field
        className="mt"
        label={t('Discount %')}
        inputMode="numeric"
        value={percent}
        placeholder="20"
        onChange={(e) => {
          v.clear('percent');
          setPercent(e.target.value.replace(/\D/g, '').slice(0, 2));
        }}
        error={v.errors.percent}
        hint={t('Prices stay as they are; the shop shows and charges them reduced, with the regular price crossed out.')}
        autoFocus
      />
      <FormAlert message={v.errors._} />
    </Modal>
  );
}

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  compareAtPrice: null,
  discountPercent: 0,
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
  const confirm = useConfirm();
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const toast = useToast();
  const { reload: reloadShop } = useShop();
  const categories = useFetch('/admin/categories').data || [];
  const existing = useFetch(isNew ? null : `/admin/products/${id}`, { keepPrevious: false });
  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(EMPTY);
  const v = useValidation();
  const { errors } = v;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let next = null;
    if (isNew) next = EMPTY;
    else if (existing.data) {
      const p = existing.data;
      next = {
        ...EMPTY,
        ...p,
        price: p.regularPrice ?? p.price,
        compareAtPrice: p.regularCompareAtPrice ?? null,
        discountPercent: p.discountPercent || 0,
        variants: p.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku, price: v.priceOverride, stock: v.stock })),
      };
    }
    if (next) {
      setForm(next);
      setInitial(next);
    }
  }, [isNew, existing.data]);

  if (!isNew && !existing.data) return <PageLoader />;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = (k, value) => {
    v.clear(k);
    setForm((f) => ({ ...f, [k]: value }));
  };
  const setVariant = (i, k, value) => {
    v.clear(`variants.${i}.${k}`);
    setForm((f) => ({ ...f, variants: f.variants.map((x, j) => (j === i ? { ...x, [k]: value } : x)) }));
  };
  // Removing a row shifts the ones below it, so their errors no longer match.
  const removeVariant = (i) => {
    v.reset();
    set('variants', form.variants.filter((_, j) => j !== i));
  };

  const body = () => ({
    name: form.name,
    slug: form.slug || undefined,
    description: form.description,
    price: form.price,
    compareAtPrice: form.compareAtPrice || null,
    discountPercent: Number(form.discountPercent) || 0,
    sku: form.sku,
    stock: form.stock,
    trackStock: form.trackStock,
    categoryId: form.categoryId || null,
    featured: form.featured,
    active: form.active,
    images: form.images,
    variants: form.variants,
  });

  const save = async (e) => {
    e.preventDefault();
    const schema = {
      name: [rules.required(), rules.maxLength(200)],
      description: [rules.maxLength(20000)],
      price: [rules.positive()],
      compareAtPrice: [(value) => (!form.discountPercent && value != null && value <= form.price ? 'above_price' : null)],
      discountPercent: [rules.integer(), rules.min(0), rules.max(90)],
      sku: [rules.maxLength(100)],
      slug: [rules.maxLength(100)],
    };
    form.variants.forEach((_, i) => {
      schema[`variants.${i}.name`] = [rules.required(), rules.maxLength(100)];
      schema[`variants.${i}.sku`] = [rules.maxLength(100)];
    });
    if (!v.validate(form, schema)) return;
    setSaving(true);
    try {
      const saved = isNew ? await api.post('/admin/products', body()) : await api.put(`/admin/products/${id}`, body());
      toast.success(t('Product saved'));
      reloadShop();
      if (isNew) navigate(`/admin/products/${saved.id}`, { replace: true });
      else existing.setData(saved);
    } catch (err) {
      v.fail(err);
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
    if (!(await confirm({ title: t('Delete this product?'), message: t('This cannot be undone.'), confirmLabel: t('Delete'), danger: true }))) return;
    await api.del(`/admin/products/${id}`);
    toast.success(t('Product deleted'));
    reloadShop();
    navigate('/admin/products', { replace: true });
  };

  return (
    <form onSubmit={save} noValidate>
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
            <SaveButton dirty={dirty} saving={saving} submit />
          </>
        }
      />
      <FormAlert message={errors._} />
      <div className="a-edit">
        <div className="stack">
          <section className="card">
            <Field label={t('Name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} autoFocus={isNew} />
            <Field
              as="textarea"
              rows={3}
              autoGrow
              label={t('Description')}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              error={errors.description}
              hint={t('Tip: **bold**, - bullet lists and ## headings are supported.')}
            />
          </section>

          <section className="card">
            <h3>{t('Images')}</h3>
            <p className="muted small">{t('The first image is shown in listings. Drag to reorder. Square photos look best.')}</p>
            <FieldWrap error={errors.images}>
              <ImageUploader value={form.images} onChange={(list) => set('images', list)} />
            </FieldWrap>
          </section>

          <section className="card">
            <h3>{t('Pricing')}</h3>
            <div className="grid-2">
              <FieldWrap label={t('Price')} error={errors.price}>
                <MoneyInput value={form.price} onChange={(cents) => set('price', cents)} aria-invalid={!!errors.price} />
              </FieldWrap>
              <FieldWrap
                label={t('Compare-at price (optional)')}
                error={errors.compareAtPrice}
                hint={form.discountPercent > 0 ? t('Not used while there is a discount: the regular price is shown crossed out.') : t('Shown crossed out, to display a sale.')}
              >
                <MoneyInput value={form.compareAtPrice} onChange={(cents) => set('compareAtPrice', cents)} allowEmpty disabled={form.discountPercent > 0} aria-invalid={!!errors.compareAtPrice} />
              </FieldWrap>
            </div>
            <div className="grid-2">
              <Field
                label={t('Discount %')}
                inputMode="numeric"
                value={form.discountPercent || ''}
                placeholder="0"
                onChange={(e) => set('discountPercent', e.target.value.replace(/\D/g, '').slice(0, 2))}
                error={errors.discountPercent}
                hint={
                  form.discountPercent > 0
                    ? t('Customers pay {price} instead of {regular}.', {
                        price: money(Math.round((form.price * (100 - form.discountPercent)) / 100)),
                        regular: money(form.price),
                      })
                    : t('The price stays as it is; the shop shows and charges it reduced. 0 removes the discount.')
                }
              />
            </div>
          </section>

          <section className="card">
            <h3>{t('Inventory')}</h3>
            <Toggle checked={form.trackStock} onChange={(on) => set('trackStock', on)} label={t('Track stock')} hint={t('Stop selling when stock reaches zero')} />
            <div className="grid-2 mt">
              <Field label={t('Code (SKU)')} value={form.sku} onChange={(e) => set('sku', e.target.value)} error={errors.sku} />
              {form.trackStock && !form.variants.length && (
                <Field
                  label={t('Stock')}
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => set('stock', Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0))}
                  error={errors.stock}
                />
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
                {form.variants.map((variant, i) => {
                  const err = (k) => errors[`variants.${i}.${k}`];
                  const rowErrors = ['name', 'price', 'stock', 'sku'].map(err).filter(Boolean);
                  return (
                    <div key={variant.id || `new-${i}`} className={`variants-item ${rowErrors.length ? 'has-error' : ''}`}>
                      <div className="variants-row">
                        <input
                          className="input"
                          value={variant.name}
                          onChange={(e) => setVariant(i, 'name', e.target.value)}
                          placeholder={t('e.g. Medium')}
                          aria-label={t('Option name')}
                          aria-invalid={!!err('name')}
                        />
                        <MoneyInput
                          value={variant.price}
                          onChange={(cents) => setVariant(i, 'price', cents)}
                          allowEmpty
                          placeholder={(form.price / 100).toFixed(2)}
                          aria-label={t('Price')}
                          aria-invalid={!!err('price')}
                        />
                        {form.trackStock && (
                          <input
                            className="input"
                            inputMode="numeric"
                            value={variant.stock}
                            onChange={(e) => setVariant(i, 'stock', Math.max(0, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0))}
                            aria-label={t('Stock')}
                            aria-invalid={!!err('stock')}
                          />
                        )}
                        <input className="input" value={variant.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} aria-label={t('Code (SKU)')} aria-invalid={!!err('sku')} />
                        <button type="button" className="icon-btn" onClick={() => removeVariant(i)} aria-label={t('Remove')}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {rowErrors.length > 0 && (
                        <span className="field-error" role="alert">
                          {rowErrors[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
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
            <Toggle checked={form.active} onChange={(on) => set('active', on)} label={t('Visible in shop')} />
            <Toggle checked={form.featured} onChange={(on) => set('featured', on)} label={t('Featured')} hint={t('Shown in the Featured section of the home page.')} />
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
            <Field label={t('URL')} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder={t('Generated from the name')} hint={form.slug && `/product/${form.slug}`} error={errors.slug} />
          </section>
          {!isNew && (
            <button type="button" className="btn btn-ghost danger-text" onClick={remove}>
              <Trash2 size={16} /> {t('Delete product')}
            </button>
          )}
        </div>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        submit
        onDiscard={() => {
          v.reset();
          setForm(initial);
        }}
      />
    </form>
  );
}
