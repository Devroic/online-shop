// Builds docs/client-questionnaire.pdf: a fillable form (works in Adobe
// Reader, macOS Preview, Chrome/Edge) that clients fill in and email back.
//   node scripts/questionnaire/build.mjs
// Edit the CONTENT below and run again. Fonts: Liberation Sans (SIL OFL, fonts/OFL.txt),
// embedded in full so Greek typed into the fields displays correctly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../docs/client-questionnaire.pdf');
const SUPPORT = 'support@devroic.com';

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
const CONTENT = [
  { type: 'h', text: '1. Το κατάστημα' },
  { type: 'field', name: 'store_name', label: 'Όνομα καταστήματος' },
  { type: 'field', name: 'brand_color', label: 'Χρώμα επωνυμίας (προαιρετικό)', hint: 'π.χ. «σκούρο πράσινο» ή #14532d. Αν το αφήσετε κενό, διαλέγουμε εμείς.' },
  { type: 'field', name: 'domain', label: 'Domain (διεύθυνση του site)', hint: 'π.χ. myshop.gr' },
  { type: 'checks', items: [['domain_have', 'Το έχω ήδη'], ['domain_buy', 'Θέλω να το αγοράσετε εσείς']] },
  { type: 'note', text: `Λογότυπο: στείλτε το με email στο ${SUPPORT} (ιδανικά PNG ή SVG με διάφανο φόντο).` },

  { type: 'h', text: '2. Επικοινωνία' },
  { type: 'row', fields: [
    { name: 'contact_email', label: 'Email επικοινωνίας', hint: 'Φαίνεται στο κατάστημα' },
    { name: 'contact_phone', label: 'Τηλέφωνο', hint: 'Φαίνεται στο κατάστημα' },
  ] },
  { type: 'field', name: 'orders_email', label: 'Email που θα λαμβάνει τις νέες παραγγελίες' },
  { type: 'field', name: 'admin_email', label: 'Email για τον λογαριασμό διαχείρισης', hint: 'Με αυτό θα συνδέεστε για να ανεβάζετε προϊόντα και να βλέπετε παραγγελίες.' },

  { type: 'h', text: '3. Αποστολές' },
  { type: 'field', name: 'shipping', label: 'Τρόποι αποστολής και κόστος', lines: 4, hint: 'π.χ. Courier 3,50 € · Παραλαβή από το κατάστημα δωρεάν' },
  { type: 'field', name: 'free_shipping', label: 'Δωρεάν αποστολή για παραγγελίες άνω των (€) — προαιρετικό', width: 0.5 },

  { type: 'h', text: '4. Πληρωμές' },
  { type: 'p', text: 'Οι πελάτες σας θα πληρώνουν ηλεκτρονικά με κάρτα, Apple Pay ή Google Pay, μέσω της Stripe. Τα χρήματα κατατίθενται στον λογαριασμό σας.' },
  { type: 'checks', items: [['cod', 'Δέχομαι και αντικαταβολή']] },
  { type: 'field', name: 'cod_fee', label: 'Επιπλέον χρέωση αντικαταβολής (€) — αν υπάρχει', width: 0.5 },

  { type: 'h', text: '5. Στοιχεία για την Stripe (πληρωμές με κάρτα)' },
  { type: 'p', text: 'Η Stripe χρειάζεται τα παρακάτω για να ανοίξει τον λογαριασμό πληρωμών της επιχείρησής σας. Επωνυμία, ΑΦΜ και διεύθυνση εμφανίζονται και στους όρους χρήσης του καταστήματος, όπως απαιτεί ο νόμος.' },
  { type: 'checks', label: 'Μορφή επιχείρησης', items: [['type_sole', 'Ατομική επιχείρηση / ελεύθερος επαγγελματίας'], ['type_company', 'Εταιρεία (ΙΚΕ, ΟΕ, ΕΕ, ΑΕ κ.λπ.)']] },
  { type: 'field', name: 'legal_name', label: 'Επωνυμία (όπως στην εφορία)' },
  { type: 'row', fields: [
    { name: 'vat', label: 'ΑΦΜ' },
    { name: 'activity', label: 'Τι πουλάτε (σύντομα)', hint: 'π.χ. ρούχα, καλλυντικά' },
  ] },
  { type: 'field', name: 'address', label: 'Διεύθυνση επιχείρησης', hint: 'Οδός, αριθμός, Τ.Κ., πόλη' },
  { type: 'row', fields: [
    { name: 'owner_name', label: 'Ονοματεπώνυμο υπευθύνου', hint: 'Ιδιοκτήτης ή νόμιμος εκπρόσωπος' },
    { name: 'owner_dob', label: 'Ημερομηνία γέννησης υπευθύνου', hint: 'ΗΗ/ΜΜ/ΕΕΕΕ' },
  ] },
  { type: 'row', fields: [
    { name: 'owner_phone', label: 'Κινητό υπευθύνου', hint: 'Για τον κωδικό επιβεβαίωσης της Stripe' },
    { name: 'owner_email', label: 'Email υπευθύνου' },
  ] },
  { type: 'field', name: 'partners', label: 'Μόνο για εταιρείες: εταίροι με ποσοστό άνω του 25%', lines: 2, hint: 'Ονοματεπώνυμο και ποσοστό του καθενός' },
  { type: 'row', fields: [
    { name: 'iban', label: 'IBAN', hint: 'Εκεί θα κατατίθενται οι πληρωμές' },
    { name: 'iban_holder', label: 'Δικαιούχος λογαριασμού' },
  ] },
  { type: 'field', name: 'statement', label: 'Όνομα στην κίνηση της κάρτας του πελάτη (έως 22 χαρακτήρες)', hint: 'π.χ. MYSHOP.GR · Αν το αφήσετε κενό, βάζουμε το όνομα του καταστήματος.', width: 0.6 },
  { type: 'warn', text: 'Η Stripe θα σας ζητήσει και επιβεβαίωση ταυτότητας (φωτογραφία ταυτότητας ή διαβατηρίου) μέσω ασφαλούς συνδέσμου που θα σας στείλουμε. Μη στέλνετε φωτογραφία ταυτότητας με email.' },

  { type: 'h', text: '6. Κάτι άλλο;' },
  { type: 'field', name: 'notes', label: 'Ό,τι άλλο θέλετε να μας πείτε', lines: 4, hint: 'π.χ. ιδέες για την εμφάνιση, sites που σας αρέσουν, ημερομηνία που θέλετε να ανοίξει το κατάστημα' },
];

