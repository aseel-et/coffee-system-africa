const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/categories
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active_only } = req.query;
    let query = `
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    `;
    const conditions = [];
    if (active_only === 'true') conditions.push('c.is_active = 1');
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC';
    
    const categories = await db.prepare(query).all();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب التصنيفات' });
  }
});

// POST /api/categories
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, name_ar, color, icon, sort_order, is_active = 1 } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم التصنيف مطلوب' });
    
    const result = await db.prepare(`
      INSERT INTO categories (name, name_ar, color, icon, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, name_ar || name, color || '#92400E', icon || 'tag', sort_order || 0, is_active ? 1 : 0);

    logActivity(req.user.id, req.user.full_name, 'create', 'categories', `إضافة تصنيف: ${name}`, 'category', result.lastInsertRowid);
    
    const category = await db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: category, message: 'تم إضافة التصنيف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إضافة التصنيف' });
  }
});

// PUT /api/categories/:id
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, name_ar, color, icon, sort_order, is_active } = req.body;
    const catId = parseInt(req.params.id);
    
    const cat = await db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!cat) return res.status(404).json({ success: false, message: 'التصنيف غير موجود' });
    
    await db.prepare(`
      UPDATE categories SET name = ?, name_ar = ?, color = ?, icon = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || cat.name, name_ar || cat.name_ar, color || cat.color, 
      icon || cat.icon, sort_order ?? cat.sort_order, 
      is_active !== undefined ? (is_active ? 1 : 0) : cat.is_active, catId
    );

    logActivity(req.user.id, req.user.full_name, 'update', 'categories', `تعديل تصنيف: ${name || cat.name}`, 'category', catId);
    
    const updated = await db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    res.json({ success: true, data: updated, message: 'تم تحديث التصنيف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تحديث التصنيف' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const catId = parseInt(req.params.id);
    const cat = await db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);
    if (!cat) return res.status(404).json({ success: false, message: 'التصنيف غير موجود' });
    
    const productCount = await db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(catId);
    if (productCount.count > 0) {
      return res.status(409).json({ 
        success: false, 
        message: `لا يمكن حذف التصنيف، يحتوي على ${productCount.count} منتج. يرجى نقل أو حذف المنتجات أولاً.` 
      });
    }

    await db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
    logActivity(req.user.id, req.user.full_name, 'delete', 'categories', `حذف تصنيف: ${cat.name}`, 'category', catId);
    res.json({ success: true, message: 'تم حذف التصنيف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف التصنيف' });
  }
});

module.exports = router;
