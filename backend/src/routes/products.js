const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/products
router.get('/', authenticateToken, (req, res) => {
  try {
    const { category_id, product_type, is_active, show_in_pos, search, low_stock } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
    `;
    const conditions = [];
    const params = [];
    
    if (category_id) { conditions.push('p.category_id = ?'); params.push(category_id); }
    if (product_type) { conditions.push('p.product_type = ?'); params.push(product_type); }
    if (is_active !== undefined && is_active !== '') { conditions.push('p.is_active = ?'); params.push(is_active === 'true' ? 1 : 0); }
    if (show_in_pos !== undefined && show_in_pos !== '') { conditions.push('p.show_in_pos = ?'); params.push(show_in_pos === 'true' ? 1 : 0); }
    if (search) { conditions.push('(p.name LIKE ? OR p.name_ar LIKE ? OR p.sku LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (low_stock === 'true') { conditions.push("p.product_type = 'stock_tracked' AND p.current_stock <= p.min_stock_alert"); }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY p.name ASC';
    
    const products = db.prepare(query).all(...params);
    res.json({ success: true, data: products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في جلب المنتجات' });
  }
});

// GET /api/products/:id
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المنتج' });
  }
});

// POST /api/products
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, name_ar, sku, category_id, selling_price, cost_price, product_type,
            is_active, show_in_pos, current_stock, min_stock_alert, unit, image_url } = req.body;

    if (!name || selling_price === undefined) {
      return res.status(400).json({ success: false, message: 'اسم المنتج والسعر مطلوبان' });
    }

    const result = db.prepare(`
      INSERT INTO products (name, name_ar, sku, category_id, selling_price, cost_price, product_type,
        is_active, show_in_pos, current_stock, min_stock_alert, unit, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, name_ar || name, sku || null, category_id || null,
      parseFloat(selling_price) || 0, parseFloat(cost_price) || 0,
      product_type || 'non_stock',
      is_active !== false ? 1 : 0,
      show_in_pos !== false ? 1 : 0,
      product_type === 'stock_tracked' ? (parseFloat(current_stock) || 0) : 0,
      product_type === 'stock_tracked' ? (parseFloat(min_stock_alert) || 0) : 0,
      unit || 'piece',
      image_url || null
    );

    // If stock_tracked with initial stock, create stock movement
    if (product_type === 'stock_tracked' && parseFloat(current_stock) > 0) {
      db.prepare(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, user_id)
        VALUES (?, 'adjustment_in', ?, 0, ?, 'رصيد افتتاحي', ?)
      `).run(result.lastInsertRowid, parseFloat(current_stock), parseFloat(current_stock), req.user.id);
    }

    logActivity(req.user.id, req.user.full_name, 'create', 'products', `إضافة منتج: ${name}`, 'product', result.lastInsertRowid);
    
    const product = db.prepare(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: product, message: 'تم إضافة المنتج بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إضافة المنتج' });
  }
});

// PUT /api/products/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });

    const { name, name_ar, sku, category_id, selling_price, cost_price, product_type,
            is_active, show_in_pos, min_stock_alert, unit, image_url } = req.body;

    db.prepare(`
      UPDATE products SET name=?, name_ar=?, sku=?, category_id=?, selling_price=?, cost_price=?,
        product_type=?, is_active=?, show_in_pos=?, min_stock_alert=?, unit=?, image_url=?, updated_at=CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || product.name, name_ar || product.name_ar, sku !== undefined ? sku : product.sku,
      category_id !== undefined ? category_id : product.category_id,
      parseFloat(selling_price) ?? product.selling_price,
      parseFloat(cost_price) ?? product.cost_price,
      product_type || product.product_type,
      is_active !== undefined ? (is_active ? 1 : 0) : product.is_active,
      show_in_pos !== undefined ? (show_in_pos ? 1 : 0) : product.show_in_pos,
      parseFloat(min_stock_alert) ?? product.min_stock_alert,
      unit || product.unit,
      image_url !== undefined ? (image_url || null) : product.image_url,
      productId
    );

    logActivity(req.user.id, req.user.full_name, 'update', 'products', `تعديل منتج: ${name || product.name}`, 'product', productId);
    
    const updated = db.prepare(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
    `).get(productId);
    res.json({ success: true, data: updated, message: 'تم تحديث المنتج بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث المنتج' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ success: false, message: 'المنتج غير موجود' });

    const salesCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(productId);
    if (salesCount.count > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'لا يمكن حذف المنتج، تم استخدامه في مبيعات سابقة. يمكنك تعطيله بدلاً من الحذف.' 
      });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    logActivity(req.user.id, req.user.full_name, 'delete', 'products', `حذف منتج: ${product.name}`, 'product', productId);
    res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف المنتج' });
  }
});

module.exports = router;
