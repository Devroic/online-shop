import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Plus, Truck, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, FieldWrap, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { Modal, MoneyInput, PageHeader, Toggle } from './components.jsx';
import { Payments, SETTINGS_RULES, SettingsForm } from './Settings.jsx';

function ShippingModal({ method, onClose, onSaved }) {
  const [form, setForm] = useState(method || { name: '', description: '', price: 0, freeOver: null, requiresAddress: true, active: true, sortOrder: 0 });
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
      name: [rules.required(), rules.maxLength(100)],
      description: [rules.maxLength(500)],
      sortOrder: [rules.integer()],
    });
    if (!ok) return;
    setBusy(true);
    const body = { ...form, sortOrder: Number(form.sortOrder) || 0 };
    delete body.id;
    try {
      if (method) await api.put(`/admin/shipping/${method.id}`, body);
      else await api.post('/admin/shipping', body);
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      v.fail(err);
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(t('Delete this shipping method?'))) return;
    await api.del(`/admin/shipping/${method.id}`);
    onSaved();
  };

  return (
    <Modal
      title={method ? t('Edit shipping method') : t('New shipping method')}
      onClose={onClose}
      footer={
        <>
          {method && (
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
      <Field label={t('Name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder={t('Courier, ACS, ELTA…')} autoFocus />
      <Field label={t('Description (optional)')} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('e.g. Delivery in 1-3 business days')} error={errors.description} />
      <div className="grid-2">
        <FieldWrap label={t('Cost')} error={errors.price}>
          <MoneyInput value={form.price} onChange={(cents) => set('price', cents)} aria-invalid={!!errors.price} />
        </FieldWrap>
        <FieldWrap label={t('Free for orders over (optional)')} error={errors.freeOver}>
          <MoneyInput value={form.freeOver} onChange={(cents) => set('freeOver', cents)} allowEmpty aria-invalid={!!errors.freeOver} />
        </FieldWrap>
      </div>
      <Field label={t('Sort order')} inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} error={errors.sortOrder} />
      <Toggle checked={form.requiresAddress} onChange={(on) => set('requiresAddress', on)} label={t('Requires a delivery address')} hint={t('Turn off for store pickup')} />
      <Toggle checked={form.active} onChange={(on) => set('active', on)} label={t('Active')} />
      <FormAlert message={errors._} />
    </Modal>
  );
}

function ShippingMethods() {
  const { data, reload } = useFetch('/admin/shipping');
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        title={t('Shipping & payments')}
        subtitle={t('Delivery options customers choose at checkout.')}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> {t('Add method')}
          </button>
        }
      />
      <ShippingTabs />
      {!data ? (
        <PageLoader />
      ) : !data.length ? (
        <EmptyState icon={Truck} title={t('No shipping methods')} text={t('Customers cannot check out until you add at least one.')} />
      ) : (
        <div className="card-list">
          {data.map((m) => (
            <div key={m.id} className={`card list-card ${m.active ? '' : 'dim'}`}>
              <Truck size={20} className="muted" />
              <div className="grow">
                <strong>{m.name}</strong>
                <div className="muted small">
                  {m.description}
                  {m.freeOver != null && ` · ${t('Free over {amount}', { amount: money(m.freeOver) })}`}
                  {!m.requiresAddress && ` · ${t('No address needed')}`}
                </div>
              </div>
              <strong>{m.price ? money(m.price) : t('Free')}</strong>
              {!m.active && <span className="status">{t('Inactive')}</span>}
              <button className="icon-btn" onClick={() => setEditing(m)} aria-label={t('Edit')}>
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <ShippingModal
          method={editing.id ? editing : null}
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

function ShippingTabs() {
  return (
    <nav className="tabs">
      <NavLink to="/admin/shipping" end>
        {t('Shipping')}
      </NavLink>
      <NavLink to="/admin/shipping/payments">{t('Payments')}</NavLink>
    </nav>
  );
}

/** Admin → Shipping & payments: delivery methods, payment methods and checkout options. */
export default function Shipping() {
  return (
    <Routes>
      <Route index element={<ShippingMethods />} />
      <Route
        path="payments"
        element={
          <SettingsForm
            title={t('Shipping & payments')}
            subtitle={t('How customers pay, and the options at checkout.')}
            tabs={<ShippingTabs />}
            schema={SETTINGS_RULES.payments}
            render={(props) => <Payments {...props} />}
          />
        }
      />
      <Route path="*" element={<Navigate to="/admin/shipping" replace />} />
    </Routes>
  );
}
