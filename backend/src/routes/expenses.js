const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/expenses
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { from_date, to_date, expense_category_id, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT e.*, ec.name as category_name, ec.color as category_color, u.full_name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE 1=1
    `;
    const params = [];
    
    if (from_date) { query += ' AND e.expense_date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND e.expense_date <= ?'; params.push(to_date); }
    if (expense_category_id) { query += ' AND e.expense_category_id = ?'; params.push(expense_category_id); }
    
    const countResult = await db.prepare(query.replace('SELECT e.*, ec.name as category_name, ec.color as category_color, u.full_name as created_by_name', 'SELECT COUNT(*) as total')).get(...params);
    query += ' ORDER BY e.expense_date DESC, e.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const expenses = await db.prepare(query).all(...params);
    res.json({ success: true, data: expenses, total: countResult.total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المصاريف' });
  }
});

// GET /api/expenses/categories
router.get('/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const categories = await db.prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name').all();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب تصنيفات المصاريف' });
  }
});

// POST /api/expenses/categories
router.post('/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'اسم البند مطلوب' });
    const existing = await db.prepare('SELECT id FROM expense_categories WHERE name = ?').get(name.trim());
    if (existing) return res.status(409).json({ success: false, message: 'هذا البند موجود بالفعل' });
    const result = await db.prepare('INSERT INTO expense_categories (name, color) VALUES (?, ?)').run(name.trim(), color || '#6B7280');
    const cat = await db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: cat, message: 'تم إضافة البند بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إضافة البند' });
  }
});

// PUT /api/expenses/categories/:id
router.put('/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, color } = req.body;
    const cat = await db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id);
    if (!cat) return res.status(404).json({ success: false, message: 'البند غير موجود' });
    db.prepare('UPDATE expense_categories SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name || cat.name, color || cat.color, id);
    const updated = await db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id);
    res.json({ success: true, data: updated, message: 'تم تحديث البند بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث البند' });
  }
});

// DELETE /api/expenses/categories/:id
router.delete('/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cat = await db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(id);
    if (!cat) return res.status(404).json({ success: false, message: 'البند غير موجود' });
    // Unlink expenses from this category instead of deleting data
    await db.prepare('UPDATE expenses SET expense_category_id = NULL WHERE expense_category_id = ?').run(id);
    await db.prepare('DELETE FROM expense_categories WHERE id = ?').run(id);
    res.json({ success: true, message: 'تم حذف البند وإلغاء ربط المصاريف المرتبطة' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف البند' });
  }
});

// POST /api/expenses
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { expense_category_id, amount, description, expense_date, payment_method, notes } = req.body;
    if (!amount || !description || !expense_date) {
      return res.status(400).json({ success: false, message: 'المبلغ والوصف والتاريخ مطلوبة' });
    }
    
    const result = await db.prepare(`
      INSERT INTO expenses (expense_category_id, amount, description, expense_date, payment_method, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(expense_category_id || null, parseFloat(amount), description, expense_date, payment_method || 'cash', notes || null, req.user.id);

    logActivity(req.user.id, req.user.full_name, 'create', 'expenses', `إضافة مصروف: ${description} - ${amount}`, 'expense', result.lastInsertRowid);

    const expense = await db.prepare('SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id WHERE e.id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: expense, message: 'تم تسجيل المصروف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تسجيل المصروف' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(expId);
    if (!expense) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    
    const { expense_category_id, amount, description, expense_date, payment_method, notes } = req.body;
    await db.prepare(`
      UPDATE expenses SET expense_category_id=?, amount=?, description=?, expense_date=?, payment_method=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      expense_category_id ?? expense.expense_category_id,
      parseFloat(amount) ?? expense.amount,
      description || expense.description,
      expense_date || expense.expense_date,
      payment_method || expense.payment_method,
      notes ?? expense.notes,
      expId
    );

    logActivity(req.user.id, req.user.full_name, 'update', 'expenses', `تعديل مصروف: ${description || expense.description}`, 'expense', expId);
    
    const updated = await db.prepare('SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id WHERE e.id = ?').get(expId);
    res.json({ success: true, data: updated, message: 'تم تحديث المصروف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث المصروف' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const expId = parseInt(req.params.id);
    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(expId);
    if (!expense) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    
    await db.prepare('DELETE FROM expenses WHERE id = ?').run(expId);
    logActivity(req.user.id, req.user.full_name, 'delete', 'expenses', `حذف مصروف: ${expense.description}`, 'expense', expId);
    res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف المصروف' });
  }
});

module.exports = router;
