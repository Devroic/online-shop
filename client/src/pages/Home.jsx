import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { shownPerks } from '../lib/perks.js';
import { useShop } from '../context/ShopContext.jsx';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import { ProductGridSkeleton, useTitle } from '../components/ui.jsx';

function Section({ title, link, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {link && (
          <Link to={link} className="link-arrow">
            {t('View all')} <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const { settings, categories } = useShop();
  const featured = useFetch('/products?featured=1&limit=8');
  const latest = useFetch('/products?sort=newest&limit=8');
  useTitle('');
  const { hero } = settings;
  const perks = shownPerks(settings);

  return (
    <>
      <section className={`hero ${hero.imageUrl ? 'has-image' : ''}`}>
        {hero.imageUrl && <img src={hero.imageUrl} alt="" className="hero-img" />}
        <div className="container hero-inner">
          <div className="hero-content">
            <h1>{hero.title}</h1>
            {hero.subtitle && <p>{hero.subtitle}</p>}
            {hero.ctaText && (
              <Link to={hero.ctaLink || '/products'} className="btn btn-primary btn-lg">
                {hero.ctaText} <ArrowRight size={18} />
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="container">
        {categories.length > 0 && (
          <section className="section">
            <div className="category-tiles">
              {categories.slice(0, 8).map((c) => (
                <Link key={c.id} to={`/category/${c.slug}`} className="category-tile">
                  {c.image ? <img src={c.image} alt="" loading="lazy" /> : <div className="category-tile-fill" />}
                  <span>{c.name}</span>
                </Link>
              ))}
            </div>
            {categories.length > 8 && (
              <Link to="/products" className="link-arrow mt-sm">
                {t('All categories')} <ArrowRight size={16} />
              </Link>
            )}
          </section>
        )}

        {(featured.loading || featured.data?.items.length > 0) && (
          <Section title={t('Featured')} link="/products">
            {featured.data ? <ProductGrid products={featured.data.items} /> : <ProductGridSkeleton count={4} />}
          </Section>
        )}

        {perks.length > 0 && (
          <section className="perks">
            {perks.map(({ key, icon: Icon, title, text }) => (
              <div key={key}>
                <Icon size={24} />
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
            ))}
          </section>
        )}

        <Section title={t('New arrivals')} link="/products?sort=newest">
          {latest.data ? <ProductGrid products={latest.data.items} /> : <ProductGridSkeleton count={4} />}
        </Section>
      </div>
    </>
  );
}
