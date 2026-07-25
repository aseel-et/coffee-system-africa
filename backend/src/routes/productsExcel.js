const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// ── Column definitions (single source of truth for export + template + import) ──
const TYPE_LABELS = { non_stock: 'مشروب/وجبة', stock_tracked: 'منتج مخزني' };
const TYPE_FROM_LABEL = { 'مشروب/وجبة': 'non_stock', 'منتج مخزني': 'stock_tracked' };
const YES = 'نعم', NO = 'لا';

const COLUMNS = [
  { key: 'name',          header: 'اسم المنتج',        width: 26, required: true,  kind: 'text' },
  { key: 'name_ar',       header: 'الاسم بالعربية',     width: 26, kind: 'text' },
  { key: 'sku',           header: 'الباركود / SKU',     width: 18, kind: 'text' },
  { key: 'category_name', header: 'التصنيف',            width: 22, kind: 'list_category' },
  { key: 'selling_price', header: 'سعر البيع',          width: 14, required: true,  kind: 'money' },
  { key: 'cost_price',    header: 'التكلفة',            width: 14, kind: 'money' },
  { key: 'product_type',  header: 'النوع',              width: 16, kind: 'list_type' },
  { key: 'current_stock', header: 'المخزون الحالي',     width: 16, kind: 'number' },
  { key: 'min_stock_alert', header: 'حد تنبيه النقص',   width: 16, kind: 'number' },
  { key: 'unit',          header: 'الوحدة',             width: 12, kind: 'text' },
  { key: 'show_in_pos',   header: 'يظهر في الكاشير',     width: 16, kind: 'list_yesno' },
  { key: 'is_active',     header: 'مفعّل',              width: 12, kind: 'list_yesno' },
];

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5E34' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };

function getCategories() {
  return await db.prepare('SELECT id, name, name_ar FROM categories WHERE is_active = 1 ORDER BY name').all();
}

// Add a hidden helper sheet holding dropdown lists, return its name.
function addListsSheet(wb, categories) {
  const ws = wb.addWorksheet('lists', { state: 'veryHidden' });
  categories.forEach((c, i) => { ws.getCell(`A${i + 1}`).value = c.name; });
  ws.getCell('B1').value = TYPE_LABELS.non_stock;
  ws.getCell('B2').value = TYPE_LABELS.stock_tracked;
  ws.getCell('C1').value = YES;
  ws.getCell('C2').value = NO;
  return { catRange: `lists!$A$1:$A$${Math.max(categories.length, 1)}`, typeRange: 'lists!$B$1:$B$2', yesnoRange: 'lists!$C$1:$C$2' };
}

function styleHeader(ws) {
  const row = ws.getRow(1);
  COLUMNS.forEach((col, i) => {
    const cell = row.getCell(i + 1);
    cell.value = col.header + (col.required ? ' *' : '');
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF6B4423' } } };
  });
  row.height = 26;
  ws.columns = COLUMNS.map(c => ({ width: c.width }));
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
}

// Apply per-column number formats + dropdown validations to a range of data rows.
function applyColumnRules(ws, ranges, firstRow, lastRow) {
  COLUMNS.forEach((col, idx) => {
    const c = idx + 1;
    for (let r = firstRow; r <= lastRow; r++) {
      const cell = ws.getCell(r, c);
      if (col.kind === 'money') cell.numFmt = '#,##0.00';
      if (col.kind === 'number') cell.numFmt = '#,##0';
      if (col.kind === 'list_category' && ranges) {
        cell.dataValidation = { type: 'list', allowBlank: true, formulae: [ranges.catRange] };
      }
      if (col.kind === 'list_type' && ranges) {
        cell.dataValidation = { type: 'list', allowBlank: true, formulae: [ranges.typeRange] };
      }
      if (col.kind === 'list_yesno' && ranges) {
        cell.dataValidation = { type: 'list', allowBlank: true, formulae: [ranges.yesnoRange] };
      }
    }
  });
}

function rowValuesFor(product) {
  return COLUMNS.map(col => {
    switch (col.key) {
      case 'product_type': return TYPE_LABELS[product.product_type] || TYPE_LABELS.non_stock;
      case 'show_in_pos': return product.show_in_pos ? YES : NO;
      case 'is_active': return product.is_active ? YES : NO;
      default: return product[col.key] ?? '';
    }
  });
}

