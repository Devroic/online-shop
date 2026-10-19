import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { discountPercent } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { Price } from './ui.jsx';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const off = discountPercent(product.price, product.compareAtPrice);
  const hasVariants = product.variants.length > 0;
  const [img, hover] = product.images;

  return (
    <article className={`product-card ${product.inStock ? '' : 'is-soldout'}`}>
      <Link to={`/product/${product.slug}`} className="product-card-media">
        {img ? <img src={img} alt={product.name} loading="lazy" /> : <div className="img-placeholder" />}
        {hover && <img src={hover} alt="" loading="lazy" className="hover-img" aria-hidden="true" />}
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
