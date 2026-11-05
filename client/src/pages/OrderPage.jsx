import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck, Package, Truck, Store, Clock, XCircle, Undo2 } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { countryName } from '../lib/countries.js';
import { takePaidCardOrder, useCart } from '../context/CartContext.jsx';
import { money, dateTime } from '../lib/format.js';
import { t, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, paymentName, paymentStatusName, statusName } from '../lib/i18n.js';
import { EmptyState, PageLoader, useTitle } from '../components/ui.jsx';

const STEPS = ['pending', 'processing', 'shipped', 'delivered'];

export function StatusTimeline({ status, order }) {
  if (status === 'cancelled') {
    return (
      <div className="timeline cancelled">
        <XCircle size={20} /> {t('This order was cancelled')}
      </div>
    );
  }
  if (status === 'returned') {
    return (
      <div className="timeline cancelled">
        <Undo2 size={20} /> {t('This order was returned')}
      </div>
    );
  }
  const idx = STEPS.indexOf(status);
  const icons = [Clock, Package, order && !order.address ? Store : Truck, CircleCheck];
  return (
    <ol className="timeline">
      {STEPS.map((s, i) => {
        const Icon = icons[i];
        return (
          <li key={s} className={i <= idx ? 'done' : ''}>
            <span className="timeline-dot">
              <Icon size={16} />
            </span>
            <span>{statusName(s, order)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTotals({ order }) {
  return (
    <div className="summary-rows">
      <div className="summary-row">
        <span>{t('Subtotal')}</span>
        <span>{money(order.subtotal)}</span>
      </div>
      {order.discount > 0 && (
        <div className="summary-row discount">
          <span>
            {t('Discount')} {order.couponCode && `(${order.couponCode})`}
          </span>
          <span>-{money(order.discount)}</span>
        </div>
      )}
      <div className="summary-row">
        <span>
          {t('Shipping')} · {order.shippingName}
        </span>
        <span>{order.shippingCost ? money(order.shippingCost) : t('Free')}</span>
      </div>
      {order.paymentFee > 0 && (
        <div className="summary-row">
          <span>{t('Cash on delivery fee')}</span>
          <span>{money(order.paymentFee)}</span>
        </div>
      )}
      <div className="summary-row total">
        <span>{t('Total')}</span>
        <span>{money(order.total)}</span>
      </div>
    </div>
  );
}

export function OrderItems({ items }) {
  return (
    <div className="summary-items">
      {items.map((i) => (
        <div key={i.id} className="summary-item">
          <div className="summary-thumb">
            {i.image ? <img src={i.image} alt="" /> : <div className="img-placeholder" />}
            <span className="qty-badge">{i.quantity}</span>
          </div>
          <div className="grow">
            {i.slug ? (
              <Link to={`/product/${i.slug}`} className="summary-name">
                {i.name}
              </Link>
            ) : (
              <div className="summary-name">{i.name}</div>
            )}
            {i.variantName && <div className="muted small">{i.variantName}</div>}
            <div className="muted small">
              {i.quantity} × {money(i.price)}
            </div>
          </div>
          <div>{money(i.price * i.quantity)}</div>
        </div>
      ))}
    </div>
  );
}

export default function OrderPage() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token');
  const isNew = params.get('new') === '1' || params.get('paid') === '1';
  const { user } = useAuth();
  const { data, loading, error } = useFetch(`/orders/${encodeURIComponent(number)}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  useTitle(t('Order #{n}', { n: number }));
  const { clear } = useCart();
  const paidNumber = data?.order?.paymentStatus === 'paid' ? data.order.number : null;
  useEffect(() => {
    if (paidNumber && takePaidCardOrder(paidNumber)) clear();
  }, [paidNumber, clear]);

  if (loading && !data) return <PageLoader />;
  if (error || !data) {
    return (
      <div className="container narrow">
        <EmptyState
          icon={Package}
          title={t('Order not found')}
          text={t('Check the link in your confirmation email, or look up your order.')}
          action={
            <Link to="/track" className="btn btn-primary">
              {t('Track order')}
            </Link>
          }
        />
      </div>
    );
  }
  const { order } = data;
  const a = order.address;

  return (
    <div className="container order-page">
      {isNew && (
        <div className="order-hero">
          <CircleCheck size={48} />
          <h1>{t('Thank you for your order!')}</h1>
          <p>
            {t('Your order number is')} <strong>#{order.number}</strong>. {t('We sent a confirmation to {email}.', { email: order.email })}
          </p>
        </div>
      )}
      {!isNew && <h1 className="page-title">{t('Order #{n}', { n: order.number })}</h1>}

      <div className="two-col">
        <div className="stack">
          <section className="card">
            <div className="order-meta">
              <div>
                <div className="muted small">{t('Placed on')}</div>
                <strong>{dateTime(order.createdAt)}</strong>
              </div>
              <div>
                <div className="muted small">{t('Payment')}</div>
                <strong>{paymentName(order.paymentMethod, order)}</strong>
                <span className={`status status-${order.paymentStatus}`}>{paymentStatusName(order)}</span>
              </div>
            </div>
            <StatusTimeline status={order.status} order={order} />
            {(order.trackingNumber || order.trackingUrl) && (
              <div className="tracking">
                {order.trackingNumber && (
                  <p>
                    {t('Tracking number')}: <strong>{order.trackingNumber}</strong>
                  </p>
                )}
                {order.trackingUrl && (
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    <Truck size={16} /> {t('Track your parcel')}
                  </a>
                )}
              </div>
            )}
          </section>

          <section className="card">
            <h3>{t('Delivery')}</h3>
            <p>
              <strong>{order.customerName}</strong>
              <br />
              {a && (
                <>
                  {a.street}
                  <br />
                  {a.postalCode} {a.city}
                  {a.region && `, ${a.region}`}
                  <br />
                  {a.country && (
                    <>
                      {countryName(a.country)}
                      <br />
                    </>
                  )}
                </>
              )}
              {order.phone && (
                <>
                  {order.phone}
                  <br />
                </>
              )}
              {order.email}
            </p>
            <p className="muted">{order.shippingName}</p>
            {order.notes && (
              <p>
                <span className="muted">{t('Notes')}:</span> {order.notes}
              </p>
            )}
          </section>
        </div>

        <aside className="card summary">
          <h3>{t('Order summary')}</h3>
          <OrderItems items={order.items} />
          <OrderTotals order={order} />
        </aside>
      </div>

      <div className="center-actions">
        <Link to="/products" className="btn btn-primary">
          {t('Continue shopping')}
        </Link>
        {!user && isNew && (
          <Link to={`/register?email=${encodeURIComponent(order.email)}`} className="btn btn-outline">
            {t('Create an account to track orders faster')}
          </Link>
        )}
      </div>
    </div>
  );
}
