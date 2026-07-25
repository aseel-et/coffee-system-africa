const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const ledger = require('../accounting/ledger');

const ROOT_LABELS = { asset: 'الأصول', liability: 'الخصوم', equity: 'حقوق الملكية', income: 'الإيرادات', expense: 'المصروفات' };

// ── GET /api/accounting/chart  → hierarchical chart of accounts (with balances) ──
router.get('/chart', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const accounts = await db.prepare('SELECT * FROM accounts ORDER BY code').all();
    const bal = await db.prepare(`SELECT account_id, SUM(debit) d, SUM(credit) c FROM gl_entries GROUP BY account_id`).all();
    const balMap = {};
    bal.forEach(b => { balMap[b.account_id] = (b.d || 0) - (b.c || 0); });

    const byParent = {};
    accounts.forEach(a => { (byParent[a.parent_id] = byParent[a.parent_id] || []).push(a); });
    const build = (a) => {
      const children = (byParent[a.id] || []).map(build);
      const sign = (a.root_type === 'asset' || a.root_type === 'expense') ? 1 : -1;
      const self = (balMap[a.id] || 0) * sign;
      const childSum = children.reduce((s, c) => s + c.balance, 0);
      return {
        id: a.id, code: a.code, name: a.name, name_ar: a.name_ar, parent_id: a.parent_id,
        root_type: a.root_type, account_type: a.account_type, is_group: !!a.is_group, is_active: !!a.is_active,
        balance: +(a.is_group ? childSum : self).toFixed(2), children,
      };
    };
    const tree = accounts.filter(a => a.parent_id === null).map(build);
    res.json({ success: true, data: tree });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في جلب شجرة الحسابات' });
  }
});

// ── GET /api/accounting/accounts  → flat list (for dropdowns) ──
router.get('/accounts', authenticateToken, requireAdmin, async (req, res) => {
  const ledgerOnly = req.query.ledger_only === 'true';
  let q = 'SELECT id, code, name, name_ar, root_type, is_group FROM accounts';
  if (ledgerOnly) q += ' WHERE is_group = 0';
  q += ' ORDER BY code';
  res.json({ success: true, data: await db.prepare(q).all() });
});

// ── POST /api/accounting/accounts ──
router.post('/accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code, name, name_ar, parent_id, is_group, account_type } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم الحساب مطلوب' });
    if (!parent_id) return res.status(400).json({ success: false, message: 'الحساب الأب مطلوب' });
    const parent = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(parent_id);
    if (!parent) return res.status(400).json({ success: false, message: 'الحساب الأب غير موجود' });
    if (code && await db.prepare('SELECT 1 FROM accounts WHERE code = ?').get(code)) {
      return res.status(409).json({ success: false, message: 'رمز الحساب مستخدم مسبقاً' });
    }
    const info = await db.prepare(`INSERT INTO accounts (code, name, name_ar, parent_id, root_type, account_type, is_group)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(code || null, name, name_ar || name, parent_id, parent.root_type, account_type || null, is_group ? 1 : 0);
    logActivity(req.user.id, req.user.full_name, 'create', 'accounting', `إضافة حساب: ${name}`, 'account', info.lastInsertRowid);
    res.status(201).json({ success: true, data: { id: info.lastInsertRowid }, message: 'تمت إضافة الحساب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إضافة الحساب' });
  }
});

// ── PUT /api/accounting/accounts/:id ──
router.put('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const acc = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!acc) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    const { name, name_ar, code, account_type, is_active } = req.body;
    if (code && code !== acc.code && await db.prepare('SELECT 1 FROM accounts WHERE code = ? AND id <> ?').get(code, id)) {
      return res.status(409).json({ success: false, message: 'رمز الحساب مستخدم مسبقاً' });
    }
    await db.prepare(`UPDATE accounts SET name=?, name_ar=?, code=?, account_type=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name || acc.name, name_ar || acc.name_ar, code !== undefined ? code : acc.code,
           account_type !== undefined ? account_type : acc.account_type,
           is_active !== undefined ? (is_active ? 1 : 0) : acc.is_active, id);
    logActivity(req.user.id, req.user.full_name, 'update', 'accounting', `تعديل حساب: ${name || acc.name}`, 'account', id);
    res.json({ success: true, message: 'تم تحديث الحساب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث الحساب' });
  }
});

