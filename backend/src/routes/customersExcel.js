const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const X = require('../utils/excelHelper');

const SHEET = 'العملاء';
const COLUMNS = [
  { key: 'name',      header: 'اسم العميل',  width: 26, required: true, kind: 'text' },
  { key: 'phone',     header: 'الهاتف',      width: 18, kind: 'text' },
  { key: 'email',     header: 'البريد الإلكتروني', width: 26, kind: 'text' },
  { key: 'address',   header: 'العنوان',     width: 28, kind: 'text' },
  { key: 'balance',   header: 'الرصيد',      width: 16, kind: 'money' },
  { key: 'is_active', header: 'مفعّل',       width: 12, kind: 'yesno' },
];

const INSTRUCTIONS = [
  ['اسم العميل *', 'نص', 'إجباري. اسم العميل كاملاً.'],
  ['الهاتف', 'نص', 'اختياري. يُستخدم كمفتاح للمطابقة عند الاستيراد (تحديث بدل تكرار).'],
  ['البريد الإلكتروني', 'نص', 'اختياري.'],
  ['العنوان', 'نص', 'اختياري.'],
  ['الرصيد', 'رقم/عملة', 'الرصيد بالموجب = له رصيد (دفع مقدماً)، بالسالب = عليه دين. مثال: -50 يعني عليه دين 50.'],
  ['مفعّل', 'قائمة', '«نعم» عميل فعّال، «لا» معطّل دون حذف.'],
];

function rowFor(c) {
  return [c.name, c.phone || '', c.email || '', c.address || '', c.balance ?? 0, c.is_active ? X.YES : X.NO];
}

// ── GET /api/customers/template ──
router.get('/template', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const wb = new X.Workbook();
    wb.creator = 'كافيتيريا جامعة أفريقيا';
    const example = ['د. أحمد منصور', '0910001122', 'ahmed@example.com', 'المدينة', -50, X.YES];
    const ws = X.createDataSheet(wb, { sheetName: SHEET, columns: COLUMNS, rows: [example] });
    ws.getRow(2).eachCell(c => { c.font = { italic: true, color: { argb: 'FF9CA3AF' } }; });
    X.buildInstructionsSheet(wb, 'تعليمات تعبئة ملف العملاء', INSTRUCTIONS);
    await X.sendWorkbook(res, wb, 'قالب_العملاء.xlsx');
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إنشاء القالب' });
  }
});

// ── GET /api/customers/export ──
router.get('/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const customers = await db.prepare('SELECT * FROM customers ORDER BY name').all();
    const wb = new X.Workbook();
    wb.creator = 'كافيتيريا جامعة أفريقيا';
    X.createDataSheet(wb, { sheetName: SHEET, columns: COLUMNS, rows: customers.map(rowFor) });
    X.buildInstructionsSheet(wb, 'تعليمات تعبئة ملف العملاء', INSTRUCTIONS);
    logActivity(req.user.id, req.user.full_name, 'export', 'customers', `تصدير ${customers.length} عميل إلى Excel`, 'customer', null);
    await X.sendWorkbook(res, wb, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تصدير العملاء' });
  }
});

// ── POST /api/customers/import  body: { fileBase64 } ──
router.post('/import', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { rows, error } = await X.parseUpload(req.body.fileBase64, SHEET, COLUMNS);
    if (error) return res.status(400).json({ success: false, message: error });

    const findByPhone = await db.prepare("SELECT id FROM customers WHERE phone = ? AND phone <> '' LIMIT 1");
    const findByName = await db.prepare('SELECT id FROM customers WHERE name = ? LIMIT 1');
    const insert = await db.prepare(`INSERT INTO customers (name, phone, email, address, balance, is_active)
                               VALUES (@name, @phone, @email, @address, @balance, @is_active)`);
    const update = await db.prepare(`UPDATE customers SET name=@name, phone=@phone, email=@email, address=@address,
                               balance=@balance, is_active=@is_active, updated_at=CURRENT_TIMESTAMP WHERE id=@id`);
    const insTx = await db.prepare(`INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, notes, user_id)
                              VALUES (?, 'adjustment', ?, 0, ?, 'رصيد افتتاحي (استيراد Excel)', ?)`);

    const result = { created: 0, updated: 0, skipped: 0, errors: [] };
    const run = await db.transaction(() => {
      for (const row of rows) {
        const name = row.name;
        if (!name) { continue; }
        const phone = row.phone || null;
        const balance = X.num(row.balance) ?? 0;
        const record = {
          name,
          phone,
          email: row.email || null,
          address: row.address || null,
          balance,
          is_active: X.yesNo(row.is_active, 1),
        };
        const existing = (phone && findByPhone.get(phone)) || findByName.get(name);
        if (existing) {
          update.run({ ...record, id: existing.id });
          result.updated++;
        } else {
          const info = insert.run(record);
          if (balance !== 0) insTx.run(info.lastInsertRowid, Math.abs(balance), balance, req.user.id);
          result.created++;
        }
      }
    });
    run();

    logActivity(req.user.id, req.user.full_name, 'import', 'customers',
      `استيراد عملاء من Excel: ${result.created} جديد، ${result.updated} محدّث`, 'customer', null);
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
