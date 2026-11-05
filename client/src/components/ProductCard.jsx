import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { discountPercent } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { Price } from './ui.jsx';

const CYCLE_MS = 1200; // time each photo stays while the mouse is over the card

export default function ProductCard({ product }) {
  const { add } = useCart();
  const off = discountPercent(product.price, product.compareAtPrice);
  const hasVariants = product.variants.length > 0;
  const [img, ...more] = product.images;

  // While hovered: show the 2nd photo at once, then go through all of them and back to the 1st.
  const [hovered, setHovered] = useState(false);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!hovered || !more.length) return setShown(0);
    setShown(1);
    const id = setInterval(() => setShown((i) => (i + 1) % product.images.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [hovered, more.length, product.images.length]);

  return (
    <article className={`product-card ${product.inStock ? '' : 'is-soldout'}`}>
      <Link
        to={`/product/${product.slug}`}
        className="product-card-media"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <div className="img-placeholder" />}
        {more.map((src, i) => (
          <img key={src} src={src} alt="" loading="lazy" className={`hover-img ${shown === i + 1 ? 'is-shown' : ''}`} aria-hidden="true" />
        ))}
        <div className="badges">
          {!product.inStock && <span className="badge badge-dark">{t('Sold out')}</span>}
          {product.inStock && off > 0 && <span className="badge badge-sale">-{off}%</span>}
        </div>
      </Link>
      <div className="product-card-body">
        <Link to={`/product/${product.slug}`} className="product-card-title">
          {product.name}
        </Link>
        <div className="product-card-foot">
          <Price price={product.minPrice} compareAt={product.compareAtPrice} from={product.minPrice !== product.maxPrice} />
          {product.inStock &&
            (hasVariants ? (
              <Link to={`/product/${product.slug}`} className="quick-add" aria-label={`${t('Choose options')}: ${product.name}`}>
                <Plus size={18} />
              </Link>
            ) : (
              <button className="quick-add" onClick={() => add(product, null, 1)} aria-label={`${t('Add to cart')}: ${product.name}`}>
                <Plus size={18} />
              </button>
            ))}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
