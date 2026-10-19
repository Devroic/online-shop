import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { useShop } from '../context/ShopContext.jsx';
import { t, PAYMENT_METHOD } from '../lib/i18n.js';
import { FacebookIcon, InstagramIcon, TiktokIcon } from './ui.jsx';

export default function Footer() {
  const { settings, pages, categories } = useShop();
  const { contact, social } = settings;
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">{settings.storeName}</div>
          {settings.tagline && <p className="muted">{settings.tagline}</p>}
          <div className="social">
            {social.facebook && (
              <a href={social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                <FacebookIcon />
              </a>
            )}
            {social.instagram && (
              <a href={social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <InstagramIcon />
              </a>
            )}
            {social.tiktok && (
              <a href={social.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
                <TiktokIcon />
              </a>
            )}
          </div>
        </div>
        <div>
          <h4>{t('Shop')}</h4>
          <ul>
            <li>
              <Link to="/products">{t('All products')}</Link>
            </li>
            {categories.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{t('Help')}</h4>
          <ul>
            <li>
              <Link to="/track">{t('Track order')}</Link>
            </li>
            <li>
              <Link to="/contact">{t('Contact')}</Link>
            </li>
            {pages
              .filter((p) => p.showInFooter)
              .map((p) => (
                <li key={p.slug}>
                  <Link to={`/p/${p.slug}`}>{p.title}</Link>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h4>{t('Contact')}</h4>
          <ul className="contact-list">
            {contact.phone && (
              <li>
                <Phone size={16} /> <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
              </li>
            )}
            {contact.email && (
              <li>
                <Mail size={16} /> <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
            )}
            {contact.address && (
              <li>
                <MapPin size={16} /> <span>{contact.address}</span>
              </li>
            )}
            {contact.hours && (
              <li>
                <Clock size={16} /> <span>{contact.hours}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {settings.storeName}
        </span>
        <span className="payment-badges">
          {settings.paymentMethods.map((m) => (
            <span key={m} className="pill">
              {t(PAYMENT_METHOD[m])}
            </span>
          ))}
        </span>
      </div>
    </footer>
  );
}
