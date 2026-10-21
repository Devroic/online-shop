// Builds docs/client-questionnaire.pdf: a fillable form (works in Adobe
// Reader, macOS Preview, Chrome/Edge) that clients fill in and email back.
//   node scripts/questionnaire/build.mjs          (Greek, the default)
//   node scripts/questionnaire/build.mjs --lang en
// Texts are written in English and translated with locales/<lang>.js.
// Edit the CONTENT below (and the translations) and run again. Fonts: Liberation Sans (SIL OFL, fonts/OFL.txt),
// embedded in full so Greek typed into the fields displays correctly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import el from './locales/el.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const SUPPORT = 'support@devroic.com';

const LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'el';
const DICTS = { el, en: {} };
const OUT = path.resolve(here, `../../docs/client-questionnaire${LANG === 'el' ? '' : `-${LANG}`}.pdf`);
if (!DICTS[LANG]) throw new Error(`Unknown language "${LANG}" (available: ${Object.keys(DICTS).join(', ')})`);
const t = (text) => (DICTS[LANG][text] ?? text).replaceAll('{email}', SUPPORT);

const C = {
  ink: rgb(0.07, 0.09, 0.15),
  muted: rgb(0.42, 0.45, 0.5),
  line: rgb(0.85, 0.87, 0.9),
  field: rgb(0.965, 0.97, 0.98),
  accent: rgb(0.15, 0.39, 0.92),
  noteBg: rgb(0.93, 0.95, 1),
  warnBg: rgb(1, 0.97, 0.9),
  white: rgb(1, 1, 1),
};

// ---------------------------------------------------------------- content
// Blocks: h (section), p (paragraph), field, row (two fields), check, note, warn.
// Only what is needed before the shop is set up. Everything else (logo,
// colours, shipping, cash on delivery, contact details, products) the client
// fills in from the admin after handover.
const CONTENT = [
  { type: 'h', text: '1. Your shop' },
  { type: 'row', fields: [
    { name: 'store_name', label: 'Shop name' },
    { name: 'domain', label: 'Domain (website address)', hint: 'e.g. myshop.gr' },
  ] },
  { type: 'checks', items: [['domain_have', 'I already have it: I will give you access to its DNS settings'], ['domain_buy', 'Please buy it for me']] },

  { type: 'h', text: '2. Email' },
  { type: 'field', name: 'email', label: 'Shop email', hint: 'New orders arrive here, you sign in to the shop\'s admin with it, and you open your Stripe account (card payments) with it.' },

  { type: 'h', text: '3. Business details' },
  { type: 'p', text: 'The law requires them in the shop\'s terms.' },
  { type: 'row', fields: [
    { name: 'legal_name', label: 'Legal name (as registered with the tax office)' },
    { name: 'vat', label: 'VAT number' },
  ] },
  { type: 'field', name: 'address', label: 'Business address', hint: 'Street, number, postcode, city' },

  { type: 'note', text: 'Card payments: your customers pay by card, Apple Pay or Google Pay through Stripe and the money is paid into your bank account. We will send you short instructions to open your own Stripe account (business details, IBAN, identity check) and give us access to it. Do not send us an IBAN or a photo of your ID by email.' },

];

// ----------------------------------------------------------------- layout
const PAGE = [595.28, 841.89]; // A4
const M = 48;
const W = PAGE[0] - 2 * M;
const FIELD_H = 22;

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
pdf.setTitle(t('Questionnaire for your online shop'));
pdf.setAuthor('Devroic');
pdf.setLanguage(LANG === 'el' ? 'el-GR' : LANG);
const regular = await pdf.embedFont(fs.readFileSync(path.join(here, 'fonts/LiberationSans-Regular.ttf')), { subset: false });
const bold = await pdf.embedFont(fs.readFileSync(path.join(here, 'fonts/LiberationSans-Bold.ttf')), { subset: true });
const form = pdf.getForm();

function wrap(text, font, size, width) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

let page;
let y;
const pages = [];

function newPage(first = false) {
  page = pdf.addPage(PAGE);
  pages.push(page);
  y = PAGE[1] - M;
  if (first) {
    page.drawRectangle({ x: 0, y: PAGE[1] - 120, width: PAGE[0], height: 120, color: C.ink });
    page.drawText(t('Questionnaire'), { x: M, y: PAGE[1] - 60, size: 26, font: bold, color: C.white });
    page.drawText(t('for your online shop'), { x: M, y: PAGE[1] - 86, size: 16, font: regular, color: rgb(0.8, 0.83, 0.9) });
    page.drawText('Devroic', { x: PAGE[0] - M - bold.widthOfTextAtSize('Devroic', 12), y: PAGE[1] - 40, size: 12, font: bold, color: rgb(0.65, 0.7, 0.8) });
    y = PAGE[1] - 120 - 22;
    const intro = [
      'Fill in the fields directly in this PDF (Adobe Reader, Preview on Mac or Chrome/Edge), save it and send it to {email}.',
      'It takes 2 minutes. Everything else (logo, colours, shipping costs, products, photos, texts) you add yourself from the shop\'s admin, and you can change it at any time.',
    ];
    for (const line of intro) text(t(line), { size: 10.5, color: C.ink, gap: 6 });
    y -= 6;
  }
}

const ensure = (h) => {
  if (y - h < M + 30) newPage();
};

function text(content, { size = 10, font = regular, color = C.ink, gap = 4, x = M, width = W } = {}) {
  const lines = wrap(content, font, size, width);
  ensure(lines.length * size * 1.35);
  for (const l of lines) {
    y -= size * 1.35;
    page.drawText(l, { x, y, size, font, color });
  }
  y -= gap;
}

