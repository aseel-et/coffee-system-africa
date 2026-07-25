const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    res.json({ success: true, data: settingsObj });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الإعدادات' });
  }
});

// PUT /api/settings - Update settings (admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = req.body;
    const upsert = await db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    const updateMany = await db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        upsert.run(key, String(value));
      }
    });
    updateMany(settings);
    res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (err) {
    console.error('SETTINGS ERROR:', err);
    if (err.message.includes('no such column')) {
      try {
        await db.prepare('ALTER TABLE settings ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
        return res.status(500).json({ success: false, message: 'تم إصلاح قاعدة البيانات، يرجى حفظ الإعدادات مرة أخرى.' });
      } catch (e) {}
    }
    res.status(500).json({ success: false, message: 'خطأ في حفظ الإعدادات: ' + err.message });
  }
});

// POST /api/settings/factory-reset - Wipe all transaction data (admin only)
router.post('/factory-reset', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { pin } = req.body;
    if (pin !== '1234') {
      return res.status(403).json({ success: false, message: 'رمز التأكيد غير صحيح' });
    }

    const FACTORY_RESET_TABLES = [
      'sale_items',
      'sales',
      'stock_movements',
      'customer_transactions',
      'purchase_items',
      'purchases',
      'expenses',
      'shifts',
      'activity_logs',
      'products',
      'categories',
    ];

    await db.transaction(() => {
      for (const table of FACTORY_RESET_TABLES) {
        try {
          await db.prepare(`DELETE FROM ${table}`).run();
          // Reset auto-increment counter
          await db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
        } catch (e) {
          console.warn(`Warning: could not clear table ${table}:`, e.message);
        }
      }

      // Reset product stock to 0
      await db.prepare(`UPDATE products SET current_stock = 0`).run();
      // Reset customer balances to 0
      await db.prepare(`UPDATE customers SET balance = 0`).run();
    })();

    console.log('🏭 Factory Reset performed by:', req.user.full_name);
    res.json({ success: true, message: 'تم إعادة ضبط النظام للمصنع بنجاح. تم مسح جميع البيانات التشغيلية.' });
  } catch (err) {
    console.error('Factory reset error:', err);
    res.status(500).json({ success: false, message: 'خطأ في إعادة الضبط: ' + err.message });
  }
});

// GET /api/settings/shifts - Shift management
router.get('/shifts/current', authenticateToken, async (req, res) => {
  try {
    const shift = await db.prepare(`
      SELECT sh.*, u.full_name as cashier_name
      FROM shifts sh JOIN users u ON u.id = sh.cashier_id
      WHERE sh.cashier_id = ? AND sh.status = 'open'
      ORDER BY sh.opened_at DESC LIMIT 1
    `).get(req.user.id);
    res.json({ success: true, data: shift || null });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الوردية' });
  }
});

router.post('/shifts/open', authenticateToken, async (req, res) => {
  try {
    const { opening_cash } = req.body;
    const existingShift = await db.prepare("SELECT id FROM shifts WHERE cashier_id = ? AND status = 'open'").get(req.user.id);
    if (existingShift) return res.status(400).json({ success: false, message: 'يوجد وردية مفتوحة بالفعل' });
    
    const result = await db.prepare('INSERT INTO shifts (cashier_id, opening_cash) VALUES (?, ?)').run(req.user.id, parseFloat(opening_cash) || 0);
    const shift = await db.prepare('SELECT * FROM shifts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: shift, message: 'تم فتح الوردية بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في فتح الوردية' });
  }
});

router.post('/shifts/:id/close', authenticateToken, async (req, res) => {
  try {
    const shiftId = parseInt(req.params.id);
    const { closing_cash, notes } = req.body;
    const shift = await db.prepare('SELECT * FROM shifts WHERE id = ? AND cashier_id = ?').get(shiftId, req.user.id);
    if (!shift) return res.status(404).json({ success: false, message: 'الوردية غير موجودة' });
    
    // Calculate shift totals
    const shiftSales = await db.prepare(`
      SELECT COUNT(*) as orders, COALESCE(SUM(total), 0) as sales
      FROM sales WHERE cashier_id = ? AND status = 'completed' AND created_at >= ?
    `).get(req.user.id, shift.opened_at);
    
    const expectedCash = shift.opening_cash + shiftSales.sales;
    const cashDiff = (parseFloat(closing_cash) || 0) - expectedCash;
    
    await db.prepare(`
      UPDATE shifts SET closing_cash = ?, expected_cash = ?, cash_difference = ?,
        total_sales = ?, total_orders = ?, notes = ?, status = 'closed', closed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(parseFloat(closing_cash) || 0, expectedCash, cashDiff, shiftSales.sales, shiftSales.orders, notes || null, shiftId);
    
    const updated = await db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
    res.json({ success: true, data: updated, message: 'تم إغلاق الوردية بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إغلاق الوردية' });
  }
});

module.exports = router;
