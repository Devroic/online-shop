import { useState } from 'react';
import { Plus, Ticket, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { date, money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, FieldWrap, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { Modal, MoneyInput, PageHeader, Toggle } from './components.jsx';

const describe = (c) =>
  c.type === 'percent' ? `-${c.value}%` : c.type === 'fixed' ? `-${money(c.value)}` : t('Free shipping');

function CouponModal({ coupon, onClose, onSaved }) {
  const [form, setForm] = useState(
    coupon ? { ...coupon, expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString('sv-SE') : '' } : { code: '', type: 'percent', value: 10, minOrder: 0, maxUses: '', expiresAt: '', active: true },
  );
  const v = useValidation();
  const { errors } = v;
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k, value) => {
    v.clear(k);
    setForm((f) => ({ ...f, [k]: value }));
  };

  const save = async () => {
    const ok = v.validate(form, {
      code: [rules.required(), rules.minLength(2), rules.maxLength(50)],
      value:
        form.type === 'percent'
          ? [rules.required(), rules.integer(), rules.min(1), rules.max(100)]
          : form.type === 'fixed'
            ? [rules.positive()]
            : [],
      maxUses: [rules.integer(), rules.min(1)],
    });
    if (!ok) return;
    setBusy(true);
    const body = {
      code: form.code,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : Number(form.value) || 0,
      minOrder: form.minOrder || 0,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      // End of the chosen day in the admin's time zone (the server runs in UTC).
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
      active: form.active,
    };
    try {
      if (coupon) await api.put(`/admin/coupons/${coupon.id}`, body);
      else await api.post('/admin/coupons', body);
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      v.fail(err);
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
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Code')} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} error={errors.code} placeholder="SUMMER20" autoFocus />
      <div className="grid-2">
        <Field
          as="select"
          label={t('Type')}
          value={form.type}
          onChange={(e) => {
            v.clear('value');
            set('type', e.target.value);
          }}
        >
          <option value="percent">{t('Percentage')}</option>
          <option value="fixed">{t('Fixed amount')}</option>
          <option value="free_shipping">{t('Free shipping')}</option>
        </Field>
        {form.type === 'percent' && (
          <Field label={t('Discount %')} inputMode="numeric" value={form.value} onChange={(e) => set('value', e.target.value)} error={errors.value} />
        )}
        {form.type === 'fixed' && (
          <FieldWrap label={t('Amount')} error={errors.value}>
            <MoneyInput value={form.value} onChange={(cents) => set('value', cents)} aria-invalid={!!errors.value} />
          </FieldWrap>
        )}
      </div>
      <div className="grid-2">
        <FieldWrap label={t('Minimum order')} error={errors.minOrder}>
          <MoneyInput value={form.minOrder} onChange={(cents) => set('minOrder', cents)} aria-invalid={!!errors.minOrder} />
        </FieldWrap>
        <Field label={t('Max uses (optional)')} inputMode="numeric" value={form.maxUses ?? ''} onChange={(e) => set('maxUses', e.target.value)} error={errors.maxUses} />
      </div>
      <Field label={t('Expires on (optional)')} type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} error={errors.expiresAt} />
      <Toggle checked={form.active} onChange={(on) => set('active', on)} label={t('Active')} />
      <FormAlert message={errors._} />
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
        subtitle={t('Codes customers can enter at checkout. Codes are not shown in the shop by themselves: if you mention one in the announcement bar, update it in Pages → Home page.')}
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
