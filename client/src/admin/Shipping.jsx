import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Truck, Store, Trash2, Plus, Package, ChevronDown } from 'lucide-react';
import { centsToInput, money } from '../lib/format.js';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { t } from '../lib/i18n.js';
import { useToast } from '../context/ToastContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { COUNTRY_CODES, countryName, sortedCountries } from '../lib/countries.js';
import { Checkbox, Field, FieldWrap, FormAlert, PageLoader, Spinner } from '../components/ui.jsx';
import { errorMessage, useValidation } from '../lib/validation.js';
import { Modal, MoneyInput, PageHeader, SaveBar, SaveButton, Toggle } from './components.jsx';
import { Payments, SETTINGS_RULES, SettingsForm } from './Settings.jsx';

// The 27 EU countries, for "add the EU" in one click.
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

/** Picks several countries at once (search, EU, all); they are added with the default cost. */
function AddCountries({ available, onAdd, onClose }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const shown = available.filter((c) => !q.trim() || norm(countryName(c)).includes(norm(q.trim())) || c.toLowerCase() === q.trim().toLowerCase());
  const toggle = (c) => setPicked((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));
  const pickAll = (codes) => setPicked((list) => [...new Set([...list, ...codes])]);
  const euLeft = available.filter((c) => EU.includes(c));
  return (
    <Modal
      title={t('Add countries')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
            {t('Add {n} countries', { n: picked.length })}
          </button>
        </>
      }
    >
      <p className="muted small">{t('They are added with the default cost and “free over”; you can change any of them afterwards.')}</p>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search country…')} autoFocus />
      <div className="row-gap mt">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => pickAll(shown)}>
          {q.trim() ? t('Tick the ones shown') : t('All countries')}
        </button>
        {euLeft.length > 0 && (
          <button type="button" className="btn btn-outline btn-sm" onClick={() => pickAll(euLeft)}>
            {t('EU countries')}
          </button>
        )}
        {picked.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>
            {t('Clear')}
          </button>
        )}
      </div>
      <div className="country-pick mt">
        {shown.map((c) => (
          <Checkbox key={c} label={countryName(c)} checked={picked.includes(c)} onChange={() => toggle(c)} />
        ))}
        {!shown.length && <p className="muted small">{t('No country found')}</p>}
      </div>
    </Modal>
  );
}

/** Default name of the courier and store pickup; an added method has its own name. */
const defaultNameOf = (kind) => (kind === 'courier' ? t('Courier') : kind === 'pickup' ? t('Store pickup') : '');

/**
 * One shipping method. The courier and the methods the shop adds deliver to the
 * countries listed, each with its cost; store pickup is the shop's country only.
 * The header opens and closes the card; the page saves all methods together.
 */