function buildInstructionsSheet(wb) {
  const ws = wb.addWorksheet('تعليمات');
  ws.views = [{ rightToLeft: true }];
  ws.columns = [{ width: 24 }, { width: 16 }, { width: 60 }];
  ws.addRow(['تعليمات تعبئة ملف المنتجات', '', '']);
  ws.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF8B5E34' } };
  ws.addRow([]);
  const head = ws.addRow(['العمود', 'النوع', 'الشرح']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell(c => { c.fill = HEADER_FILL; c.alignment = { horizontal: 'center' }; });
  const rows = [
    ['اسم المنتج *', 'نص', 'إجباري. اسم الصنف كما يظهر في الكاشير.'],
    ['الاسم بالعربية', 'نص', 'اختياري. إن تُرك فارغاً يُستخدم اسم المنتج.'],
    ['الباركود / SKU', 'نص', 'اختياري. يُستخدم كمفتاح للمطابقة عند الاستيراد (تحديث بدل تكرار).'],
    ['التصنيف', 'قائمة', 'اختر من القائمة المنسدلة. يجب أن يكون تصنيفاً موجوداً مسبقاً.'],
    ['سعر البيع *', 'رقم/عملة', 'إجباري. رقم موجب (مثال: 5.50).'],
    ['التكلفة', 'رقم/عملة', 'اختياري. سعر تكلفة الصنف.'],
    ['النوع', 'قائمة', '«مشروب/وجبة» = لا يُتتبع مخزونه، «منتج مخزني» = يُخصم من المخزون.'],
    ['المخزون الحالي', 'رقم', 'يُستخدم فقط مع «منتج مخزني». الكمية الافتتاحية.'],
    ['حد تنبيه النقص', 'رقم', 'يُستخدم فقط مع «منتج مخزني». تنبيه عند الوصول لهذه الكمية.'],
    ['الوحدة', 'نص', 'مثال: قطعة، زجاجة، علبة، كيس.'],
    ['يظهر في الكاشير', 'قائمة', '«نعم» لإظهاره في شاشة البيع، «لا» لإخفائه.'],
    ['مفعّل', 'قائمة', '«نعم» منتج فعّال، «لا» معطّل دون حذف.'],
  ];
  rows.forEach(r => { const row = ws.addRow(r); row.getCell(3).alignment = { wrapText: true }; });
  ws.addRow([]);
  ws.addRow(['ملاحظة:', '', 'الأعمدة المعلّمة بـ * إجبارية. لا تحذف صف العناوين أو تغيّر ترتيب الأعمدة.']);
  return ws;
}

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

// ── GET /api/products/template  (empty file with headers, dropdowns, example) ──
router.get('/template', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'كافيتيريا جامعة أفريقيا';
    const ws = wb.addWorksheet('المنتجات');
    const categories = getCategories();
    const ranges = addListsSheet(wb, categories);
    styleHeader(ws);

    // Example row (greyed) to guide the user
    const example = ['لاتيه حار', 'كافيه لاتيه', 'CAF-001', categories[0]?.name || 'مشروبات ساخنة',
                     5, 2, TYPE_LABELS.non_stock, '', '', 'قطعة', YES, YES];
    const exRow = ws.addRow(example);
    exRow.eachCell(c => { c.font = { italic: true, color: { argb: 'FF9CA3AF' } }; });

    // Validations/formats for a generous number of blank rows
    applyColumnRules(ws, ranges, 2, 300);
    buildInstructionsSheet(wb);

    await sendWorkbook(res, wb, 'products_template.xlsx');
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إنشاء القالب' });
  }
});

// ── GET /api/products/export  (all current products) ──
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const products = await db.prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY c.name, p.name
    `).all();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'كافيتيريا جامعة أفريقيا';
    const ws = wb.addWorksheet('المنتجات');
    const ranges = addListsSheet(wb, getCategories());
    styleHeader(ws);

    products.forEach(p => ws.addRow(rowValuesFor(p)));
    applyColumnRules(ws, ranges, 2, products.length + 1);
    buildInstructionsSheet(wb);

    logActivity(req.user.id, req.user.full_name, 'export', 'products', `تصدير ${products.length} منتج إلى Excel`, 'product', null);
    const date = new Date().toISOString().split('T')[0];
    await sendWorkbook(res, wb, `products_${date}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تصدير المنتجات' });
  }
});

