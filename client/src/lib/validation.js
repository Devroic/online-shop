// One set of form checks and messages for the whole app (shop and admin).
// The same error codes come from the server (see server/src/utils.js), so a
// field shows the same message whether the browser or the server caught it.
import { useCallback, useState } from 'react';
import { t } from './i18n.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Error code (e.g. "required", "min_length:8") → message in the shop's language. */
export function errorMessage(code) {
  const [name, arg] = String(code).split(':');
  switch (name) {
    case 'required':
      return t('This field is required');
    case 'email':
      return t('Enter a valid email');
    case 'url':
      return t('Enter a valid link');
    case 'colour':
      return t('Use a colour like #1a2b3c');
    case 'min_length':
      return t('At least {n} characters', { n: arg });
    case 'max_length':
      return t('Up to {n} characters', { n: arg });
    case 'min':
      return t('Must be {n} or more', { n: arg });
    case 'max':
      return t('Must be {n} or less', { n: arg });
    case 'positive':
      return t('Must be greater than 0');
    case 'integer':
      return t('Enter a whole number');
    case 'number':
      return t('Enter a number');
    case 'above_price':
      return t('Must be higher than the price');
    case 'exists':
      return t('Already in use');
    case 'wrong':
      return t('Incorrect');
    case 'accept_terms':
      return t('Please accept the terms');
    default:
      return t('Please check this field');
  }
}

const empty = (v) => v == null || (typeof v === 'string' && !v.trim());

// Rules return an error code, or nothing when the value is fine. Apart from
// `required`, they skip empty values, so optional fields stay optional.
export const rules = {
  required: () => (v) => (empty(v) || v === false ? 'required' : null),
  email: () => (v) => (!empty(v) && !EMAIL.test(String(v).trim()) ? 'email' : null),
  minLength: (n) => (v) => (!empty(v) && String(v).trim().length < n ? `min_length:${n}` : null),
  maxLength: (n) => (v) => (!empty(v) && String(v).length > n ? `max_length:${n}` : null),
  integer: () => (v) => (!empty(v) && !Number.isInteger(Number(v)) ? 'integer' : null),
  min: (n) => (v) => (!empty(v) && Number(v) < n ? `min:${n}` : null),
  max: (n) => (v) => (!empty(v) && Number(v) > n ? `max:${n}` : null),
  positive: () => (v) => (empty(v) || !(Number(v) > 0) ? 'positive' : null),
  url: () => (v) => (!empty(v) && !/^https?:\/\/[^\s.]+\.\S+$/.test(String(v).trim()) ? 'url' : null),
  colour: () => (v) => (!empty(v) && !/^#[0-9a-fA-F]{6}$/.test(v) ? 'colour' : null),
  acceptTerms: () => (v) => (v ? null : 'accept_terms'),
};

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

/** Checks `values` against `{ 'path.to.field': [rule, …] }`; returns `{ path: message }`. */
export function check(values, schema) {
  const out = {};
  for (const [path, list] of Object.entries(schema)) {
    for (const rule of list.filter(Boolean)) {
      const code = rule(get(values, path));
      if (code) {
        out[path] = errorMessage(code);
        break;
      }
    }
  }
  return out;
}

/**
 * Server error → `{ path: message }`. Errors are keyed by full path
 * ("address.city") and by last segment ("city") for flat forms. A message
 * that is not about a field goes under `_` and is shown above the buttons.
 */
export function fieldErrors(err) {
  const out = {};
  for (const [path, code] of Object.entries(err?.details || {})) {
    if (typeof code !== 'string') continue;
    const message = errorMessage(code);
    if (path === '_') continue;
    out[path] = message;
    // Alias "address.city" as "city"; list rows ("variants.0.name") keep only their full path.
    const parts = path.split('.');
    if (parts.length > 1 && !parts.some((p) => /^\d+$/.test(p)) && !(parts.at(-1) in out)) out[parts.at(-1)] = message;
  }
  if (!Object.keys(out).length) out._ = err?.message || t('Something went wrong, please try again');
  return out;
}

/** Moves focus to the first invalid field once React has rendered the errors. */
export function focusFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector('[aria-invalid="true"], .form-alert');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.matches('input, select, textarea')) el.focus({ preventScroll: true });
  });
}

/**
 * Error state for a form:
 *   const v = useValidation();
 *   if (!v.validate(form, { email: [rules.required(), rules.email()] })) return;
 *   try { … } catch (err) { v.fail(err); }
 *   <Field error={v.errors.email} onChange={(e) => { v.clear('email'); … }} />
 *   <FormAlert message={v.errors._} />
 */
export function useValidation() {
  const [errors, setErrors] = useState({});
  const show = useCallback((next) => {
    setErrors(next);
    if (Object.keys(next).length) focusFirstError();
  }, []);
  const validate = useCallback(
    (values, schema) => {
      const next = check(values, schema);
      show(next);
      return !Object.keys(next).length;
    },
    [show],
  );
  const fail = useCallback((err) => show(fieldErrors(err)), [show]);
  const clear = useCallback(
    (...paths) =>
      setErrors((cur) => {
        if (!paths.some((p) => p in cur) && !cur._) return cur;
        const next = { ...cur };
        for (const p of paths) {
          delete next[p];
          delete next[p.split('.').pop()];
        }
        delete next._;
        return next;
      }),
    [],
  );
  return { errors, validate, fail, clear, show, reset: useCallback(() => setErrors({}), []) };
}