function MethodCard({ form, onChange, onRemove, errors, open, onToggle }) {
  const { settings } = useShop();
  const pickup = form.kind === 'pickup';
  const added = form.kind === 'delivery';
  const set = (k, value) => onChange({ ...form, [k]: value });
  const setRate = (i, patch) => set('rates', form.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unused = sortedCountries(COUNTRY_CODES.filter((c) => !form.rates.some((r) => r.country === c)));
  const defaultName = defaultNameOf(form.kind);
  const title = form.name.trim() || defaultName || t('New shipping method');
  const [adding, setAdding] = useState(false);
  // An empty cost / "free over" on a country uses these; the box shows them greyed out.
  const defaultPrice = centsToInput(form.defaultPrice ?? 0);
  const defaultFreeOver = centsToInput(form.defaultFreeOver ?? 0);
  const keepFirstOnly = () => set('rates', form.rates.slice(0, 1));
  const Icon = pickup ? Store : added ? Package : Truck;
  // Shown next to the name while the card is closed.
  const summary = [
    !form.active && t('Not offered'),
    pickup ? countryName(settings.contact.country) : t('{n} countries', { n: form.rates.length }),
    !pickup && t('from {amount}', { amount: money(Math.min(...form.rates.map((r) => r.price ?? form.defaultPrice ?? 0), form.rates.length ? Infinity : 0)) }),
    form.cod && (pickup ? t('Pay at the store') : t('Cash on delivery')),
  ].filter(Boolean);

  return (
    <section className={`card ship-card ${form.active ? '' : 'dim-card'}`}>
      <div className="ship-head">
        <button type="button" className="ship-toggle" onClick={onToggle} aria-expanded={open}>
          <Icon size={20} />
          <span className="grow">
            <strong>{title}</strong>
            {!open && <span className="muted small ship-summary">{summary.join(' · ')}</span>}
          </span>
          <ChevronDown size={18} className={`ship-chevron ${open ? 'open' : ''}`} />
        </button>
        {added && (
          <button type="button" className="icon-btn" onClick={onRemove} aria-label={t('Remove {name}', { name: title })} title={t('Delete')}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {open && (
        <div className="ship-body">
          <Toggle
            checked={form.active}
            onChange={(on) => set('active', on)}
            label={t('Offered at checkout')}
            hint={pickup ? t('The customer collects the order from the shop ({country}).', { country: countryName(settings.contact.country) }) : t('Delivery to the customer’s address.')}
          />
          <div className="grid-2 mt">
            {added ? (
              <Field
                label={t('Name shown to customers')}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={t('e.g. BOX NOW lockers')}
                error={errors.name}
                maxLength={100}
              />
            ) : (
              <Field
                label={t('Name shown to customers (optional)')}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={defaultName}
                hint={t('Empty: customers see “{name}”.', { name: defaultName })}
                maxLength={100}
              />
            )}
            <Field label={t('Description (optional)')} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} />
          </div>

          {!pickup && (
            <div className="grid-2 mt">
              <FieldWrap label={t('Default cost')} hint={t('For every country below whose cost is empty.')}>
                <MoneyInput value={form.defaultPrice ?? 0} onChange={(cents) => set('defaultPrice', cents)} />
              </FieldWrap>
              <FieldWrap label={t('Free over (default)')} hint={t('0: no free shipping.')}>
                <MoneyInput value={form.defaultFreeOver ?? 0} onChange={(cents) => set('defaultFreeOver', cents)} />
              </FieldWrap>
            </div>
          )}

          {!pickup && (
            <FieldWrap
              label={t('Countries and cost ({n})', { n: form.rates.length })}
              hint={t('Customers can only choose these countries. An empty box uses the default above; “free over” 0: no free shipping.')}
              error={errors.rates}
            >
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
                    <MoneyInput value={r.price} onChange={(cents) => setRate(i, { price: cents })} allowEmpty placeholder={defaultPrice} aria-label={t('Cost')} />
                    <MoneyInput value={r.freeOver} onChange={(cents) => setRate(i, { freeOver: cents })} allowEmpty placeholder={defaultFreeOver} aria-label={t('Free over')} />
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
                <div className="row-gap rates-actions">
                  {unused.length > 0 && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setAdding(true)}>
                      <Plus size={16} /> {t('Add countries')}
                    </button>
                  )}
                  {form.rates.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={keepFirstOnly}>
                      {t('Keep only {country}', { country: countryName(form.rates[0].country) })}
                    </button>
                  )}
                </div>
              </div>
            </FieldWrap>
          )}
          {adding && (
            <AddCountries
              available={unused}
              onClose={() => setAdding(false)}
              onAdd={(codes) => {
                set('rates', [...form.rates, ...codes.map((country) => ({ country, price: null, freeOver: null }))]);
                setAdding(false);
              }}
            />
          )}

          <div className="pay-block mt">
            <Toggle
              checked={form.cod}
              onChange={(on) => set('cod', on)}
              label={pickup ? t('Pay at the store') : t('Cash on delivery')}
              hint={pickup ? t('The customer pays when collecting the order.') : t('The customer pays the courier in cash.')}
            />
            {!pickup && form.cod && (
              <FieldWrap label={t('Extra fee')} className="indent">
                <MoneyInput value={form.codFee} onChange={(cents) => set('codFee', cents)} />
              </FieldWrap>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Cards are told apart by id; a method not saved yet has a temporary key.
const keyOf = (m) => m.id ?? m.tmp;
let tmpSeq = 0;

function ShippingMethods() {
  const { data, setData } = useFetch('/admin/shipping');
  const { settings, reload: reloadShop } = useShop();
  const [forms, setForms] = useState(null);
  const [removed, setRemoved] = useState([]);
  const [open, setOpen] = useState(null); // keys of the open cards
  const [busy, setBusy] = useState(false);
  const v = useValidation();
  const toast = useToast();
  useEffect(() => {
    setForms(data);
    setRemoved([]);
    // A few methods start open; with many, all start closed so the page stays short.
    if (data) setOpen((cur) => cur ?? (data.length <= 2 ? data.map(keyOf) : []));
  }, [data]);
  const dirty = !!forms && (removed.length > 0 || JSON.stringify(forms) !== JSON.stringify(data));
  const isOpen = (m) => open?.includes(keyOf(m));
  const toggle = (m) => setOpen((cur) => (cur.includes(keyOf(m)) ? cur.filter((k) => k !== keyOf(m)) : [...cur, keyOf(m)]));
  // Errors of the method at `i` (as sent to the server), by field.
  const errorsOf = (i) => ({ name: v.errors[`methods.${i}.name`], rates: v.errors[`methods.${i}.rates`] });
  // Opens the cards that have an error, so the message is in view.
  const openWithErrors = (errs) => {
    const bad = forms.filter((_, i) => Object.keys(errs).some((k) => k.startsWith(`methods.${i}.`))).map(keyOf);
    if (bad.length) setOpen((cur) => [...new Set([...cur, ...bad])]);
  };

  const addMethod = () => {
    const tmp = `new-${++tmpSeq}`;
    const country = settings.contact.country || 'CY';
    const blank = { tmp, kind: 'delivery', name: '', description: '', active: true, cod: false, codFee: 0, defaultPrice: 0, defaultFreeOver: 0, rates: [{ country, price: null, freeOver: null }] };
    // New methods go after the courier and the other added ones, before store pickup.
    setForms((list) => {
      const at = list.findIndex((m) => m.kind === 'pickup');
      return at < 0 ? [...list, blank] : [...list.slice(0, at), blank, ...list.slice(at)];
    });
    setOpen((cur) => [...cur, tmp]);
  };
  const removeMethod = (m) => {
    v.reset();
    setForms((list) => list.filter((x) => keyOf(x) !== keyOf(m)));
    if (m.id) setRemoved((ids) => [...ids, m.id]);
  };

  const save = async () => {
    const local = {};
    forms.forEach((m, i) => {
      if (m.kind === 'delivery' && !m.name.trim()) local[`methods.${i}.name`] = errorMessage('required');
      if (m.kind !== 'pickup' && !m.rates.length) local[`methods.${i}.rates`] = t('Add at least one country');
    });
    if (Object.keys(local).length) {
      openWithErrors(local);
      return v.show(local);
    }
    setBusy(true);
    try {
      const methods = forms.map(({ id, kind, name, description, active, cod, codFee, rates, defaultPrice, defaultFreeOver }) => ({
        ...(id ? { id } : {}),
        name, description, active, cod, codFee,
        ...(kind !== 'pickup' ? { rates, defaultPrice, defaultFreeOver } : {}),
      }));
      const saved = await api.put('/admin/shipping', { methods, removed });
      // Saved new methods get their id: keep their cards open under it.
      const fresh = saved.filter((m) => !data.some((d) => d.id === m.id)).map((m) => m.id);
      setOpen((cur) => [...cur.filter((k) => typeof k === 'number'), ...fresh]);
      setData(saved);
      reloadShop();
      v.reset();
      toast.success(t('Saved'));
    } catch (err) {
      // "Keep one method on" / "keep a way to pay" are about the page, not one field.
      const code = err.details?.active || err.details?.cod;
      if (code) v.show({ _: errorMessage(code) });
      else {
        openWithErrors(err.details || {});
        v.fail(err);
      }
    } finally {
      setBusy(false);
    }
  };

  const allOpen = !!forms && forms.every(isOpen);
  return (
    <>
      <PageHeader
        title={t('Shipping & payments')}
        subtitle={t('Courier, store pickup and your own methods; at least one on.')}
        actions={<SaveButton dirty={dirty} saving={busy} onSave={save} />}
      />
      <ShippingTabs />
      {!forms ? (
        <PageLoader />
      ) : (
        <div className="stack">
          <div className="row-gap ship-tools">
            <button type="button" className="btn btn-outline btn-sm" onClick={addMethod}>
              <Plus size={16} /> {t('Add shipping method')}
            </button>
            {forms.length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(allOpen ? [] : forms.map(keyOf))}>
                {allOpen ? t('Collapse all') : t('Expand all')}
              </button>
            )}
          </div>
          {forms.map((m, i) => (
            <MethodCard
              key={keyOf(m)}
              form={m}
              errors={errorsOf(i)}
              open={isOpen(m)}
              onToggle={() => toggle(m)}
              onRemove={() => removeMethod(m)}
              onChange={(next) => {
                v.reset();
                setForms((list) => list.map((x) => (keyOf(x) === keyOf(m) ? next : x)));
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
          setRemoved([]);
          setOpen((cur) => cur.filter((k) => typeof k === 'number'));
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

/** Admin → Shipping & payments: the delivery methods, payment methods and checkout options. */
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
