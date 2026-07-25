const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const X = require('../utils/excelHelper');

const SHEET = 'المخزون';
// Inventory works on existing stock-tracked products only. Import updates the
// physical count (creating an adjustment movement for the difference) and the
// low-stock alert. Name/SKU/category are for identification (not created here).
const COLUMNS = [
  { key: 'name',          header: 'المنتج',          width: 26, required: true, kind: 'text' },
  { key: 'sku',           header: 'الباركود / SKU',  width: 18, kind: 'text' },
  { key: 'category_name', header: 'التصنيف',         width: 20, kind: 'text' },
  { key: 'unit',          header: 'الوحدة',          width: 12, kind: 'text' },
  { key: 'current_stock', header: 'الكمية الفعلية',   width: 16, required: true, kind: 'number' },
  { key: 'min_stock_alert', header: 'حد تنبيه النقص', width: 16, kind: 'number' },
];

const INSTRUCTIONS = [
  ['المنتج *', 'نص', 'اسم المنتج المخزني (يجب أن يكون موجوداً مسبقاً، لا يُنشأ من هنا).'],
  ['الباركود / SKU', 'نص', 'يُستخدم للمطابقة الدقيقة إن وُجد، ثم يُطابَق بالاسم.'],
  ['التصنيف', 'نص', 'للعرض فقط.'],
  ['الوحدة', 'نص', 'للعرض فقط.'],
  ['الكمية الفعلية *', 'رقم', 'الجرد الفعلي الحالي. سيُنشئ النظام حركة تسوية تلقائياً للفرق بين القديم والجديد.'],
  ['حد تنبيه النقص', 'رقم', 'تنبيه نفاد المخزون عند الوصول لهذه الكمية.'],
];

function stockRows() {
  return await db.prepare(`
    SELECT p.name, p.sku, p.unit, p.current_stock, p.min_stock_alert, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.product_type = 'stock_tracked'
    ORDER BY c.name, p.name
  `).all().map(p => [p.name, p.sku || '', p.category_name || '', p.unit || '', p.current_stock ?? 0, p.min_stock_alert ?? 0]);
}

// ── GET /api/inventory/template  (current stock, ready to be counted & edited) ──
router.get('/template', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const wb = new X.Workbook();
    wb.creator = 'كافيتيريا جامعة أفريقيا';
    X.createDataSheet(wb, { sheetName: SHEET, columns: COLUMNS, rows: stockRows(), blankRows: 0 });
    X.buildInstructionsSheet(wb, 'تعليمات جرد وتحديث المخزون', INSTRUCTIONS);
    await X.sendWorkbook(res, wb, 'قالب_جرد_المخزون.xlsx');
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إنشاء القالب' });
  }
});

// ── GET /api/inventory/export ──
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = stockRows();
    const wb = new X.Workbook();
    wb.creator = 'كافيتيريا جامعة أفريقيا';
    X.createDataSheet(wb, { sheetName: SHEET, columns: COLUMNS, rows, blankRows: 0 });
    X.buildInstructionsSheet(wb, 'تعليمات جرد وتحديث المخزون', INSTRUCTIONS);
    logActivity(req.user.id, req.user.full_name, 'export', 'inventory', `تصدير ${rows.length} صنف مخزني إلى Excel`, 'product', null);
    await X.sendWorkbook(res, wb, `inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تصدير المخزون' });
  }
});

// ── POST /api/inventory/import  body: { fileBase64 } ──
router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows, error } = await X.parseUpload(req.body.fileBase64, SHEET, COLUMNS);
    if (error) return res.status(400).json({ success: false, message: error });

    const findBySku = await db.prepare("SELECT * FROM products WHERE sku = ? AND sku <> '' AND product_type='stock_tracked' LIMIT 1");
    const findByName = await db.prepare("SELECT * FROM products WHERE name = ? AND product_type='stock_tracked' LIMIT 1");
    const setStock = await db.prepare('UPDATE products SET current_stock=?, min_stock_alert=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
    const insMove = await db.prepare(`INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, user_id)
                                VALUES (?, ?, ?, ?, ?, 'تسوية جرد (استيراد Excel)', ?)`);

    const result = { updated: 0, adjusted: 0, skipped: 0, errors: [] };
    const run = await db.transaction(() => {
      for (const row of rows) {
        const name = row.name;
        if (!name) continue;
        const product = (row.sku && findBySku.get(row.sku)) || findByName.get(name);
        if (!product) {
          result.errors.push({ row: row.__rowNumber, message: `«${name}»: غير موجود كمنتج مخزني` });
          result.skipped++;
          continue;
        }
        const newCountRaw = X.num(row.current_stock);
        const newAlertRaw = X.num(row.min_stock_alert);
        const newCount = newCountRaw === null ? product.current_stock : newCountRaw;
        const newAlert = newAlertRaw === null ? product.min_stock_alert : newAlertRaw;
        if (newCount < 0) {
          result.errors.push({ row: row.__rowNumber, message: `«${name}»: كمية غير صحيحة` });
          result.skipped++;
          continue;
        }

        const before = product.current_stock;
        const diff = +(newCount - before).toFixed(3);
        setStock.run(newCount, newAlert, product.id);
        if (diff !== 0) {
          insMove.run(product.id, diff > 0 ? 'adjustment_in' : 'adjustment_out', Math.abs(diff), before, newCount, req.user.id);
          result.adjusted++;
        }
        result.updated++;
      }
    });
    run();

    logActivity(req.user.id, req.user.full_name, 'import', 'inventory',
      `تحديث مخزون من Excel: ${result.updated} صنف، ${result.adjusted} تسوية`, 'product', null);
    res.json({
      success: true,
      message: `تم التحديث: ${result.updated} صنف، ${result.adjusted} تسوية مخزون${result.skipped ? `، ${result.skipped} متخطّى` : ''}`,
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في استيراد الملف. تأكد أنه ملف Excel صحيح.' });
  }
});

module.exports = router;