// ── DELETE /api/accounting/accounts/:id ──
router.delete('/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const acc = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    if (!acc) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    if (await db.prepare('SELECT 1 FROM accounts WHERE parent_id = ?').get(id)) {
      return res.status(409).json({ success: false, message: 'لا يمكن حذف حساب يحتوي على حسابات فرعية' });
    }
    if (await db.prepare('SELECT 1 FROM gl_entries WHERE account_id = ? LIMIT 1').get(id)) {
      return res.status(409).json({ success: false, message: 'لا يمكن حذف حساب له حركات في دفتر الأستاذ' });
    }
    await db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    logActivity(req.user.id, req.user.full_name, 'delete', 'accounting', `حذف حساب: ${acc.name}`, 'account', id);
    res.json({ success: true, message: 'تم حذف الحساب' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف الحساب' });
  }
});

// ── POST /api/accounting/rebuild  → re-post the whole ledger from operations ──
router.post('/rebuild', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const r = ledger.rebuildLedger();
    logActivity(req.user.id, req.user.full_name, 'update', 'accounting', 'إعادة ترحيل دفتر الأستاذ', 'ledger', null);
    res.json({ success: true, message: 'تم ترحيل القيود بنجاح', data: r });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في ترحيل القيود: ' + err.message });
  }
});

// ── Reports ──
router.get('/trial-balance', authenticateToken, requireAdmin, async (req, res) => {
  try { res.json({ success: true, data: ledger.trialBalance(req.query.from || null, req.query.to || null) }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'خطأ في ميزان المراجعة' }); }
});

router.get('/profit-loss', authenticateToken, requireAdmin, async (req, res) => {
  try { res.json({ success: true, data: ledger.profitLoss(req.query.from || null, req.query.to || null) }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'خطأ في قائمة الدخل' }); }
});

router.get('/balance-sheet', authenticateToken, requireAdmin, async (req, res) => {
  try { res.json({ success: true, data: ledger.balanceSheet(req.query.as_of || null) }); }
  catch (err) { console.error(err); res.status(500).json({ success: false, message: 'خطأ في الميزانية العمومية' }); }
});

router.get('/general-ledger', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.query.account_id) return res.status(400).json({ success: false, message: 'اختر حساباً' });
    const data = ledger.generalLedger(parseInt(req.query.account_id), req.query.from || null, req.query.to || null);
    if (!data) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });
    res.json({ success: true, data });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'خطأ في دفتر الأستاذ' }); }
});

// ── Manual Journal Entry ──
router.post('/journal-entry', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { posting_date, remarks, lines } = req.body;
    if (!posting_date) return res.status(400).json({ success: false, message: 'تاريخ القيد مطلوب' });
    if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ success: false, message: 'القيد يحتاج سطرين على الأقل' });

    let totalDebit = 0, totalCredit = 0;
    for (const l of lines) {
      const d = parseFloat(l.debit) || 0, c = parseFloat(l.credit) || 0;
      if (!l.account_id) return res.status(400).json({ success: false, message: 'كل سطر يجب أن يحتوي على حساب' });
      if (d && c) return res.status(400).json({ success: false, message: 'لا يمكن أن يكون السطر مديناً ودائناً معاً' });
      totalDebit += d; totalCredit += c;
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: `القيد غير متوازن: المدين ${totalDebit.toFixed(2)} ≠ الدائن ${totalCredit.toFixed(2)}` });
    }

    const result = await db.transaction(() => {
      const seq = (await db.prepare('SELECT COUNT(*) c FROM journal_entries').get().c) + 1;
      const entryNo = `JV-${String(seq).padStart(5, '0')}`;
      await db.prepare('INSERT INTO journal_entries (entry_no, posting_date, remarks, total_debit, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(entryNo, posting_date, remarks || null, +totalDebit.toFixed(2), req.user.id);
      const ins = await db.prepare(`INSERT INTO gl_entries (posting_date, account_id, debit, credit, voucher_type, voucher_no, remarks)
        VALUES (?, ?, ?, ?, 'Journal Entry', ?, ?)`);
      for (const l of lines) {
        ins.run(posting_date, l.account_id, +(parseFloat(l.debit) || 0).toFixed(2), +(parseFloat(l.credit) || 0).toFixed(2), entryNo, l.remarks || remarks || null);
      }
      return entryNo;
    })();

    logActivity(req.user.id, req.user.full_name, 'create', 'accounting', `قيد يومية: ${result}`, 'journal', null);
    res.status(201).json({ success: true, message: `تم تسجيل القيد ${result}`, data: { entry_no: result } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تسجيل القيد' });
  }
});

router.get('/journal-entries', authenticateToken, requireAdmin, async (req, res) => {
  const list = await db.prepare('SELECT * FROM journal_entries ORDER BY id DESC LIMIT 100').all();
  res.json({ success: true, data: list });
});

module.exports = router;