// ── POST /api/products/import  body: { fileBase64 }  ──
router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { fileBase64 } = req.body;
    if (!fileBase64) return res.status(400).json({ success: false, message: 'لم يتم إرسال ملف' });
    if (fileBase64.includes(',')) fileBase64 = fileBase64.split(',').pop(); // strip data URL prefix
    const buffer = Buffer.from(fileBase64, 'base64');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet('المنتجات') || wb.worksheets[0];
    if (!ws) return res.status(400).json({ success: false, message: 'الملف لا يحتوي على بيانات' });

    // Map columns by header text (so reordering still works)
    const headerRow = ws.getRow(1);
    const colIndex = {};
    headerRow.eachCell((cell, c) => {
      const txt = String(cell.value || '').replace('*', '').trim();
      const col = COLUMNS.find(k => k.header === txt || k.header.replace(' *', '') === txt);
      if (col) colIndex[col.key] = c;
    });
    if (colIndex.name === undefined) {
      return res.status(400).json({ success: false, message: 'تعذّر التعرف على الأعمدة. استخدم القالب الصحيح.' });
    }

    // Lookup maps
    const categories = await db.prepare('SELECT id, name, name_ar FROM categories').all();
    const catMap = new Map();
    categories.forEach(c => { catMap.set((c.name || '').trim(), c.id); if (c.name_ar) catMap.set((c.name_ar || '').trim(), c.id); });
    const findBySku = await db.prepare('SELECT id, product_type FROM products WHERE sku = ? LIMIT 1');
    const findByName = await db.prepare('SELECT id, product_type FROM products WHERE name = ? LIMIT 1');

    const cellStr = (row, key) => {
      if (colIndex[key] === undefined) return '';
      let v = row.getCell(colIndex[key]).value;
      if (v && typeof v === 'object') v = v.text || v.result || v.richText?.map(t => t.text).join('') || '';
      return String(v ?? '').trim();
    };
    const cellNum = (row, key) => {
      const s = cellStr(row, key).replace(/,/g, '');
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };
    const parseYesNo = (s, def) => {
      const t = (s || '').trim();
      if (t === YES || t === 'true' || t === '1' || t.toLowerCase() === 'yes') return 1;
      if (t === NO || t === 'false' || t === '0' || t.toLowerCase() === 'no') return 0;
      return def;
    };

    const insert = await db.prepare(`
      INSERT INTO products (name, name_ar, sku, category_id, selling_price, cost_price, product_type,
        is_active, show_in_pos, current_stock, min_stock_alert, unit)
      VALUES (@name, @name_ar, @sku, @category_id, @selling_price, @cost_price, @product_type,
        @is_active, @show_in_pos, @current_stock, @min_stock_alert, @unit)
    `);
    const update = await db.prepare(`
      UPDATE products SET name=@name, name_ar=@name_ar, sku=@sku, category_id=@category_id,
        selling_price=@selling_price, cost_price=@cost_price, product_type=@product_type,
        is_active=@is_active, show_in_pos=@show_in_pos, min_stock_alert=@min_stock_alert,
        unit=@unit, updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `);

    const result = { created: 0, updated: 0, skipped: 0, errors: [] };

    const runImport = await db.transaction(() => {
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // header
        const name = cellStr(row, 'name');
        // skip blank or example/instruction rows
        if (!name) { return; }

        const sellingRaw = cellNum(row, 'selling_price');
        if (sellingRaw === null || sellingRaw < 0) {
          result.errors.push({ row: rowNumber, message: `«${name}»: سعر البيع غير صحيح` });
          result.skipped++;
          return;
        }

        const typeLabel = cellStr(row, 'product_type');
        const product_type = TYPE_FROM_LABEL[typeLabel] || (typeLabel === 'stock_tracked' ? 'stock_tracked' : 'non_stock');

        const catName = cellStr(row, 'category_name');
        let category_id = null;
        if (catName) {
          if (catMap.has(catName)) category_id = catMap.get(catName);
          else { result.errors.push({ row: rowNumber, message: `«${name}»: التصنيف «${catName}» غير موجود` }); }
        }

        const sku = cellStr(row, 'sku') || null;
        const record = {
          name,
          name_ar: cellStr(row, 'name_ar') || name,
          sku,
          category_id,
          selling_price: sellingRaw,
          cost_price: cellNum(row, 'cost_price') ?? 0,
          product_type,
          is_active: parseYesNo(cellStr(row, 'is_active'), 1),
          show_in_pos: parseYesNo(cellStr(row, 'show_in_pos'), 1),
          current_stock: product_type === 'stock_tracked' ? (cellNum(row, 'current_stock') ?? 0) : 0,
          min_stock_alert: product_type === 'stock_tracked' ? (cellNum(row, 'min_stock_alert') ?? 0) : 0,
          unit: cellStr(row, 'unit') || 'piece',
        };

        // Match existing by SKU first, then by exact name → update; else insert
        const existing = (sku && findBySku.get(sku)) || findByName.get(name);
        if (existing) {
          update.run({ ...record, id: existing.id });
          result.updated++;
        } else {
          const info = insert.run(record);
          if (record.product_type === 'stock_tracked' && record.current_stock > 0) {
            await db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, user_id)
                        VALUES (?, 'adjustment_in', ?, 0, ?, 'استيراد من Excel', ?)`)
              .run(info.lastInsertRowid, record.current_stock, record.current_stock, req.user.id);
          }
          result.created++;
        }
      });
    });
    runImport();

    logActivity(req.user.id, req.user.full_name, 'import', 'products',
      `استيراد منتجات من Excel: ${result.created} جديد، ${result.updated} محدّث`, 'product', null);

    res.json({
      success: true,
      message: `تم الاستيراد: ${result.created} جديد، ${result.updated} محدّث${result.skipped ? `، ${result.skipped} متخطّى` : ''}`,
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في استيراد الملف. تأكد أنه ملف Excel صحيح.' });
  }
});

module.exports = router;
