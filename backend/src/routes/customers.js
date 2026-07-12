const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/customers - List all customers
router.get('/', authenticateToken, (req, res) => {
  try {
    const { search = '', is_active } = req.query;
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' ORDER BY name ASC';
    const customers = db.prepare(query).all(...params);
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات العملاء' });
  }
});

// GET /api/customers/:id - Customer details and transactions
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'العميل غير موجود' });

    const transactions = db.prepare(`
      SELECT ct.*, u.full_name as user_name
      FROM customer_transactions ct
      LEFT JOIN users u ON u.id = ct.user_id
      WHERE ct.customer_id = ?
      ORDER BY ct.created_at DESC
      LIMIT 100
    `).all(customerId);

    res.json({ success: true, data: { ...customer, transactions } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب تفاصيل العميل' });
  }
});

// POST /api/customers - Create new customer
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, phone, email, address, balance = 0 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم العميل مطلوب' });

    const result = db.prepare(`
      INSERT INTO customers (name, phone, email, address, balance)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, phone || null, email || null, address || null, parseFloat(balance) || 0);

    const customerId = result.lastInsertRowid;
    
    if (balance != 0) {
      db.prepare(`
        INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, notes, user_id)
        VALUES (?, 'adjustment', ?, 0, ?, 'رصيد افتتاحي', ?)
      `).run(customerId, balance, balance, req.user.id);
    }

    logActivity(req.user.id, req.user.full_name, 'create', 'customers', `إضافة عميل جديد: ${name}`, 'customer', customerId);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.status(201).json({ success: true, data: customer, message: 'تم إضافة العميل بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إضافة العميل' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const { name, phone, email, address, is_active } = req.body;
    
    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = ?, email = ?, address = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, email, address, is_active === undefined ? 1 : (is_active ? 1 : 0), customerId);

    logActivity(req.user.id, req.user.full_name, 'update', 'customers', `تعديل بيانات العميل: ${name}`, 'customer', customerId);
    
    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.json({ success: true, data: updated, message: 'تم تحديث العميل بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث بيانات العميل' });
  }
});

// POST /api/customers/:id/payment - Record payment or adjustment
router.post('/:id/transactions', authenticateToken, requireAdmin, (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const { type, amount, notes } = req.body; // type: payment (increase balance/pay debt), debt (decrease balance), adjustment
    
    if (!amount || amount === 0) return res.status(400).json({ success: false, message: 'المبلغ مطلوب' });

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'العميل غير موجود' });

    const before = customer.balance;
    let after = before;
    
    if (type === 'payment') after += parseFloat(amount);
    else if (type === 'debt') after -= parseFloat(amount);
    else if (type === 'adjustment') after = parseFloat(amount); // Overwrite if adjustment? Or maybe relative? Let's say relative for consistency.
    else return res.status(400).json({ success: false, message: 'نوع المعاملة غير صالح' });

    const updateCustomerBalance = db.transaction(() => {
      db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(after, customerId);
      db.prepare(`
        INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, type, amount, before, after, notes || null, req.user.id);
    });

    updateCustomerBalance();
    logActivity(req.user.id, req.user.full_name, 'adjustment', 'customers', `${type === 'payment' ? 'سداد' : 'تعديل رصيد'} للعميل: ${customer.name} - المبلغ: ${amount}`, 'customer', customerId);

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.json({ success: true, data: updated, message: 'تم تسجيل المعاملة بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تسجيل المعاملة المالية' });
  }
});

// DELETE /api/customers/:id - Delete customer (admin only, balance must be 0)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    
    if (!customer) return res.status(404).json({ success: false, message: 'العميل غير موجود' });
    
    // Check if balance is zero
    if (Math.abs(customer.balance) > 0.001) {
      return res.status(400).json({ 
        success: false, 
        message: `لا يمكن حذف العميل لأن لديه رصيد غير مصفر (${customer.balance.toFixed(2)} د.ل)` 
      });
    }

    db.transaction(() => {
      // Clear link from sales instead of deleting sales
      db.prepare('UPDATE sales SET customer_id = NULL WHERE customer_id = ?').run(customerId);
      // Delete transactions
      db.prepare('DELETE FROM customer_transactions WHERE customer_id = ?').run(customerId);
      // Delete customer
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    })();

    logActivity(req.user.id, req.user.full_name, 'delete', 'customers', `حذف العميل: ${customer.name}`, 'customer', customerId);
    res.json({ success: true, message: 'تم حذف العميل بنجاح' });
  } catch (err) {
    console.error('Customer delete error:', err);
    res.status(500).json({ success: false, message: 'خطأ في حذف العميل' });
  }
});

module.exports = router;
