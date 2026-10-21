import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Printer, ShoppingCart, Mail, Phone } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { money, dateTime } from '../lib/format.js';
import { t, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { Checkbox, EmptyState, Field, FormAlert, PageLoader, Pagination, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { OrderItems, OrderTotals } from '../pages/OrderPage.jsx';
import { PageHeader, SearchInput } from './components.jsx';

const STATUS_TABS = ['', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export function OrderList() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const q = params.get('q') || '';
  const page = Number(params.get('page') || 1);
  const filters = { status, q, from: params.get('from') || '', to: params.get('to') || '', customer: params.get('customer') || '' };
  const { data, loading } = useFetch(`/admin/orders${qs({ ...filters, page })}`);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };

  return (
    <>
      <PageHeader
        title={t('Orders')}
        subtitle={data && t('{n} orders', { n: data.total })}
        actions={
          <a className="btn btn-outline" href={`/api/admin/orders.csv${qs(filters)}`}>
            <Download size={16} /> {t('Export CSV')}
          </a>
        }
      />
      <nav className="tabs">
        {STATUS_TABS.map((s) => (
          <button key={s} className={status === s ? 'active' : ''} onClick={() => update({ status: s })}>
            {s ? t(ORDER_STATUS[s]) : t('All')}
          </button>
        ))}
      </nav>
      <div className="a-filters">
        <SearchInput value={q} onChange={(v) => update({ q: v })} placeholder={t('Order number, name, email or phone…')} />
        <input className="input" type="date" value={filters.from} onChange={(e) => update({ from: e.target.value })} aria-label={t('From')} />
        <input className="input" type="date" value={filters.to} onChange={(e) => update({ to: e.target.value })} aria-label={t('To')} />
      </div>
      {!data ? (
        <PageLoader />
      ) : !data.items.length ? (
        <EmptyState icon={ShoppingCart} title={t('No orders found')} />
      ) : (
        <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
          <div className="table-wrap">
            <table className="table clickable">
              <thead>
                <tr>
                  <th>{t('Order')}</th>
                  <th>{t('Customer')}</th>
                  <th>{t('Payment')}</th>
                  <th>{t('Status')}</th>
                  <th className="num">{t('Total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/admin/orders/${o.id}`} className="strong-link row-link">
                        #{o.number}
                      </Link>
                      <div className="muted small">{dateTime(o.createdAt)}</div>
                    </td>
                    <td>
                      {o.customerName}
                      <div className="muted small">{o.email}</div>
                    </td>
                    <td>
                      <div className="small">{t(PAYMENT_METHOD[o.paymentMethod])}</div>
                      <span className={`status status-${o.paymentStatus}`}>{t(PAYMENT_STATUS[o.paymentStatus])}</span>
                    </td>
                    <td>
                      <span className={`status status-${o.status}`}>{t(ORDER_STATUS[o.status])}</span>
                    </td>
                    <td className="num">
                      <strong>{money(o.total)}</strong>
                      <div className="muted small">{t('{n} items', { n: o.itemCount })}</div>
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

const EVENT_LABEL = { created: 'Order placed', status: 'Status changed', payment: 'Payment', tracking: 'Tracking number' };

export function OrderDetail({ onChange }) {
  const { id } = useParams();
  const { data: order, setData } = useFetch(`/admin/orders/${id}`, { keepPrevious: false });
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const v = useValidation();
  const set = (k) => (e) => {
    v.clear(k);
    setForm({ ...form, [k]: e.target.value });
  };

  useEffect(() => {
    if (order) setForm({ status: order.status, paymentStatus: order.paymentStatus, trackingNumber: order.trackingNumber, adminNotes: order.adminNotes });
  }, [order]);

  if (!order || !form) return <PageLoader />;
  const dirty =
    form.status !== order.status || form.paymentStatus !== order.paymentStatus || form.trackingNumber !== order.trackingNumber || form.adminNotes !== order.adminNotes;
  const customerWillBeNotified = form.status !== order.status || (form.trackingNumber && form.trackingNumber !== order.trackingNumber);

  const save = async (patch = form) => {
    if (!v.validate(patch, { trackingNumber: [rules.maxLength(200)], adminNotes: [rules.maxLength(5000)] })) return;
    if (patch.status === 'cancelled' && order.status !== 'cancelled' && !window.confirm(t('Cancel this order? Stock will be returned to inventory.'))) return;
    setSaving(true);
    try {
      const updated = await api.put(`/admin/orders/${id}`, { ...patch, notifyCustomer: notify });
      setData(updated);
      onChange?.();
      v.reset();
      toast.success(t('Order updated'));
    } catch (err) {
      v.fail(err);
    } finally {
      setSaving(false);
    }
  };

  const a = order.address;
  const quick = { pending: 'processing', processing: 'shipped', shipped: 'delivered' }[order.status];

  return (
    <div className="order-detail">
      <Link to="/admin/orders" className="back-link no-print">
        <ArrowLeft size={16} /> {t('Orders')}
      </Link>
      <PageHeader
        title={`#${order.number}`}
        subtitle={dateTime(order.createdAt)}
        actions={
          <>
            <button className="btn btn-ghost no-print" onClick={() => window.print()}>
              <Printer size={16} /> {t('Print')}
            </button>
            {quick && (
              <button className="btn btn-primary no-print" disabled={saving} onClick={() => save({ ...form, status: quick })}>
                {t('Mark as {status}', { status: t(ORDER_STATUS[quick]).toLowerCase() })}
              </button>
            )}
          </>
        }
      />
      <div className="row-gap order-badges">
        <span className={`status status-${order.status}`}>{t(ORDER_STATUS[order.status])}</span>
        <span className={`status status-${order.paymentStatus}`}>{t(PAYMENT_STATUS[order.paymentStatus])}</span>
      </div>

      <div className="a-edit">
        <div className="stack">
          <section className="card">
            <h3>{t('Items')}</h3>
            <OrderItems items={order.items} />
            <OrderTotals order={order} />
          </section>
          {order.notes && (
            <section className="card note-card">
              <h3>{t('Customer note')}</h3>
              <p>{order.notes}</p>
            </section>
          )}
          <section className="card no-print">
            <h3>{t('History')}</h3>
            <ul className="events">
              {order.events.map((e, i) => (
                <li key={i}>
                  <span className="dot" />
                  <div>
                    <strong>{t(EVENT_LABEL[e.type] || e.type)}</strong> {e.message && <span className="muted">· {translateEvent(e.type, e.message)}</span>}
                    <div className="muted small">{dateTime(e.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h3>{t('Customer')}</h3>
            <p>
              <strong>{order.customerName}</strong>
              <br />
              <a href={`mailto:${order.email}`} className="icon-line">
                <Mail size={14} /> {order.email}
              </a>
              {order.phone && (
                <a href={`tel:${order.phone}`} className="icon-line">
                  <Phone size={14} /> {order.phone}
                </a>
              )}
            </p>
            {order.userId && (
              <Link to={`/admin/orders?customer=${order.userId}`} className="link-btn small no-print">
                {t('Registered customer')}
              </Link>
            )}
            <h3 className="mt">{t('Delivery')}</h3>
            <p>
              {order.shippingName}
              {a && (
                <>
                  <br />
                  {a.street}
                  <br />
                  {a.postalCode} {a.city}
                  {a.region && `, ${a.region}`}
                </>
              )}
            </p>
            <h3 className="mt">{t('Payment')}</h3>
            <p>{t(PAYMENT_METHOD[order.paymentMethod])}</p>
          </section>

          <section className="card no-print">
            <h3>{t('Manage order')}</h3>
            <Field as="select" label={t('Order status')} value={form.status} onChange={set('status')} error={v.errors.status}>
              {Object.keys(ORDER_STATUS).map((s) => (
                <option key={s} value={s}>
                  {t(ORDER_STATUS[s])}
                </option>
              ))}
            </Field>
            <Field as="select" label={t('Payment status')} value={form.paymentStatus} onChange={set('paymentStatus')} error={v.errors.paymentStatus}>
              {Object.keys(PAYMENT_STATUS).map((s) => (
                <option key={s} value={s}>
                  {t(PAYMENT_STATUS[s])}
                </option>
              ))}
            </Field>
            <Field label={t('Tracking number')} value={form.trackingNumber} onChange={set('trackingNumber')} error={v.errors.trackingNumber} />
            <Field as="textarea" rows={3} label={t('Internal notes')} hint={t('Only visible to admins')} value={form.adminNotes} onChange={set('adminNotes')} error={v.errors.adminNotes} />
            {customerWillBeNotified && <Checkbox label={t('Email the customer about this change')} checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
            <FormAlert message={v.errors._} />
            <button className="btn btn-primary btn-block mt" disabled={!dirty || saving} onClick={() => save()}>
              {saving && <Spinner />} {t('Save changes')}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Event messages look like "pending → processing (stripe)"; translate the status words. */
function translateEvent(type, msg) {
  const all = type === 'payment' ? PAYMENT_STATUS : ORDER_STATUS;
  return msg.replace(/\b(pending|processing|shipped|delivered|cancelled|paid|failed|refunded)\b/g, (w) => (all[w] ? t(all[w]) : w));
}
