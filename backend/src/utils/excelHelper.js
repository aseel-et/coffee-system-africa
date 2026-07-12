/**
 * Reusable Excel (xlsx) helpers built on exceljs, shared by the import/export
 * routes (customers, inventory, ...). Keeps header styling, dropdown validation,
 * number formats, an instructions sheet and base64 parsing in one place.
 *
 * A "column" is: { key, header, width, required, kind, list }
 *   kind: 'text' | 'money' | 'number' | 'yesno' | 'list'
 *   list: name of a list in the `lists` object (only when kind === 'list')
 */
const ExcelJS = require('exceljs');

const YES = 'نعم', NO = 'لا';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5E34' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };

// Write dropdown source values into a veryHidden sheet, return name->range map.
function addListsSheet(wb, lists) {
  const ws = wb.addWorksheet('lists', { state: 'veryHidden' });
  const ranges = {};
  let col = 1;
  const all = { ...lists, __yesno: [YES, NO] };
  for (const [name, values] of Object.entries(all)) {
    const letter = ws.getColumn(col).letter;
    (values.length ? values : ['']).forEach((v, i) => { ws.getCell(`${letter}${i + 1}`).value = v; });
    ranges[name] = `lists!$${letter}$1:$${letter}$${Math.max(values.length, 1)}`;
    col++;
  }
  return ranges;
}

function styleHeaderAndColumns(ws, columns, ranges, dataRows) {
  // header
  const headerRow = ws.getRow(1);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header + (c.required ? ' *' : '');
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF6B4423' } } };
  });
  headerRow.height = 26;
  ws.columns = columns.map(c => ({ width: c.width || 18 }));
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  // per-cell formats + validations
  const lastRow = Math.max(dataRows, 1) + 1;
  columns.forEach((c, idx) => {
    const colNum = idx + 1;
    for (let r = 2; r <= lastRow; r++) {
      const cell = ws.getCell(r, colNum);
      if (c.kind === 'money') cell.numFmt = '#,##0.00';
      else if (c.kind === 'number') cell.numFmt = '#,##0';
      let range = null;
      if (c.kind === 'yesno') range = ranges && ranges.__yesno;
      else if (c.kind === 'list' && c.list) range = ranges && ranges[c.list];
      if (range) cell.dataValidation = { type: 'list', allowBlank: true, formulae: [range] };
    }
  });
}

// rows: array of arrays (cell values already in column order)
function createDataSheet(wb, { sheetName, columns, rows = [], lists = {}, blankRows = 200 }) {
  const ws = wb.addWorksheet(sheetName);
  const ranges = addListsSheet(wb, lists);
  rows.forEach(r => ws.addRow(r));
  styleHeaderAndColumns(ws, columns, ranges, Math.max(rows.length, blankRows));
  return ws;
}

function buildInstructionsSheet(wb, title, items) {
  const ws = wb.addWorksheet('تعليمات');
  ws.views = [{ rightToLeft: true }];
  ws.columns = [{ width: 26 }, { width: 16 }, { width: 64 }];
  const t = ws.addRow([title, '', '']);
  t.font = { bold: true, size: 14, color: { argb: 'FF8B5E34' } };
  ws.addRow([]);
  const head = ws.addRow(['العمود', 'النوع', 'الشرح']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell(c => { c.fill = HEADER_FILL; c.alignment = { horizontal: 'center' }; });
  items.forEach(([col, type, desc]) => {
    const row = ws.addRow([col, type, desc]);
    row.getCell(3).alignment = { wrapText: true };
  });
  return ws;
}

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // HTTP headers must be latin1; use RFC 5987 filename* for non-ASCII (Arabic) names,
  // with an ASCII fallback so older clients still get a valid filename.
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
  res.setHeader('Content-Disposition',
    `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  await wb.xlsx.write(res);
  res.end();
}

// Parse an uploaded base64 xlsx into row objects keyed by column.key.
// Returns { rows: [{<key>: 'string', __rowNumber: n}], error }.
async function parseUpload(fileBase64, sheetName, columns) {
  if (!fileBase64) return { error: 'لم يتم إرسال ملف' };
  if (fileBase64.includes(',')) fileBase64 = fileBase64.split(',').pop();
  const buffer = Buffer.from(fileBase64, 'base64');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(sheetName) || wb.worksheets[0];
  if (!ws) return { error: 'الملف لا يحتوي على بيانات' };

  // map header text -> column key (tolerant of the " *" suffix and reordering)
  const colIndex = {};
  ws.getRow(1).eachCell((cell, c) => {
    const txt = String(cell.value || '').replace('*', '').trim();
    const col = columns.find(k => k.header === txt || k.header.replace(' *', '') === txt);
    if (col) colIndex[col.key] = c;
  });

  const cellStr = (row, key) => {
    if (colIndex[key] === undefined) return '';
    let v = row.getCell(colIndex[key]).value;
    if (v && typeof v === 'object') v = v.text || v.result || (v.richText && v.richText.map(t => t.text).join('')) || '';
    return String(v ?? '').trim();
  };

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = { __rowNumber: rowNumber };
    let hasAny = false;
    for (const c of columns) {
      obj[c.key] = cellStr(row, c.key);
      if (obj[c.key]) hasAny = true;
    }
    if (hasAny) rows.push(obj);
  });

  return { rows, colIndex };
}

const num = (s) => {
  const n = parseFloat(String(s || '').replace(/,/g, ''));
  return isNaN(n) ? null : n;
};
const yesNo = (s, def) => {
  const t = String(s || '').trim().toLowerCase();
  if (t === YES || t === 'true' || t === '1' || t === 'yes') return 1;
  if (t === NO || t === 'false' || t === '0' || t === 'no') return 0;
  return def;
};

module.exports = {
  YES, NO,
  createDataSheet,
  buildInstructionsSheet,
  sendWorkbook,
  parseUpload,
  num,
  yesNo,
  Workbook: ExcelJS.Workbook,
};
