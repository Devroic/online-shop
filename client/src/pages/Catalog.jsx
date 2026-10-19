import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import { qs } from '../lib/api.js';
import { parseMoney } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import { Breadcrumbs, Checkbox, EmptyState, Pagination, ProductGridSkeleton, useTitle } from '../components/ui.jsx';
import NotFound from './NotFound.jsx';

const SORTS = [
  ['featured', 'Recommended'],
  ['newest', 'Newest'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name'],
];

export default function Catalog() {
  const { slug } = useParams();
  const { categories } = useShop();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const category = slug ? categories.find((c) => c.slug === slug) : null;

  const q = params.get('q') || '';
  const sort = params.get('sort') || 'featured';
  const page = Number(params.get('page') || 1);
  const inStock = params.get('inStock') === '1';
  const min = params.get('min') || '';
  const max = params.get('max') || '';

  const { data, loading } = useFetch(
    `/products${qs({ q, sort, page, inStock: inStock ? 1 : '', category: slug, minPrice: parseMoney(min), maxPrice: parseMoney(max), limit: 24 })}`,
  );

  const title = category ? category.name : q ? t('Results for “{q}”', { q }) : t('All products');
  useTitle(title);
  if (slug && !category) return <NotFound />;

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const activeFilters = (inStock ? 1 : 0) + (min ? 1 : 0) + (max ? 1 : 0);

  return (
    <div className="container">
      <Breadcrumbs items={category ? [{ label: t('Products'), to: '/products' }, { label: category.name }] : [{ label: t('Products') }]} />
      <div className="catalog-head">
        <div>
          <h1>{title}</h1>
          {category?.description && <p className="muted">{category.description}</p>}
          {data && <p className="muted small">{t('{n} products', { n: data.total })}</p>}
        </div>
      </div>

      <div className="chips" role="list">
        <Link to={`/products${qs({ q })}`} className={`chip ${!slug ? 'active' : ''}`}>
          {t('All')}
        </Link>
        {categories.map((c) => (
          <Link key={c.id} to={`/category/${c.slug}${qs({ q })}`} className={`chip ${slug === c.slug ? 'active' : ''}`}>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="toolbar">
        <button className={`btn btn-outline btn-sm ${activeFilters ? 'has-count' : ''}`} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={16} /> {t('Filters')} {activeFilters > 0 && <span className="count">{activeFilters}</span>}
        </button>
        <label className="sort">
          <span className="muted small">{t('Sort by')}</span>
          <select value={sort} onChange={(e) => update({ sort: e.target.value === 'featured' ? '' : e.target.value })}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtersOpen && (
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update({ min: f.get('min'), max: f.get('max') });
          }}
        >
          <Checkbox label={t('In stock only')} checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? '1' : '' })} />
          <div className="price-range">
            <input name="min" defaultValue={min} inputMode="decimal" placeholder={t('Min €')} aria-label={t('Min price')} />
            <span>–</span>
            <input name="max" defaultValue={max} inputMode="decimal" placeholder={t('Max €')} aria-label={t('Max price')} />
            <button className="btn btn-sm btn-primary">{t('Apply')}</button>
          </div>
          {activeFilters > 0 && (
            <button type="button" className="link-btn" onClick={() => update({ inStock: '', min: '', max: '' })}>
              <X size={14} /> {t('Clear filters')}
            </button>
          )}
        </form>
      )}

      {!data && loading ? (
        <ProductGridSkeleton />
      ) : data?.items.length ? (
        <div className={loading ? 'is-loading' : ''}>
          <ProductGrid products={data.items} />
          <Pagination
            page={page}
            pages={data.pages}
            onChange={(p) => {
              update({ page: p > 1 ? String(p) : '' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      ) : (
        <EmptyState
          icon={PackageSearch}
          title={t('No products found')}
          text={q || activeFilters ? t('Try a different search or clear the filters.') : t('New products are coming soon.')}
          action={
            (q || activeFilters > 0) && (
              <Link to="/products" className="btn btn-outline">
                {t('View all products')}
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
