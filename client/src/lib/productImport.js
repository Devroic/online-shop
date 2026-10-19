// Turns an Excel/CSV sheet into products for POST /api/admin/products/import.
// Pure functions (no React), so they're easy to test.
//
// One row per product. Products with options (size, colour…) use one row per
// option with the same product name; each option row has its own price/stock.

export const COLUMNS = [
  { key: 'name', label: 'Όνομα', aliases: ['name', 'όνομα', 'ονομα', 'προϊόν', 'προιον', 'product', 'title', 'τίτλος'], required: true, width: 30 },
  { key: 'option', label: 'Επιλογή', aliases: ['option', 'variant', 'επιλογή', 'επιλογη', 'μέγεθος', 'μεγεθος', 'size'], width: 14 },
  { key: 'price', label: 'Τιμή', aliases: ['price', 'τιμή', 'τιμη'], required: true, width: 10 },
  { key: 'compareAtPrice', label: 'Αρχική τιμή', aliases: ['compare at price', 'compare_at_price', 'αρχική τιμή', 'αρχικη τιμη', 'τιμή πριν', 'old price'], width: 12 },
  { key: 'stock', label: 'Απόθεμα', aliases: ['stock', 'απόθεμα', 'αποθεμα', 'quantity', 'ποσότητα', 'ποσοτητα', 'qty'], width: 10 },
  { key: 'sku', label: 'Κωδικός', aliases: ['sku', 'κωδικός', 'κωδικος', 'code'], width: 14 },
  { key: 'category', label: 'Κατηγορία', aliases: ['category', 'κατηγορία', 'κατηγορια'], width: 16 },
  { key: 'description', label: 'Περιγραφή', aliases: ['description', 'περιγραφή', 'περιγραφη'], width: 40 },
  { key: 'images', label: 'Φωτογραφίες (links)', aliases: ['images', 'image', 'photos', 'φωτογραφίες', 'φωτογραφιες', 'φωτογραφία', 'εικόνες', 'εικονες'], width: 30 },
  { key: 'featured', label: 'Προτεινόμενο', aliases: ['featured', 'προτεινόμενο', 'προτεινομενο'], width: 13 },
  { key: 'active', label: 'Ορατό', aliases: ['active', 'visible', 'ορατό', 'ορατο'], width: 8 },
];

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();

const isEmpty = (v) => v == null || String(v).trim() === '';

