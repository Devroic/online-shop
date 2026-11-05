import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Upload, X, GripVertical, ImagePlus, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { CURRENCY_SYMBOL, centsToInput, parseMoney } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { Spinner } from '../components/ui.jsx';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="a-page-head">
      <div className="a-page-title">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row-gap a-page-actions">{actions}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true" />
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small className="muted">{hint}</small>}
      </span>
    </label>
  );
}

/**
 * Save controls every editable admin page uses: the button at the top right
 * ("Save changes" / "Saved") and, while there are changes, the bar at the bottom
 * with Discard. With `submit`, both submit the surrounding form instead of calling onSave.
 */
export function SaveButton({ dirty, saving, onSave, submit, createLabel }) {
  // "Saved ✓" only for a moment after a save that worked (saving ended and nothing is left
  // to save); otherwise the button says "Save changes", greyed out while there is nothing to save.
  const [justSaved, setJustSaved] = useState(false);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && !saving && !dirty) setJustSaved(true);
    wasSaving.current = saving;
  }, [saving, dirty]);
  useEffect(() => {
    if (dirty) setJustSaved(false);
    if (!justSaved) return;
    const id = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(id);
  }, [justSaved, dirty]);

  // `createLabel`: a new item that is not saved yet ("Create product"), always clickable.
  return (
    <button type={submit ? 'submit' : 'button'} className="btn btn-primary" onClick={submit ? undefined : onSave} disabled={saving || (!dirty && !createLabel)}>
      {saving ? <Spinner /> : justSaved && !dirty && <Check size={16} />} {createLabel || (justSaved && !dirty ? t('Saved') : t('Save changes'))}
    </button>
  );
}

export function SaveBar({ dirty, saving, onSave, onDiscard, submit, saveLabel }) {
  useUnsavedGuard(dirty);
  if (!dirty) return null;
  return (
    <div className="save-bar">
      <span>{t('You have unsaved changes')}</span>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDiscard}>
        {t('Discard')}
      </button>
      <button type={submit ? 'submit' : 'button'} className="btn btn-primary btn-sm" onClick={submit ? undefined : onSave} disabled={saving}>
        {saving && <Spinner />} {saveLabel || t('Save changes')}
      </button>
    </div>
  );
}

/**
 * While a page has unsaved changes: leaving it through a link asks first (our own
 * dialog), and closing or reloading the tab gets the browser's warning. Navigations
 * that replace the page (after saving a new item, after deleting) are not stopped.
 */
export function useUnsavedGuard(dirty) {
  const confirm = useConfirm();
  const blocker = useBlocker(({ currentLocation, nextLocation, historyAction }) => dirty && historyAction !== 'REPLACE' && currentLocation.pathname !== nextLocation.pathname);
  const latest = useRef(blocker);
  latest.current = blocker;
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const blocked = latest.current;
    confirm({
      title: t('Leave without saving?'),
      message: t('Your changes on this page will be lost.'),
      confirmLabel: t('Leave'),
      cancelLabel: t('Stay'),
      danger: true,
    }).then((leave) => (leave ? blocked.proceed() : blocked.reset()));
  }, [blocker.state, confirm]);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);
}

/** Money input that shows euros but reports integer cents. */
export function MoneyInput({ value, onChange, allowEmpty, ...props }) {
  const { settings } = useShop();
  const [text, setText] = useState(centsToInput(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(centsToInput(value));
  }, [value]);
  return (
    <div className="money-input">
      <input
        inputMode="decimal"
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(centsToInput(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          const cents = parseMoney(e.target.value);
          onChange(cents == null ? (allowEmpty ? null : 0) : cents);
        }}
        {...props}
      />
      <span>{CURRENCY_SYMBOL[settings.currency] || settings.currency}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close')}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Uploads images and manages an ordered list of URLs (drag to reorder). */
export function ImageUploader({ value, onChange, multiple = true, kind }) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const dragIndex = useRef(null);
  const input = useRef(null);

  const upload = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    setError(list.length < files.length ? t('Only image files are allowed') : '');
    if (!list.length) return;
    setBusy(true);
    try {
      const { urls } = await api.upload(multiple ? list : list.slice(0, 1), kind);
      onChange(multiple ? [...value, ...urls] : urls.slice(0, 1));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const move = (from, to) => {
    if (from === to || from == null) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <>
      <div className={`uploader ${multiple ? '' : 'single'}`}>
        {value.map((url, i) => (
          <div
            key={url}
            className="uploader-item"
            draggable={multiple}
            onDragStart={() => (dragIndex.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              move(dragIndex.current, i);
              dragIndex.current = null;
            }}
          >
            <img src={url} alt="" />
            {multiple && i === 0 && <span className="uploader-main">{t('Main')}</span>}
            {multiple && (
              <span className="uploader-grip" aria-hidden="true">
                <GripVertical size={14} />
              </span>
            )}
            <button type="button" className="uploader-remove" onClick={() => onChange(value.filter((u) => u !== url))} aria-label={t('Remove')}>
              <X size={14} />
            </button>
          </div>
        ))}
        {(multiple || !value.length) && (
          <button
            type="button"
            className={`uploader-drop ${dragOver ? 'over' : ''}`}
            onClick={() => input.current.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
            }}
          >
            {busy ? <Spinner /> : value.length ? <ImagePlus size={22} /> : <Upload size={22} />}
            <span>{busy ? t('Uploading…') : t('Add images')}</span>
            <small className="muted">{t('or drag & drop')}</small>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

const ConfirmContext = createContext(null);

/**
 * Our own confirmation window instead of the browser's (which looks different in
 * every browser and can be switched off by the visitor). Wrap the admin in
 * <ConfirmProvider>, then:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title, message, confirmLabel, danger: true }))) return;
 */
export function ConfirmProvider({ children }) {
  const [ask, setAsk] = useState(null); // { title, message, confirmLabel, danger, resolve }
  const answer = useCallback(
    (yes) => {
      ask?.resolve(yes);
      setAsk(null);
    },
    [ask],
  );
  const confirm = useCallback((opts) => new Promise((resolve) => setAsk({ ...(typeof opts === 'string' ? { message: opts } : opts), resolve })), []);

  useEffect(() => {
    if (!ask) return;
    // Capture first, so Escape closes only this window and not an editor behind it.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        answer(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ask, answer]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && (
        <div className="modal-backdrop confirm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
          <div className="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <div className="modal-body">
              <h2 id="confirm-title">{ask.title || t('Are you sure?')}</h2>
              {ask.message && (
                <p id="confirm-message" className="muted">
                  {ask.message}
                </p>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => answer(false)}>
                {ask.cancelLabel || t('Cancel')}
              </button>
              <button className={`btn ${ask.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => answer(true)} autoFocus>
                {ask.confirmLabel || t('OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

export function SearchInput({ value, onChange, placeholder }) {
  const [text, setText] = useState(value || '');
  useEffect(() => {
    const id = setTimeout(() => text !== (value || '') && onChange(text), 300);
    return () => clearTimeout(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className="input a-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />;
}
