import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck, Landmark, Copy, Package, Truck, Clock, XCircle } from 'lucide-react';
import { useFetch } from '../lib/useFetch.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { money, dateTime } from '../lib/format.js';
import { t, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from '../lib/i18n.js';
import { EmptyState, PageLoader, useTitle } from '../components/ui.jsx';

const STEPS = ['pending', 'processing', 'shipped', 'delivered'];

export function StatusTimeline({ status }) {
  if (status === 'cancelled') {
    return (
      <div className="timeline cancelled">
        <XCircle size={20} /> {t('This order was cancelled')}
      </div>
    );
  }
  const idx = STEPS.indexOf(status);
  const icons = [Clock, Package, Truck, CircleCheck];
  return (
    <ol className="timeline">
      {STEPS.map((s, i) => {
        const Icon = icons[i];
        return (
          <li key={s} className={i <= idx ? 'done' : ''}>
            <span className="timeline-dot">
              <Icon size={16} />
            </span>
            <span>{t(ORDER_STATUS[s])}</span>
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
  const toast = useToast();
  const { data, loading, error } = useFetch(`/orders/${encodeURIComponent(number)}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  useTitle(t('Order #{n}', { n: number }));

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
  const { order, bankDetails } = data;
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
                <strong>{t(PAYMENT_METHOD[order.paymentMethod])}</strong>
                <span className={`status status-${order.paymentStatus}`}>{t(PAYMENT_STATUS[order.paymentStatus])}</span>
              </div>
            </div>
            <StatusTimeline status={order.status} />
            {order.trackingNumber && (
              <p>
                {t('Tracking number')}: <strong>{order.trackingNumber}</strong>
              </p>
            )}
          </section>

          {order.paymentMethod === 'bank' && order.paymentStatus === 'pending' && order.status !== 'cancelled' && bankDetails && (
            <section className="card bank-box">
              <h3>
                <Landmark size={20} /> {t('Complete your payment by bank transfer')}
              </h3>
              <pre>{bankDetails}</pre>
              <p>
                {t('Amount')}: <strong>{money(order.total)}</strong>
                <br />
                {t('Reference')}: <strong>{order.number}</strong>{' '}
                <button
                  className="link-btn"
                  onClick={() => navigator.clipboard?.writeText(order.number).then(() => toast.success(t('Copied')))}
                  aria-label={t('Copy')}
                >
                  <Copy size={14} />
                </button>
              </p>
              <p className="muted small">{t('Your order will be shipped as soon as we receive the payment.')}</p>
            </section>
          )}

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