function heading(title, breakBefore) {
  if (breakBefore) newPage();
  else ensure(90); // keep the heading with its first field
  y -= 14;
  page.drawText(title, { x: M, y: y - 14, size: 14, font: bold, color: C.ink });
  y -= 22;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1, color: C.line });
  y -= 8;
}

/** Draws one labelled field at x/width; returns the height used. Does not move y. */
function drawField(f, x, width, top) {
  let yy = top;
  const label = wrap(t(f.label), bold, 9.5, width);
  for (const l of label) {
    yy -= 12;
    page.drawText(l, { x, y: yy, size: 9.5, font: bold, color: C.ink });
  }
  yy -= 4;
  const h = f.lines ? f.lines * 14 + 8 : FIELD_H;
  const tf = form.createTextField(f.name);
  if (f.lines) tf.enableMultiline();
  tf.addToPage(page, { x, y: yy - h, width, height: h, font: regular, borderColor: C.line, backgroundColor: C.field, borderWidth: 1 });
  tf.setFontSize(10);
  yy -= h;
  if (f.hint) {
    for (const l of wrap(t(f.hint), regular, 8.5, width)) {
      yy -= 11;
      page.drawText(l, { x, y: yy, size: 8.5, font: regular, color: C.muted });
    }
  }
  return top - yy + 10;
}

function estimate(f, width) {
  return wrap(t(f.label), bold, 9.5, width).length * 12 + 4 + (f.lines ? f.lines * 14 + 8 : FIELD_H) + (f.hint ? wrap(t(f.hint), regular, 8.5, width).length * 11 : 0) + 10;
}

function box(content, bg, bar) {
  const lines = wrap(t(content), regular, 9.5, W - 28);
  const h = lines.length * 13 + 16;
  ensure(h + 8);
  y -= 4;
  page.drawRectangle({ x: M, y: y - h, width: W, height: h, color: bg });
  page.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: bar });
  let yy = y - 8;
  for (const l of lines) {
    yy -= 13;
    page.drawText(l, { x: M + 16, y: yy + 2, size: 9.5, font: regular, color: C.ink });
  }
  y -= h + 10;
}

newPage(true);
for (const b of CONTENT) {
  if (b.type === 'h') heading(t(b.text), b.breakBefore);
  else if (b.type === 'p') text(t(b.text), { color: C.muted, size: 9.5, gap: 8 });
  else if (b.type === 'note') box(b.text, C.noteBg, C.accent);
  else if (b.type === 'warn') box(b.text, C.warnBg, rgb(0.85, 0.47, 0.02));
  else if (b.type === 'field') {
    const width = W * (b.width || 1);
    ensure(estimate(b, width));
    y -= drawField(b, M, width, y);
  } else if (b.type === 'row') {
    const gap = 16;
    const width = (W - gap) / 2;
    ensure(Math.max(...b.fields.map((f) => estimate(f, width))));
    const used = b.fields.map((f, i) => drawField(f, M + i * (width + gap), width, y));
    y -= Math.max(...used);
  } else if (b.type === 'options') {
    // Checkbox + label on the left, small fields (with captions) on the right.
    const COL = M + 190;
    for (const it of b.items) {
      ensure(44);
      const top = y;
      const cb = form.createCheckBox(it.check);
      cb.addToPage(page, { x: M, y: top - 30, width: 13, height: 13, borderColor: rgb(0.55, 0.58, 0.63), backgroundColor: C.white, borderWidth: 1 });
      page.drawText(t(it.label), { x: M + 21, y: top - 27, size: 10.5, font: bold, color: C.ink });
      let x = COL;
      for (const f of it.fields) {
        page.drawText(t(f.label), { x, y: top - 12, size: 8.5, font: regular, color: C.muted });
        const tf = form.createTextField(f.name);
        tf.addToPage(page, { x, y: top - 36, width: f.width, height: FIELD_H, font: regular, borderColor: C.line, backgroundColor: C.field, borderWidth: 1 });
        tf.setFontSize(10);
        if (f.value) tf.setText(f.value);
        x += f.width + 14;
      }
      y -= 46;
    }
    y -= 6;
  } else if (b.type === 'checks') {
    ensure(b.items.length * 20 + (b.label ? 16 : 0));
    if (b.label) {
      y -= 12;
      page.drawText(t(b.label), { x: M, y, size: 9.5, font: bold, color: C.ink });
      y -= 4;
    }
    for (const [name, label] of b.items) {
      y -= 18;
      const cb = form.createCheckBox(name);
      cb.addToPage(page, { x: M, y: y - 2, width: 13, height: 13, borderColor: rgb(0.55, 0.58, 0.63), backgroundColor: C.white, borderWidth: 1 });
      page.drawText(t(label), { x: M + 21, y: y + 1, size: 10, font: regular, color: C.ink });
    }
    y -= 10;
  }
}

pages.forEach((p, i) => {
  const left = t('Shop questionnaire · {email}');
  p.drawLine({ start: { x: M, y: 40 }, end: { x: PAGE[0] - M, y: 40 }, thickness: 0.5, color: C.line });
  p.drawText(left, { x: M, y: 26, size: 8.5, font: regular, color: C.muted });
  const right = `${i + 1} / ${pages.length}`;
  p.drawText(right, { x: PAGE[0] - M - regular.widthOfTextAtSize(right, 8.5), y: 26, size: 8.5, font: regular, color: C.muted });
});

form.updateFieldAppearances(regular);
fs.writeFileSync(OUT, await pdf.save());
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${pages.length} pages, ${form.getFields().length} fields)`);