// ----------------------------------------------------------------- layout
const PAGE = [595.28, 841.89]; // A4
const M = 48;
const W = PAGE[0] - 2 * M;
const FIELD_H = 22;

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
pdf.setTitle('Ερωτηματολόγιο για το ηλεκτρονικό σας κατάστημα');
pdf.setAuthor('Devroic');
pdf.setLanguage('el-GR');
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
    page.drawRectangle({ x: 0, y: PAGE[1] - 150, width: PAGE[0], height: 150, color: C.ink });
    page.drawText('Ερωτηματολόγιο', { x: M, y: PAGE[1] - 70, size: 26, font: bold, color: C.white });
    page.drawText('για το ηλεκτρονικό σας κατάστημα', { x: M, y: PAGE[1] - 96, size: 16, font: regular, color: rgb(0.8, 0.83, 0.9) });
    page.drawText('Devroic', { x: PAGE[0] - M - bold.widthOfTextAtSize('Devroic', 12), y: PAGE[1] - 40, size: 12, font: bold, color: rgb(0.65, 0.7, 0.8) });
    y = PAGE[1] - 150 - 26;
    const intro = [
      `Συμπληρώστε τα πεδία απευθείας σε αυτό το PDF (Adobe Reader, Preview σε Mac ή Chrome/Edge), αποθηκεύστε το και στείλτε το στο ${SUPPORT}.`,
      'Χρειάζονται περίπου 10 λεπτά. Ό,τι δεν ξέρετε ακόμα, αφήστε το κενό· τα υπόλοιπα (προϊόντα, φωτογραφίες, κείμενα) θα τα ανεβάζετε μόνοι σας από τη διαχείριση του καταστήματος.',
    ];
    for (const t of intro) text(t, { size: 10.5, color: C.ink, gap: 6 });
    y -= 6;
  }
}

const ensure = (h) => {
  if (y - h < M + 30) newPage();
};

function text(t, { size = 10, font = regular, color = C.ink, gap = 4, x = M, width = W } = {}) {
  const lines = wrap(t, font, size, width);
  ensure(lines.length * size * 1.35);
  for (const l of lines) {
    y -= size * 1.35;
    page.drawText(l, { x, y, size, font, color });
  }
  y -= gap;
}

function heading(t, breakBefore) {
  if (breakBefore) newPage();
  else ensure(120); // keep the heading with its first field
  y -= 14;
  page.drawText(t, { x: M, y: y - 14, size: 14, font: bold, color: C.ink });
  y -= 22;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1, color: C.line });
  y -= 8;
}

/** Draws one labelled field at x/width; returns the height used. Does not move y. */
function drawField(f, x, width, top) {
  let yy = top;
  const label = wrap(f.label, bold, 9.5, width);
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
    for (const l of wrap(f.hint, regular, 8.5, width)) {
      yy -= 11;
      page.drawText(l, { x, y: yy, size: 8.5, font: regular, color: C.muted });
    }
  }
  return top - yy + 10;
}

function estimate(f, width) {
  return wrap(f.label, bold, 9.5, width).length * 12 + 4 + (f.lines ? f.lines * 14 + 8 : FIELD_H) + (f.hint ? wrap(f.hint, regular, 8.5, width).length * 11 : 0) + 10;
}

function box(t, bg, bar) {
  const lines = wrap(t, regular, 9.5, W - 28);
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
  if (b.type === 'h') heading(b.text, b.breakBefore);
  else if (b.type === 'p') text(b.text, { color: C.muted, size: 9.5, gap: 8 });
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
  } else if (b.type === 'checks') {
    ensure(b.items.length * 20 + (b.label ? 16 : 0));
    if (b.label) {
      y -= 12;
      page.drawText(b.label, { x: M, y, size: 9.5, font: bold, color: C.ink });
      y -= 4;
    }
    for (const [name, label] of b.items) {
      y -= 18;
      const cb = form.createCheckBox(name);
      cb.addToPage(page, { x: M, y: y - 2, width: 13, height: 13, borderColor: rgb(0.55, 0.58, 0.63), backgroundColor: C.white, borderWidth: 1 });
      page.drawText(label, { x: M + 21, y: y + 1, size: 10, font: regular, color: C.ink });
    }
    y -= 10;
  }
}

pages.forEach((p, i) => {
  const left = `Ερωτηματολόγιο καταστήματος · ${SUPPORT}`;
  p.drawLine({ start: { x: M, y: 40 }, end: { x: PAGE[0] - M, y: 40 }, thickness: 0.5, color: C.line });
  p.drawText(left, { x: M, y: 26, size: 8.5, font: regular, color: C.muted });
  const right = `${i + 1} / ${pages.length}`;
  p.drawText(right, { x: PAGE[0] - M - regular.widthOfTextAtSize(right, 8.5), y: 26, size: 8.5, font: regular, color: C.muted });
});

form.updateFieldAppearances(regular);
fs.writeFileSync(OUT, await pdf.save());
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${pages.length} pages, ${form.getFields().length} fields)`);
