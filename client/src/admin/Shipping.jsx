import { useState } from 'react';
import { Plus, Truck, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { EmptyState, Field, PageLoader, Spinner, fieldErrors } from '../components/ui.jsx';
import { Modal, MoneyInput, PageHeader, Toggle } from './components.jsx';

function ShippingModal({ method, onClose, onSaved }) {
  const [form, setForm] = useState(method || { name: '', description: '', price: 0, freeOver: null, requiresAddress: true, active: true, sortOrder: 0 });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    const body = { ...form, sortOrder: Number(form.sortOrder) || 0 };
    delete body.id;
    try {
      if (method) await api.put(`/admin/shipping/${method.id}`, body);
      else await api.post('/admin/shipping', body);
      toast.success(t('Saved'));
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
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
          <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>
            {busy && <Spinner />} {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Name')} value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder={t('Courier, ACS, ELTA…')} autoFocus />
      <Field label={t('Description (optional)')} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('e.g. Delivery in 1-3 business days')} />
      <div className="grid-2">
        <div className="field">
          <label>{t('Cost')}</label>
          <MoneyInput value={form.price} onChange={(v) => set('price', v)} />
        </div>
        <div className="field">
          <label>{t('Free for orders over (optional)')}</label>
          <MoneyInput value={form.freeOver} onChange={(v) => set('freeOver', v)} allowEmpty />
        </div>
      </div>
      <Field label={t('Sort order')} type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
      <Toggle checked={form.requiresAddress} onChange={(v) => set('requiresAddress', v)} label={t('Requires a delivery address')} hint={t('Turn off for store pickup')} />
      <Toggle checked={form.active} onChange={(v) => set('active', v)} label={t('Active')} />
    </Modal>
  );
}

export default function Shipping() {
  const { data, reload } = useFetch('/admin/shipping');
  const [editing, setEditing] = useState(null);
  return (
    <>
      <PageHeader
        title={t('Shipping')}
        subtitle={t('Delivery options customers choose at checkout.')}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> {t('Add method')}
          </button>
        }
      />
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
