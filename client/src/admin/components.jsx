import { useEffect, useRef, useState } from 'react';
import { Upload, X, GripVertical, ImagePlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { centsToInput, parseMoney } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { useShop } from '../context/ShopContext.jsx';
import { Spinner } from '../components/ui.jsx';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="a-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="row-gap">{actions}</div>}
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
      <span>{settings.currency === 'EUR' ? '€' : settings.currency}</span>
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

export function useConfirm() {
  return (message) => window.confirm(message);
}

export function SearchInput({ value, onChange, placeholder }) {
  const [text, setText] = useState(value || '');
  useEffect(() => {
    const id = setTimeout(() => text !== (value || '') && onChange(text), 300);
    return () => clearTimeout(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input className="input a-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />;
}
