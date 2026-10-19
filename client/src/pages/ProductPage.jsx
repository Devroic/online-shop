import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, Truck, ShieldCheck, RotateCcw, ShoppingBag } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { useCart } from '../context/CartContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { discountPercent } from '../lib/format.js';
import { renderMarkdown } from '../lib/markdown.js';
import { t } from '../lib/i18n.js';
import { Breadcrumbs, PageLoader, Price, QuantityStepper, useTitle } from '../components/ui.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import NotFound from './NotFound.jsx';

function Gallery({ images, name }) {
  const [active, setActive] = useState(0);
  const track = useRef(null);
  useEffect(() => setActive(0), [images]);

  const go = (i) => {
    setActive(i);
    const el = track.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: 'smooth' });
  };

  if (!images.length) return <div className="gallery-main img-placeholder" />;
  return (
    <div className="gallery">
      {/* Swipeable on touch screens thanks to CSS scroll-snap. */}
      <div
        className="gallery-main"
        ref={track}
        onScroll={(e) => {
          const i = Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth);
          if (i !== active) setActive(i);
        }}
      >
        {images.map((src, i) => (
          <img key={src} src={src} alt={i === 0 ? name : ''} loading={i === 0 ? 'eager' : 'lazy'} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <div className="gallery-dots only-mobile">
            {images.map((src, i) => (
              <span key={src} className={i === active ? 'active' : ''} />
            ))}
          </div>
          <div className="gallery-thumbs only-desktop">
            {images.map((src, i) => (
              <button key={src} className={i === active ? 'active' : ''} onClick={() => go(i)} aria-label={`${t('Image')} ${i + 1}`}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const { data, loading, error } = useFetch(`/products/${slug}`, { keepPrevious: false });
  const { add } = useCart();
  const { settings } = useShop();
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [needVariant, setNeedVariant] = useState(false);
  const product = data?.product;
  useTitle(product?.name);

  useEffect(() => {
    setQty(1);
    setNeedVariant(false);
    // Preselect when there is only one option in stock.
    const inStock = product?.variants.filter((v) => v.inStock) || [];
    setVariantId(product?.variants.length === 1 || inStock.length === 1 ? inStock[0]?.id ?? null : null);
  }, [product]);

  if (error?.status === 404) return <NotFound />;
  if (loading || !product) return <PageLoader />;

  const variant = product.variants.find((v) => v.id === variantId);
  const hasVariants = product.variants.length > 0;
  const price = variant ? variant.price : product.minPrice;
  const available = product.trackStock ? (variant ? variant.stock : hasVariants ? null : product.stock) : null;
  const canBuy = hasVariants ? (variant ? variant.inStock : product.inStock) : product.inStock;
  const off = discountPercent(price, product.compareAtPrice);
  const lowStock = available != null && available > 0 && available <= (settings.inventory.lowStockThreshold || 0);

  const onAdd = () => {
    if (hasVariants && !variant) {
      setNeedVariant(true);
      return;
    }
    add(product, variant, qty);
  };

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: t('Products'), to: '/products' },
          ...(product.category ? [{ label: product.category.name, to: `/category/${product.category.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <div className="product-layout">
        <Gallery images={product.images} name={product.name} />
        <div className="product-info">
          <h1>{product.name}</h1>
          <div className="product-price">
            <Price price={price} compareAt={product.compareAtPrice} from={hasVariants && !variant && product.minPrice !== product.maxPrice} />
            {off > 0 && <span className="badge badge-sale">-{off}%</span>}
          </div>
          {settings.checkout.pricesIncludeTax && <p className="muted small">{t('Price includes VAT')}</p>}

          {hasVariants && (
            <div className={`variant-picker ${needVariant ? 'need' : ''}`}>
              <div className="variant-label">
                {t('Option')}: <strong>{variant?.name || '—'}</strong>
              </div>
              <div className="variant-options" role="radiogroup">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    role="radio"
                    aria-checked={v.id === variantId}
                    className={`variant ${v.id === variantId ? 'active' : ''} ${v.inStock ? '' : 'soldout'}`}
                    disabled={!v.inStock}
                    onClick={() => {
                      setVariantId(v.id);
                      setNeedVariant(false);
                      setQty(1);
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              {needVariant && <p className="field-error">{t('Please choose an option')}</p>}
            </div>
          )}

          <div className="stock-line">
            {!canBuy ? (
              <span className="stock out">{t('Out of stock')}</span>
            ) : lowStock ? (
              <span className="stock low">{t('Only {n} left', { n: available })}</span>
            ) : (
              <span className="stock in">
                <Check size={16} /> {t('In stock')}
              </span>
            )}
          </div>

          <div className="buy-row">
            <QuantityStepper value={qty} onChange={setQty} max={available ?? undefined} />
            <button className="btn btn-primary btn-lg grow" disabled={!canBuy} onClick={onAdd}>
              <ShoppingBag size={18} /> {canBuy ? t('Add to cart') : t('Sold out')}
            </button>
          </div>

          <ul className="product-perks">
            <li>
              <Truck size={18} /> {t('Fast delivery')}
            </li>
            <li>
              <ShieldCheck size={18} /> {t('Secure checkout')}
            </li>
            <li>
              <RotateCcw size={18} /> <Link to="/p/shipping-returns">{t('Shipping & returns')}</Link>
            </li>
          </ul>

          {product.description && (
            <div className="prose product-description" dangerouslySetInnerHTML={{ __html: renderMarkdown(product.description) }} />
          )}
          {(variant?.sku || product.sku) && (
            <p className="muted small">
              {t('Code')}: {variant?.sku || product.sku}
            </p>
          )}
        </div>
      </div>

      {/* Sticky buy bar on phones, so the button is always reachable. */}
      <div className="sticky-buy only-mobile">
        <Price price={price} compareAt={product.compareAtPrice} />
        <button className="btn btn-primary" disabled={!canBuy} onClick={onAdd}>
          {canBuy ? t('Add to cart') : t('Sold out')}
        </button>
      </div>

      {data.related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t('You may also like')}</h2>
          </div>
          <ProductGrid products={data.related} />
        </section>
      )}
    </div>
  );
}
