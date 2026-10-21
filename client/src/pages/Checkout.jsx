import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Banknote, Lock, Tag, X, ChevronDown, ShoppingBag, Info } from 'lucide-react';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from '../context/ShopContext.jsx';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { t, PAYMENT_METHOD } from '../lib/i18n.js';
import { Checkbox, EmptyState, Field, FormAlert, Spinner, useTitle } from '../components/ui.jsx';
import { rules, useValidation } from '../lib/validation.js';
import { problemText, useQuote } from '../components/useQuote.js';

const PAYMENT_ICONS = { card: CreditCard, cod: Banknote };
const COUPON_ERRORS = {
  coupon_invalid: 'This code is not valid',
  coupon_expired: 'This code has expired',
  coupon_used_up: 'This code is no longer available',
  coupon_min_order: 'Your order total is too low for this code',
};

function Summary({ items, quote, loading, coupon, setCoupon, problemFor }) {
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const total = quote?.total ?? 0;
  const apply = () => code.trim() && setCoupon(code.trim().toUpperCase());

  return (
    <aside className="card summary sticky checkout-summary">
      <button type="button" className="summary-toggle only-mobile" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ShoppingBag size={18} />
        <span>{open ? t('Hide order summary') : t('Show order summary')}</span>
        <ChevronDown size={18} className={open ? 'rot' : ''} />
        <strong>{money(total)}</strong>
      </button>
      <div className={`summary-body ${open ? 'open' : ''}`}>
        <div className="summary-items">
          {items.map((l) => {
            const p = problemFor(l.key);
            return (
              <div key={l.key} className="summary-item">
                <div className="summary-thumb">
                  {l.image ? <img src={l.image} alt="" /> : <div className="img-placeholder" />}
                  <span className="qty-badge">{l.quantity}</span>
                </div>
                <div className="grow">
                  <div className="summary-name">{l.name}</div>
                  {l.variantName && <div className="muted small">{l.variantName}</div>}
                  {p && <div className="line-problem">{problemText(p, t)}</div>}
                </div>
                <div>{money(l.price * l.quantity)}</div>
              </div>
            );
          })}
        </div>

        {coupon ? (
          <div className="coupon-applied">
            <Tag size={16} />
            <span>{coupon}</span>
            <button type="button" className="icon-btn" onClick={() => setCoupon('')} aria-label={t('Remove code')}>
              <X size={16} />
            </button>
          </div>
        ) : (
          // Not a <form>: this sits inside the checkout form.
          <div className="coupon-form">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  apply();
                }
              }}
              placeholder={t('Discount code')}
              aria-label={t('Discount code')}
              aria-invalid={!!quote?.couponError}
            />
            <button type="button" className="btn btn-outline" onClick={apply}>
              {t('Apply')}
            </button>
          </div>
        )}
        {quote?.couponError && <p className="field-error">{t(COUPON_ERRORS[quote.couponError])}</p>}

        <div className={`summary-rows ${loading ? 'is-loading' : ''}`}>
          <div className="summary-row">
            <span>{t('Subtotal')}</span>
            <span>{money(quote?.subtotal ?? 0)}</span>
          </div>
          {quote?.discount > 0 && (
            <div className="summary-row discount">
              <span>{t('Discount')}</span>
              <span>-{money(quote.discount)}</span>
            </div>
          )}
          <div className="summary-row">
            <span>{t('Shipping')}</span>
            <span>{quote?.shipping ? (quote.shippingCost ? money(quote.shippingCost) : t('Free')) : '—'}</span>
          </div>
          {quote?.paymentFee > 0 && (
            <div className="summary-row">
              <span>{t('Cash on delivery fee')}</span>
              <span>{money(quote.paymentFee)}</span>
            </div>
          )}
          <div className="summary-row total">
            <span>{t('Total')}</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function Checkout() {
  const { items, payload, clear } = useCart();
  const { user } = useAuth();
  const { settings, pages } = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useTitle(t('Checkout'));

  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    street: '',
    city: '',
    postalCode: '',
    region: '',
    notes: '',
  });
  const [coupon, setCoupon] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(settings.paymentMethods[0]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const v = useValidation();
  const { errors } = v;
  const [submitting, setSubmitting] = useState(false);

  const { quote, loading, problemFor } = useQuote({ couponCode: coupon, shippingMethodId, paymentMethod });

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      email: f.email || user.email,
      name: f.name || user.name,
      phone: f.phone || user.phone,
      ...(user.address && !f.street ? user.address : {}),
    }));
  }, [user]);

  useEffect(() => {
    if (quote && !quote.shippingOptions.some((m) => m.id === shippingMethodId)) {
      setShippingMethodId(quote.shippingOptions[0]?.id ?? null);
    }
  }, [quote, shippingMethodId]);

  const shipping = useMemo(() => quote?.shippingOptions.find((m) => m.id === shippingMethodId), [quote, shippingMethodId]);
  const termsPage = pages.find((p) => p.slug === settings.checkout.termsPage);

  if (!items.length) {
    return (
      <div className="container narrow">
        <EmptyState
          icon={ShoppingBag}
          title={t('Your cart is empty')}
          action={
            <Link to="/products" className="btn btn-primary">
              {t('Start shopping')}
            </Link>
          }
        />
      </div>
    );
  }
  if (!settings.paymentMethods.length) {
    return (
      <div className="container narrow">
        <EmptyState
          icon={Info}
          title={t('Orders are temporarily unavailable')}
          text={t('Please try again later or contact us.')}
          action={
            <Link to="/contact" className="btn btn-primary">
              {t('Contact')}
            </Link>
          }
        />
      </div>
    );
  }
  if (!user && !settings.checkout.allowGuest) {
    return (
      <div className="container narrow">
        <EmptyState
          icon={Lock}
          title={t('Please sign in to checkout')}
          action={
            <Link to="/login?next=/checkout" className="btn btn-primary">
              {t('Sign in')}
            </Link>
          }
        />
      </div>
    );
  }

  const set = (k) => (e) => {
    v.clear(k);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const address = shipping?.requiresAddress ? [rules.required()] : [];
    const ok = v.validate(
      { ...form, acceptTerms },
      {
        email: [rules.required(), rules.email()],
        phone: [settings.checkout.requirePhone && rules.required(), rules.maxLength(40)],
        name: [rules.required(), rules.minLength(2), rules.maxLength(100)],
        street: [...address, rules.maxLength(200)],
        city: [...address, rules.maxLength(100)],
        postalCode: [...address, rules.maxLength(20)],
        region: [rules.maxLength(100)],
        notes: [rules.maxLength(1000)],
        acceptTerms: [rules.acceptTerms()],
      },
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await api.post('/orders', {
        items: payload,
        email: form.email.trim(),
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: shipping?.requiresAddress
          ? { street: form.street, city: form.city, postalCode: form.postalCode, region: form.region }
          : null,
        shippingMethodId,
        paymentMethod,
        couponCode: coupon || undefined,
        notes: form.notes,
        saveAddress: !!user && saveAddress,
        acceptTerms: true,
      });
      if (res.redirectUrl) {
        window.location.assign(res.redirectUrl);
        return;
      }
      clear();
      navigate(`/order/${res.order.number}?token=${res.order.accessToken}&new=1`, { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err.status === 409) v.show({ _: t('Some items in your cart changed. Please review your order.') });
      else if (err.status === 502) v.show({ _: t('Card payment is unavailable right now. Please choose another payment method.') });
      else if (err.status === 400) v.fail(err);
      else v.show({ _: t('Something went wrong. Please try again.') });
    }
  };

  const hasProblems = quote?.problems.length > 0;

  return (
    <div className="container checkout">
      <h1 className="page-title">{t('Checkout')}</h1>
      {params.get('cancelled') && (
        <div className="notice">
          <Info size={18} /> {t('The card payment was cancelled. Your order was not completed — you can try again.')}
        </div>
      )}
      <form className="two-col" onSubmit={submit} noValidate>
        <div className="checkout-steps">
          <section className="card step">
            <h2>
              <span className="step-num">1</span> {t('Contact details')}
            </h2>
            {!user && (
              <p className="muted small">
                {t('Already have an account?')} <Link to="/login?next=/checkout">{t('Sign in')}</Link>
              </p>
            )}
            <div className="grid-2">
              <Field label={t('Email')} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
              <Field label={t('Phone')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
            </div>
            <Field label={t('Full name')} autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
          </section>

          <section className="card step">
            <h2>
              <span className="step-num">2</span> {t('Delivery')}
            </h2>
            <div className="options">
              {quote?.shippingOptions.map((m) => (
                <label key={m.id} className={`option ${m.id === shippingMethodId ? 'active' : ''}`}>
                  <input type="radio" name="shipping" checked={m.id === shippingMethodId} onChange={() => setShippingMethodId(m.id)} />
                  <div className="grow">
                    <strong>{m.name}</strong>
                    {m.description && <div className="muted small">{m.description}</div>}
                    {m.freeOver != null && m.cost > 0 && <div className="muted small">{t('Free over {amount}', { amount: money(m.freeOver) })}</div>}
                  </div>
                  <span className="option-price">{m.cost ? money(m.cost) : t('Free')}</span>
                </label>
              ))}
              {!quote && <Spinner />}
            </div>
            {shipping?.requiresAddress && (
              <div className="address-fields">
                <Field label={t('Street address')} autoComplete="street-address" value={form.street} onChange={set('street')} error={errors.street} />
                <div className="grid-3">
                  <Field label={t('City')} autoComplete="address-level2" value={form.city} onChange={set('city')} error={errors.city} />
                  <Field label={t('Postal code')} autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} error={errors.postalCode} />
                  <Field label={t('Region (optional)')} autoComplete="address-level1" value={form.region} onChange={set('region')} error={errors.region} />
                </div>
                {user && <Checkbox label={t('Save this address to my account')} checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />}
              </div>
            )}
          </section>

          <section className="card step">
            <h2>
              <span className="step-num">3</span> {t('Payment')}
            </h2>
            <div className="options">
              {settings.paymentMethods.map((m) => {
                const Icon = PAYMENT_ICONS[m];
                return (
                  <label key={m} className={`option ${m === paymentMethod ? 'active' : ''}`}>
                    <input type="radio" name="payment" checked={m === paymentMethod} onChange={() => setPaymentMethod(m)} />
                    <Icon size={20} />
                    <div className="grow">
                      <strong>{t(PAYMENT_METHOD[m])}</strong>
                      <div className="muted small">
                        {m === 'card' && t('Pay securely on the next page')}
                        {m === 'cod' && (settings.payments.cod.fee ? t('Extra fee {amount}', { amount: money(settings.payments.cod.fee) }) : t('Pay when you receive your order'))}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <Field as="textarea" rows={3} label={t('Order notes (optional)')} value={form.notes} onChange={set('notes')} placeholder={t('e.g. delivery instructions')} error={errors.notes} />
          </section>

          <div className="place-order">
            <Checkbox
              checked={acceptTerms}
              error={errors.acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked);
                v.clear('acceptTerms');
              }}
              label={
                <>
                  {t('I accept the')}{' '}
                  {termsPage ? (
                    <Link to={`/p/${termsPage.slug}`} target="_blank">
                      {t('terms & conditions')}
                    </Link>
                  ) : (
                    t('terms & conditions')
                  )}
                </>
              }
            />
            <FormAlert message={errors._} />
            <button className="btn btn-primary btn-lg btn-block" disabled={submitting || hasProblems || !quote}>
              {submitting ? <Spinner /> : <Lock size={18} />}
              {paymentMethod === 'card' ? t('Continue to payment') : t('Place order')} · {money(quote?.total ?? 0)}
            </button>
            {hasProblems && <p className="line-problem">{t('Some items in your cart changed. Please review your order.')}</p>}
          </div>
        </div>

        <Summary items={items} quote={quote} loading={loading} coupon={coupon} setCoupon={setCoupon} problemFor={problemFor} />
      </form>
    </div>
  );
}
