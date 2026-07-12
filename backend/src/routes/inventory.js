const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/inventory - Stock levels
router.get('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { search, status } = req.query;
    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.product_type = 'stock_tracked'
    `;
    const params = [];
    
    if (search) { query += ' AND (p.name LIKE ? OR p.name_ar LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (status === 'low') query += ' AND p.current_stock > 0 AND p.current_stock <= p.min_stock_alert';
    else if (status === 'out') query += ' AND p.current_stock <= 0';
    else if (status === 'ok') query += ' AND p.current_stock > p.min_stock_alert';
    
    query += ' ORDER BY p.current_stock ASC, p.name ASC';
    const products = db.prepare(query).all(...params);
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات المخزون' });
  }
});

// POST /api/inventory/adjust - Manual stock adjustment
router.post('/adjust', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { product_id, adjustment_type, quantity, reason } = req.body;
    
    if (!product_id || !adjustment_type || !quantity || !reason) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND product_type = ?').get(product_id, 'stock_tracked');
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود أو ليس مخزونًا' });

    const qty = parseFloat(quantity);
    if (qty <= 0) return res.status(400).json({ success: false, message: 'الكمية يجب أن تكون أكبر من صفر' });

    const before = product.current_stock;
    let after;
    let movementType;

    if (adjustment_type === 'add') {
      after = before + qty;
      movementType = 'adjustment_in';
    } else if (adjustment_type === 'subtract') {
      if (before < qty) return res.status(400).json({ success: false, message: 'الكمية المطلوبة أكبر من المخزون الحالي' });
      after = before - qty;
      movementType = 'adjustment_out';
    } else {
      return res.status(400).json({ success: false, message: 'نوع التعديل غير صالح' });
    }

    db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(after, product_id);
    db.prepare(`
      INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, user_id)
      VALUES (?, ?, ?, ?, ?, ?, 'manual_adjustment', ?)
    `).run(product_id, movementType, qty, before, after, reason, req.user.id);

    logActivity(req.user.id, req.user.full_name, 'stock_adjust', 'inventory', 
      `تعديل مخزون "${product.name}": ${adjustment_type === 'add' ? '+' : '-'}${qty} (${before} → ${after}). السبب: ${reason}`);

    res.json({ success: true, message: 'تم تعديل المخزون بنجاح', data: { before, after, product_id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تعديل المخزون' });
  }
});

// GET /api/inventory/movements - Stock movement history
router.get('/movements', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { product_id, movement_type, from_date, to_date, limit = 100, offset = 0 } = req.query;
    let query = `
      SELECT sm.*, p.name as product_name, p.unit, u.full_name as user_name
      FROM stock_movements sm
      LEFT JOIN products p ON p.id = sm.product_id
      LEFT JOIN users u ON u.id = sm.user_id
      WHERE 1=1
    `;
    const params = [];
    
    if (product_id) { query += ' AND sm.product_id = ?'; params.push(product_id); }
    if (movement_type) { query += ' AND sm.movement_type = ?'; params.push(movement_type); }
    if (from_date) { query += ' AND DATE(sm.created_at) >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND DATE(sm.created_at) <= ?'; params.push(to_date); }
    
    const countParams = [...params];
    const countResult = db.prepare(query.replace('SELECT sm.*, p.name as product_name, p.unit, u.full_name as user_name', 'SELECT COUNT(*) as total')).get(...countParams);
    
    query += ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const movements = db.prepare(query).all(...params);
    res.json({ success: true, data: movements, total: countResult.total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب حركات المخزون' });
  }
});

// GET /api/inventory/alerts - Low/out of stock alerts
router.get('/alerts', authenticateToken, (req, res) => {
  try {
    const lowStock = db.prepare(`
      SELECT p.id, p.name, p.current_stock, p.min_stock_alert, p.unit, c.name as category_name
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.product_type = 'stock_tracked' AND p.is_active = 1
        AND p.current_stock > 0 AND p.current_stock <= p.min_stock_alert
      ORDER BY p.current_stock ASC
    `).all();
    
    const outOfStock = db.prepare(`
      SELECT p.id, p.name, p.current_stock, p.min_stock_alert, p.unit, c.name as category_name
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.product_type = 'stock_tracked' AND p.is_active = 1 AND p.current_stock <= 0
      ORDER BY p.name ASC
    `).all();
    
    res.json({ success: true, data: { lowStock, outOfStock } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب تنبيهات المخزون' });
  }
});

module.exports = router;
