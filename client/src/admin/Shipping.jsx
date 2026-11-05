import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Truck, Store, Trash2, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { COUNTRY_CODES, countryName, sortedCountries } from '../lib/countries.js';
import { Field, FieldWrap, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { errorMessage, useValidation } from '../lib/validation.js';
import { MoneyInput, PageHeader, SaveBar, SaveButton, Toggle } from './components.jsx';
import { Payments, SETTINGS_RULES, SettingsForm } from './Settings.jsx';

/** One shipping method (courier or store pickup); the page saves both together. */
function MethodCard({ form, onChange, errors }) {
  const { settings } = useShop();
  const courier = form.kind === 'courier';
  const set = (k, value) => onChange({ ...form, [k]: value });
  const setRate = (i, patch) => set('rates', form.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused = sortedCountries(COUNTRY_CODES.filter((c) => !form.rates.some((r) => r.country === c)));
  const defaultName = courier ? t('Courier') : t('Store pickup');

  return (
    <section className={`card ${form.active ? '' : 'dim-card'}`}>
      <h3 className="row-gap">
        {courier ? <Truck size={20} /> : <Store size={20} />} {defaultName}
      </h3>
      <Toggle
        checked={form.active}
        onChange={(on) => set('active', on)}
        label={t('Offered at checkout')}
        hint={courier ? t('Delivery to the customer’s address.') : t('The customer collects the order from the shop ({country}).', { country: countryName(settings.contact.country) })}
      />
      <div className="grid-2 mt">
        <Field
          label={t('Name shown to customers (optional)')}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={defaultName}
          hint={t('Empty: customers see “{name}”.', { name: defaultName })}
          maxLength={100}
        />
        <Field label={t('Description (optional)')} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} />
      </div>

      {courier && (
        <FieldWrap label={t('Countries and cost')} hint={t('Customers can only choose these countries. Leave “free over” empty for no free shipping.')} error={errors.rates}>
          <div className="rates">
            <div className="rates-head muted small">
              <span>{t('Country')}</span>
              <span>{t('Cost')}</span>
              <span>{t('Free over')}</span>
              <span />
            </div>
            {form.rates.map((r, i) => (
              <div key={r.country} className="rates-row">
                <strong>{countryName(r.country)}</strong>
                <MoneyInput value={r.price} onChange={(cents) => setRate(i, { price: cents })} aria-label={t('Cost')} />
                <MoneyInput value={r.freeOver} onChange={(cents) => setRate(i, { freeOver: cents })} allowEmpty aria-label={t('Free over')} />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => set('rates', form.rates.filter((_, j) => j !== i))}
                  disabled={form.rates.length === 1}
                  aria-label={t('Remove {country}', { country: countryName(r.country) })}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {unused.length > 0 && (
              <label className="rates-add">
                <Plus size={16} />
                <select
                  className="input"
                  value=""
                  onChange={(e) => e.target.value && set('rates', [...form.rates, { country: e.target.value, price: form.rates[0]?.price ?? 0, freeOver: null }])}
                  aria-label={t('Add country')}
                >
                  <option value="">{t('Add country…')}</option>
                  {unused.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </FieldWrap>
      )}

      <div className="pay-block mt">
        <Toggle
          checked={form.cod}
          onChange={(on) => set('cod', on)}
          label={courier ? t('Cash on delivery') : t('Pay at the store')}
          hint={courier ? t('The customer pays the courier in cash.') : t('The customer pays when collecting the order.')}
        />
        {courier && form.cod && (
          <FieldWrap label={t('Extra fee')} className="indent">
            <MoneyInput value={form.codFee} onChange={(cents) => set('codFee', cents)} />
          </FieldWrap>
        )}
      </div>
    </section>
  );
}

function ShippingMethods() {
  const { data, setData } = useFetch('/admin/shipping');
  const [forms, setForms] = useState(null);
  const [busy, setBusy] = useState(false);
  const v = useValidation();
  const toast = useToast();
  useEffect(() => setForms(data), [data]);
  const dirty = !!forms && JSON.stringify(forms) !== JSON.stringify(data);

  const save = async () => {
    const courier = forms.find((m) => m.kind === 'courier');
    if (courier && !courier.rates.length) return v.show({ rates: t('Add at least one country') });
    setBusy(true);
    try {
      const methods = forms.map(({ id, kind, name, description, active, cod, codFee, rates }) => ({
        id, name, description, active, cod, codFee, rates: kind === 'courier' ? rates : undefined,
      }));
      setData(await api.put('/admin/shipping', { methods }));
      v.reset();
      toast.success(t('Saved'));
    } catch (err) {
      // "Keep one method on" / "keep a way to pay" are about the page, not one field.
      const code = err.details?.active || err.details?.cod;
      if (code) v.show({ _: errorMessage(code) });
      else v.fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('Shipping & payments')}
        subtitle={t('Courier or store pickup, at least one on.')}
        actions={<SaveButton dirty={dirty} saving={busy} onSave={save} />}
      />
      <ShippingTabs />
      {!forms ? (
        <PageLoader />
      ) : (
        <div className="stack">
          {forms.map((m) => (
            <MethodCard
              key={m.id}
              form={m}
              errors={v.errors}
              onChange={(next) => {
                v.reset();
                setForms((list) => list.map((x) => (x.id === m.id ? next : x)));
              }}
            />
          ))}
          <FormAlert message={v.errors._} />
        </div>
      )}
      <SaveBar
        dirty={dirty}
        saving={busy}
        onSave={save}
        onDiscard={() => {
          v.reset();
          setForms(data);
        }}
      />
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

/** Admin → Shipping & payments: the two delivery methods, payment methods and checkout options. */
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