/** "12,50 €", "1.234,50", 12.5 → cents; null if empty; NaN if invalid. */
export function parsePrice(v) {
  if (isEmpty(v)) return null;
  if (typeof v === 'number') return Math.round(v * 100);
  let s = String(v).replace(/[^\d.,-]/g, '');
  if (s.includes('.') && s.includes(',')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return s && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

function parseStock(v) {
  if (isEmpty(v)) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

function parseBool(v, fallback) {
  if (isEmpty(v)) return fallback;
  if (typeof v === 'boolean') return v;
  const s = norm(v);
  if (['ναι', 'nai', 'yes', 'y', 'x', '1', 'true', '✓', 'ν'].includes(s)) return true;
  if (['οχι', 'oxi', 'no', 'n', '0', 'false', '-'].includes(s)) return false;
  return fallback;
}

const parseImages = (v) =>
  isEmpty(v) ? [] : String(v).split(/[\s,;]+/).filter((u) => /^https?:\/\/\S+$/i.test(u)).slice(0, 20);

/** Maps the header row to column keys; returns { map, missing }. */
function readHeader(header) {
  const map = {};
  header.forEach((h, i) => {
    const n = norm(h);
    const col = COLUMNS.find((c) => c.aliases.some((a) => norm(a) === n) || norm(c.label) === n);
    if (col && map[col.key] == null) map[col.key] = i;
  });
  const missing = COLUMNS.filter((c) => c.required && map[c.key] == null).map((c) => c.label);
  return { map, missing };
}

/**
 * sheet: array of rows (first row = headers), as returned by read-excel-file.
 * Returns { products, errors: [{ row, message }] } — `row` is the Excel row number.
 */
export function parseSheet(sheet, t = (s, v) => (v ? Object.entries(v).reduce((o, [k, x]) => o.replace(`{${k}}`, x), s) : s)) {
  const errors = [];
  const headerIndex = sheet.findIndex((r) => r.some((c) => !isEmpty(c)));
  if (headerIndex < 0) return { products: [], errors: [{ row: 1, message: t('The file is empty') }] };
  const { map, missing } = readHeader(sheet[headerIndex]);
  if (missing.length) {
    return { products: [], errors: [{ row: headerIndex + 1, message: t('Missing columns: {cols}', { cols: missing.join(', ') }) }] };
  }

  const groups = new Map();
  sheet.slice(headerIndex + 1).forEach((cells, i) => {
    const rowNo = headerIndex + 2 + i;
    const get = (key) => (map[key] == null ? null : cells[map[key]]);
    if (cells.every(isEmpty)) return;
    const name = String(get('name') ?? '').trim();
    if (!name) return errors.push({ row: rowNo, message: t('Name is missing') });
    const price = parsePrice(get('price'));
    if (price == null || Number.isNaN(price)) return errors.push({ row: rowNo, message: t('Invalid price') });
    const compareAtPrice = parsePrice(get('compareAtPrice'));
    if (Number.isNaN(compareAtPrice)) return errors.push({ row: rowNo, message: t('Invalid original price') });
    const stock = parseStock(get('stock'));
    if (Number.isNaN(stock)) return errors.push({ row: rowNo, message: t('Stock must be a whole number') });

    const key = norm(name);
    if (!groups.has(key)) groups.set(key, { name, rows: [] });
    groups.get(key).rows.push({
      rowNo,
      option: String(get('option') ?? '').trim(),
      price,
      compareAtPrice,
      stock,
      sku: String(get('sku') ?? '').trim(),
      category: String(get('category') ?? '').trim(),
      description: String(get('description') ?? '').trim(),
      images: parseImages(get('images')),
      featured: parseBool(get('featured'), null),
      active: parseBool(get('active'), null),
    });
  });

  const products = [];
  for (const { name, rows } of groups.values()) {
    const first = (k) => rows.find((r) => !isEmpty(r[k]) && !(Array.isArray(r[k]) && !r[k].length))?.[k];
    const hasOptions = rows.some((r) => r.option);
    if (!hasOptions && rows.length > 1) {
      errors.push({ row: rows[1].rowNo, message: t('“{name}” appears more than once. For sizes/colours fill in the “Option” column.', { name }) });
      continue;
    }
    if (hasOptions && rows.some((r) => !r.option)) {
      errors.push({ row: rows.find((r) => !r.option).rowNo, message: t('“{name}” has options: fill in “Option” on every row.', { name }) });
      continue;
    }
    const price = Math.min(...rows.map((r) => r.price));
    const tracked = rows.some((r) => r.stock != null);
    products.push({
      row: rows[0].rowNo,
      name,
      description: first('description') ?? '',
      price,
      compareAtPrice: first('compareAtPrice') ?? null,
      sku: hasOptions ? '' : rows[0].sku,
      stock: hasOptions ? 0 : rows[0].stock ?? 0,
      // An empty "Stock" column means "don't track stock" (always available).
      trackStock: tracked,
      categoryName: first('category') ?? '',
      images: first('images') ?? [],
      featured: first('featured') ?? undefined,
      active: first('active') ?? undefined,
      variants: hasOptions
        ? rows.map((r) => ({ name: r.option, sku: r.sku, price: r.price === price ? null : r.price, stock: r.stock ?? 0 }))
        : [],
    });
  }
  return { products, errors };
}

/** Minimal CSV reader (Excel saves Greek CSVs with ";" and sometimes Windows-1253 — we accept UTF-8). */
export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Rows for the downloadable template (header + examples). */
export function templateRows() {
  return [
    COLUMNS.map((c) => c.label),
    ['Κεραμική κούπα', '', 12.9, '', 20, 'MUG-01', 'Σπίτι', 'Χειροποίητη κούπα 350ml.', '', 'ναι', 'ναι'],
    ['Βαμβακερό T-shirt', 'S', 19.9, 24.9, 5, 'TS-S', 'Ρούχα', 'Μαλακό t-shirt από οργανικό βαμβάκι.', '', '', ''],
    ['Βαμβακερό T-shirt', 'M', 19.9, 24.9, 8, 'TS-M', 'Ρούχα', '', '', '', ''],
    ['Βαμβακερό T-shirt', 'XL', 21.9, 24.9, 3, 'TS-XL', 'Ρούχα', '', '', '', ''],
    ['Κάρτα δώρου', '', 25, '', '', '', 'Δώρα', 'Χωρίς απόθεμα = πάντα διαθέσιμο.', '', '', ''],
  ];
}
