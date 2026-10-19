import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, CircleCheck, AlertCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { money } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { COLUMNS, parseCsv, parseSheet, templateRows } from '../lib/productImport.js';
import { Spinner } from '../components/ui.jsx';
import { Modal } from './components.jsx';

const BATCH = 25;

async function readFile(file) {
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return parseCsv((await file.text()).replace(/^﻿/, ''));
  const { readSheet } = await import('read-excel-file/universal');
  return readSheet(file);
}

async function downloadTemplate() {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const [header, ...rows] = templateRows();
  await writeExcelFile([header.map((value) => ({ value, fontWeight: 'bold' })), ...rows.map((r) => r.map((value) => ({ value })))], {
    columns: COLUMNS.map((c) => ({ width: c.width })),
    stickyRowsCount: 1,
  }).toFile('products-template.xlsx');
}

/** Excel/CSV product import: template → upload → preview → import in batches. */
export default function ProductImport({ onClose, onDone }) {
  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [parsed, setParsed] = useState(null);
  const [existing, setExisting] = useState([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const sheet = await readFile(file);
      const p = parseSheet(sheet, t);
      p.errors.sort((a, b) => a.row - b.row);
      if (!p.products.length && !p.errors.length) throw new Error(t('The file is empty'));
      // Ask which products already exist (they will be updated).
      const names = [];
      for (let i = 0; i < p.products.length; i += 50) {
        const r = await api.post('/admin/products/import', { dryRun: true, products: p.products.slice(i, i + 50).map(({ row, ...x }) => x) });
        names.push(...r.existing);
      }
      setExisting(names.map((n) => n.trim().toLowerCase()));
      setParsed(p);
      setStep('preview');
    } catch (err) {
      setError(err.status ? t('Could not read the file: {msg}', { msg: err.message }) : t('Could not read the file. Save it as .xlsx and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setStep('importing');
    const total = { created: 0, updated: 0, errors: [] };
    const list = parsed.products;
    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
      try {
        const r = await api.post('/admin/products/import', { products: batch.map(({ row, ...x }) => x) });
        total.created += r.created;
        total.updated += r.updated;
        total.errors.push(...r.errors);
      } catch (err) {
        total.errors.push(...batch.map((p) => ({ name: p.name, error: err.message })));
      }
      setProgress(Math.min(list.length, i + BATCH));
    }
    setResult(total);
    setStep('done');
    onDone();
  };

  const isNew = (p) => !existing.includes(p.name.trim().toLowerCase());
  const newCount = parsed?.products.filter(isNew).length ?? 0;

  return (
    <Modal
      wide
      title={t('Import products from Excel')}
      onClose={step === 'importing' ? () => {} : onClose}
      footer={
        step === 'preview' ? (
          <>
            <button className="btn btn-ghost mr-auto" onClick={() => setStep('pick')}>
              {t('Choose another file')}
            </button>
            <button className="btn btn-primary" onClick={run} disabled={!parsed.products.length}>
              {t('Import {n} products', { n: parsed.products.length })}
            </button>
          </>
        ) : step === 'done' ? (
          <button className="btn btn-primary" onClick={onClose}>
            {t('Done')}
          </button>
        ) : null
      }
    >
      {step === 'pick' && (
        <div className="import-pick">
          <ol className="import-steps">
            <li>
              <span>{t('Download the template and fill it in Excel (one row per product).')}</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                <Download size={16} /> {t('Download template')}
              </button>
            </li>
            <li>{t('Products with sizes/colours: one row per option, with the same name and the option in the “Option” column.')}</li>
            <li>{t('Empty “Stock” = always available. Products with the same name as an existing one are updated (their photos are kept).')}</li>
            <li>{t('Photos: add them afterwards from each product, or put image links in the “Photos” column.')}</li>
          </ol>
          <button type="button" className="uploader-drop import-drop" onClick={() => input.current.click()} disabled={busy}>
            {busy ? <Spinner /> : <FileSpreadsheet size={26} />}
            <span>{busy ? t('Reading file…') : t('Choose Excel file (.xlsx or .csv)')}</span>
          </button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => {
              pick(e.target.files[0]);
              e.target.value = '';
            }}
          />
          {error && <p className="field-error">{error}</p>}
        </div>
      )}

      {step === 'preview' && (
        <>
          <div className="import-summary">
            <span className="status status-delivered">{t('{n} new', { n: newCount })}</span>
            <span className="status status-processing">{t('{n} to update', { n: parsed.products.length - newCount })}</span>
            {parsed.errors.length > 0 && <span className="status status-cancelled">{t('{n} rows with problems', { n: parsed.errors.length })}</span>}
          </div>
          {parsed.errors.length > 0 && (
            <div className="import-errors">
              <p>
                <AlertCircle size={16} /> {t('These rows will be skipped. Fix them in Excel and import again, or continue without them.')}
              </p>
              <ul>
                {parsed.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    <strong>{t('Row {n}', { n: e.row })}:</strong> {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="table-wrap import-table">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Product')}</th>
                  <th>{t('Price')}</th>
                  <th>{t('Stock')}</th>
                  <th>{t('Category')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {parsed.products.slice(0, 200).map((p) => (
                  <tr key={p.row}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.variants.length > 0 && <div className="muted small">{p.variants.map((v) => v.name).join(', ')}</div>}
                    </td>
                    <td className="nowrap">{money(p.price)}</td>
                    <td>{!p.trackStock ? '∞' : p.variants.length ? p.variants.reduce((n, v) => n + v.stock, 0) : p.stock}</td>
                    <td>{p.categoryName || '—'}</td>
                    <td>{isNew(p) ? <span className="status status-delivered">{t('New')}</span> : <span className="status status-processing">{t('Update')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.products.length > 200 && <p className="muted small">{t('…and {n} more', { n: parsed.products.length - 200 })}</p>}
        </>
      )}

      {step === 'importing' && (
        <div className="import-progress">
          <Spinner size={26} />
          <p>{t('Importing {done} of {total}…', { done: progress, total: parsed.products.length })}</p>
          <div className="free-ship-track">
            <div style={{ width: `${(progress / parsed.products.length) * 100}%` }} />
          </div>
          <p className="muted small">{t('Keep this window open until it finishes.')}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="import-progress">
          <CircleCheck size={40} className="ok-icon" />
          <h3>{t('{created} products created, {updated} updated', { created: result.created, updated: result.updated })}</h3>
          {result.errors.length > 0 && (
            <div className="import-errors">
              <p>
                <AlertCircle size={16} /> {t('{n} could not be imported:', { n: result.errors.length })}
              </p>
              <ul>
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <strong>{e.name}:</strong> {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
