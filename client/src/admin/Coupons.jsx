import { useState } from 'react';
import { Plus, Ticket, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { date, money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, PageLoader, Spinner, fieldErrors } from '../components/ui.jsx';
import { Modal, MoneyInput, PageHeader, Toggle } from './components.jsx';

const describe = (c) =>
  c.type === 'percent' ? `-${c.value}%` : c.type === 'fixed' ? `-${money(c.value)}` : t('Free shipping');

function CouponModal({ coupon, onClose, onSaved }) {
  const [form, setForm] = useState(
    coupon ? { ...coupon, expiresAt: coupon.expiresAt?.slice(0, 10) || '' } : { code: '', type: 'percent', value: 10, minOrder: 0, maxUses: '', expiresAt: '', active: true },
  );
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    const body = {
      code: form.code,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : Number(form.value) || 0,
      minOrder: form.minOrder || 0,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59` : null,
      active: form.active,
    };
    try {
      if (coupon) await api.put(`/admin/coupons/${coupon.id}`, body);
      else await api.post('/admin/coupons', body);
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(t('Delete this code?'))) return;
    await api.del(`/admin/coupons/${coupon.id}`);
    onSaved();
  };

  return (
    <Modal
      title={coupon ? t('Edit discount code') : t('New discount code')}
      onClose={onClose}
      footer={
        <>
          {coupon && (
            <button className="btn btn-ghost danger-text mr-auto" onClick={remove}>
              {t('Delete')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || form.code.trim().length < 2}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Code')} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} error={errors.code} placeholder="SUMMER20" autoFocus />
      <div className="grid-2">
        <Field as="select" label={t('Type')} value={form.type} onChange={(e) => set('type', e.target.value)}>
          <option value="percent">{t('Percentage')}</option>
          <option value="fixed">{t('Fixed amount')}</option>
          <option value="free_shipping">{t('Free shipping')}</option>
        </Field>
        {form.type === 'percent' && (
          <Field label={t('Discount %')} type="number" min="1" max="100" value={form.value} onChange={(e) => set('value', e.target.value)} error={errors.value} />
        )}
        {form.type === 'fixed' && (
          <div className="field">
            <label>{t('Amount')}</label>
            <MoneyInput value={form.value} onChange={(v) => set('value', v)} />
          </div>
        )}
      </div>
      <div className="grid-2">
        <div className="field">
          <label>{t('Minimum order')}</label>
          <MoneyInput value={form.minOrder} onChange={(v) => set('minOrder', v)} />
        </div>
        <Field label={t('Max uses (optional)')} type="number" min="1" value={form.maxUses ?? ''} onChange={(e) => set('maxUses', e.target.value)} />
      </div>
      <Field label={t('Expires on (optional)')} type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
      <Toggle checked={form.active} onChange={(v) => set('active', v)} label={t('Active')} />
    </Modal>
  );
}

export default function Coupons() {
  const { data, reload } = useFetch('/admin/coupons');
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        title={t('Discount codes')}
        subtitle={t('Codes customers can enter at checkout.')}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> {t('Add code')}
          </button>
        }
      />
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon={Ticket} title={t('No discount codes yet')} text={t('Create a code like WELCOME10 to reward new customers.')} />
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Code')}</th>
                  <th>{t('Discount')}</th>
                  <th>{t('Used')}</th>
                  <th>{t('Expires')}</th>
                  <th>{t('Status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map((c) => {
                  const expired = c.expiresAt && new Date(c.expiresAt) < new Date();
                  return (
                    <tr key={c.id} className={c.active && !expired ? '' : 'dim'}>
                      <td>
                        <code className="code">{c.code}</code>
                      </td>
                      <td>
                        {describe(c)}
                        {c.minOrder > 0 && <div className="muted small">{t('Min. {amount}', { amount: money(c.minOrder) })}</div>}
                      </td>
                      <td>
                        {c.usedCount}
                        {c.maxUses ? ` / ${c.maxUses}` : ''}
                      </td>
                      <td>{c.expiresAt ? date(c.expiresAt) : '—'}</td>
                      <td>
                        {expired ? (
                          <span className="status status-cancelled">{t('Expired')}</span>
                        ) : c.active ? (
                          <span className="status status-delivered">{t('Active')}</span>
                        ) : (
                          <span className="status">{t('Inactive')}</span>
                        )}
                      </td>
                      <td className="num">
                        <button className="icon-btn" onClick={() => setEditing(c)} aria-label={t('Edit')}>
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && (
        <CouponModal
          coupon={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
