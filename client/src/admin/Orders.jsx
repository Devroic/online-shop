import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Printer, ShoppingCart, Mail, Phone, X } from 'lucide-react';
import { api, qs } from '../lib/api.js';
import { pairAllowed, paymentOptions, statusOptions } from './orderRules.js';
import { countryName } from '../lib/countries.js';
import { useFetch } from '../lib/useFetch.js';
import { money, dateTime } from '../lib/format.js';
import { t, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, paymentName, statusName } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { Checkbox, EmptyState, Field, FormAlert, PageLoader, Pagination, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { OrderItems, OrderTotals } from '../pages/OrderPage.jsx';
import { Modal, PageHeader, SearchInput, useConfirm, useUnsavedGuard } from './components.jsx';

const STATUS_TABS = ['', 'pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'];

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
        {STATUS_TABS.map((s) => {
          const counts = data?.statusCounts;
          const n = counts && (s ? counts[s] || 0 : Object.values(counts).reduce((a, b) => a + b, 0));
          return (
            <button key={s} className={status === s ? 'active' : ''} onClick={() => update({ status: s })}>
              {s ? t(ORDER_STATUS[s]) : t('All')}
              {counts && <span className="tab-count">{n}</span>}
            </button>
          );
        })}
      </nav>
      <div className="a-filters">
        <SearchInput value={q} onChange={(v) => update({ q: v })} placeholder={t('Order number, name, email or phone…')} />
        <label className="date-filter">
          <span>{t('From')}</span>
          <input className="input" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} />
        </label>
        <label className="date-filter">
          <span>{t('To')}</span>
          <input className="input" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </label>
      </div>
      {filters.customer && (
        <p className="filter-chip">
          {t('Orders of customer: {name}', { name: data?.items[0]?.customerName || '…' })}
          <button type="button" className="icon-btn" onClick={() => update({ customer: '' })} aria-label={t('Show all orders')}>
            <X size={14} />
          </button>
        </p>
      )}
      {!data ? (
        <PageLoader />
      ) : !data.items.length ? (
        <EmptyState icon={ShoppingCart} title={t('No orders found')} />
      ) : (
        <div className={`card table-card ${loading ? 'is-loading' : ''}`}>
          <div className="table-wrap">
            <table className="table clickable orders-table">
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
                      <div className="small">{paymentName(o.paymentMethod, o)}</div>
                      <span className={`status status-${o.paymentStatus}`}>{t(PAYMENT_STATUS[o.paymentStatus])}</span>
                    </td>
                    <td>
                      <span className={`status status-${o.status}`}>{statusName(o.status, o)}</span>
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

const EVENT_LABEL = { created: 'Order placed', status: 'Status changed', payment: 'Payment', tracking: 'Parcel tracking' };
const EDITABLE = ['status', 'paymentStatus', 'trackingNumber', 'trackingUrl', 'adminNotes'];

export function OrderDetail({ onChange }) {
  const confirm = useConfirm();
  const { id } = useParams();
  const { data: order, setData } = useFetch(`/admin/orders/${id}`, { keepPrevious: false });
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState(null); // the "mark as shipped" window: { trackingNumber, trackingUrl }
  const v = useValidation();
  useUnsavedGuard(!!order && !!form && EDITABLE.some((k) => form[k] !== (order[k] ?? '')));
  const set = (k) => (e) => {
    v.clear(k);
    setForm(withCodPaid({ ...form, [k]: e.target.value }));
  };
  // Cash on delivery / at the store: once delivered, the money was collected, so it shows as paid
  // (still changeable before saving).
  const withCodPaid = (f) =>
    order.paymentMethod === 'cod' && f.status === 'delivered' && order.status !== 'delivered' && f.paymentStatus === 'pending' ? { ...f, paymentStatus: 'paid' } : f;

  useEffect(() => {
    if (order) setForm(Object.fromEntries(EDITABLE.map((k) => [k, order[k] ?? ''])));
  }, [order]);

  if (!order || !form) return <PageLoader />;
  const dirty = EDITABLE.some((k) => form[k] !== (order[k] ?? ''));
  const added = (k) => form[k] && form[k] !== order[k];
  const customerWillBeNotified =
    form.status !== order.status ||
    (form.paymentStatus === 'refunded' && order.paymentStatus !== 'refunded') ||
    added('trackingNumber') ||
    added('trackingUrl');

  const save = async (patch = form) => {
    const ok = v.validate(patch, {
      trackingNumber: [rules.maxLength(200)],
      trackingUrl: [rules.url(), rules.maxLength(1000)],
      adminNotes: [rules.maxLength(5000)],
    });
    if (!ok) return;
    if (
      patch.status === 'cancelled' &&
      order.status !== 'cancelled' &&
      !(await confirm({ title: t('Cancel this order?'), message: t('Stock will be returned to inventory.'), confirmLabel: t('Cancel order'), cancelLabel: t('Keep order'), danger: true }))
    )
      return;
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

  // "Mark as shipped" for a courier order asks for the tracking number first, so the
  // customer's email can include it (both fields stay optional).
  const startQuick = (status) => {
    if (status === 'shipped' && order.address && !order.trackingNumber && !order.trackingUrl) {
      setShipping({ trackingNumber: form.trackingNumber, trackingUrl: form.trackingUrl });
      return;
    }
    save(withCodPaid({ ...form, status }));
  };
  const confirmShipped = async () => {
    const ok = v.validate(shipping, { trackingNumber: [rules.maxLength(200)], trackingUrl: [rules.url(), rules.maxLength(1000)] });
    if (!ok) return;
    setShipping(null);
    await save({ ...form, ...shipping, status: 'shipped' });
  };

  const a = order.address;
  const next ={ pending: 'processing', processing: 'shipped', shipped: 'delivered' }[order.status];
  // No quick "next step" that does not fit the payment, e.g. preparing an unpaid card order.
  const quick = next && pairAllowed(order.paymentMethod, next, order.paymentStatus) ? next : null;
  const statusChoices = statusOptions(order.paymentMethod, Object.keys(ORDER_STATUS), form.paymentStatus, order.status);
  const paymentChoices = paymentOptions(order.paymentMethod, Object.keys(PAYMENT_STATUS), form.status, order.paymentStatus);

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
              <button className="btn btn-primary no-print" disabled={saving} onClick={() => startQuick(quick)}>
                {t('Mark as {status}', { status: statusName(quick, order).toLowerCase() })}
              </button>
            )}
          </>
        }
      />
      <div className="row-gap order-badges">
        <span className={`status status-${order.status}`}>{statusName(order.status, order)}</span>
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
                {t('All orders of this customer')}
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
                  {a.country && (
                    <>
                      <br />
                      {countryName(a.country)}
                    </>
                  )}
                </>
              )}
            </p>
            <h3 className="mt">{t('Payment')}</h3>
            <p>{paymentName(order.paymentMethod, order)}</p>
          </section>

          <section className="card no-print">
            <h3>{t('Manage order')}</h3>
            <Field as="select" label={t('Order status')} value={form.status} onChange={set('status')} error={v.errors.status}>
              {statusChoices.map((s) => (
                <option key={s} value={s}>
                  {statusName(s, order)}
                </option>
              ))}
            </Field>
            <Field as="select" label={t('Payment status')} value={form.paymentStatus} onChange={set('paymentStatus')} error={v.errors.paymentStatus}>
              {paymentChoices.map((s) => (
                <option key={s} value={s}>
                  {t(PAYMENT_STATUS[s])}
                </option>
              ))}
            </Field>
            <Field label={t('Tracking number')} value={form.trackingNumber} onChange={set('trackingNumber')} error={v.errors.trackingNumber} />
            <Field
              label={t('Tracking link (optional)')}
              type="url"
              inputMode="url"
              placeholder="https://"
              hint={t("The courier's page where the customer can follow the parcel.")}
              value={form.trackingUrl}
              onChange={set('trackingUrl')}
              error={v.errors.trackingUrl}
            />
            <Field as="textarea" rows={3} label={t('Internal notes')} hint={t('Only visible to admins')} value={form.adminNotes} onChange={set('adminNotes')} error={v.errors.adminNotes} />
            {customerWillBeNotified && <Checkbox label={t('Email the customer about this change')} checked={notify} onChange={(e) => setNotify(e.target.checked)} />}
            <FormAlert message={v.errors._} />
            <button className="btn btn-primary btn-block mt" disabled={!dirty || saving} onClick={() => save()}>
              {saving && <Spinner />} {t('Save changes')}
            </button>
          </section>
        </div>
      </div>
      {shipping && (
        <Modal
          title={t('Mark as {status}', { status: statusName('shipped', order).toLowerCase() })}
          onClose={() => setShipping(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShipping(null)}>
                {t('Cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmShipped} disabled={saving}>
                {saving && <Spinner />} {shipping.trackingNumber || shipping.trackingUrl ? t('Mark as {status}', { status: statusName('shipped', order).toLowerCase() }) : t('Ship without tracking')}
              </button>
            </>
          }
        >
          <p className="muted">{t('Add the tracking number so the customer can follow the parcel. It goes in the email about the shipment.')}</p>
          <Field
            label={t('Tracking number')}
            value={shipping.trackingNumber}
            autoFocus
            onChange={(e) => {
              v.clear('trackingNumber');
              setShipping({ ...shipping, trackingNumber: e.target.value });
            }}
            error={v.errors.trackingNumber}
          />
          <Field
            label={t('Tracking link (optional)')}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={shipping.trackingUrl}
            onChange={(e) => {
              v.clear('trackingUrl');
              setShipping({ ...shipping, trackingUrl: e.target.value });
            }}
            error={v.errors.trackingUrl}
          />
          {notify && <p className="muted small">{t('The customer gets an email about the shipment.')}</p>}
        </Modal>
      )}
    </div>
  );
}

/** Event messages look like "pending → processing (stripe)"; translate the status words. */
function translateEvent(type, msg) {
  const all = type === 'payment' ? PAYMENT_STATUS : ORDER_STATUS;
  return msg.replace(/\b(pending|processing|shipped|delivered|cancelled|returned|paid|failed|refunded)\b/g, (w) => (all[w] ? t(all[w]) : w));
}
