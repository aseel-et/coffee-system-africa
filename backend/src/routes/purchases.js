const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/purchases
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { from_date, to_date, supplier_id, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT pu.*, u.full_name as created_by_name
      FROM purchases pu
      LEFT JOIN users u ON u.id = pu.created_by
      WHERE 1=1
    `;
    const params = [];
    
    if (from_date) { query += ' AND pu.purchase_date >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND pu.purchase_date <= ?'; params.push(to_date); }
    if (supplier_id) { query += ' AND pu.supplier_id = ?'; params.push(supplier_id); }
    
    const countResult = await db.prepare(query.replace('SELECT pu.*, u.full_name as created_by_name', 'SELECT COUNT(*) as total')).get(...params);
    query += ' ORDER BY pu.purchase_date DESC, pu.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const purchases = await db.prepare(query).all(...params);
    res.json({ success: true, data: purchases, total: countResult.total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المشتريات' });
  }
});

// GET /api/purchases/:id
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const purchase = await db.prepare(`
      SELECT pu.*, u.full_name as created_by_name
      FROM purchases pu LEFT JOIN users u ON u.id = pu.created_by
      WHERE pu.id = ?
    `).get(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'فاتورة الشراء غير موجودة' });
    
    const items = await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchase.id);
    res.json({ success: true, data: { ...purchase, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب فاتورة الشراء' });
  }
});

// POST /api/purchases - Create purchase
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { supplier_name, purchase_date, items, notes } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'يجب إضافة منتج واحد على الأقل' });
    }
    if (!purchase_date) {
      return res.status(400).json({ success: false, message: 'تاريخ الشراء مطلوب' });
    }

    // Generate purchase number
    const lastPurchase = await db.prepare('SELECT invoice_number FROM purchases ORDER BY id DESC LIMIT 1').get();
    let nextNum = 1;
    if (lastPurchase) {
      const lastNum = parseInt(lastPurchase.invoice_number.replace('PUR-', ''));
      nextNum = lastNum + 1;
    }
    const invoiceNumber = `PUR-${String(nextNum).padStart(4, '0')}`;

    // Validate items and calculate total
    let totalAmount = 0;
    const enrichedItems = [];
    for (const item of items) {
      const product = await db.prepare("SELECT * FROM products WHERE id = ? AND product_type = 'stock_tracked'").get(item.product_id);
      if (!product) {
        return res.status(400).json({ success: false, message: `المنتج غير موجود أو ليس مخزونًا: ${item.product_id}` });
      }
      const itemTotal = parseFloat(item.unit_cost) * parseFloat(item.quantity);
      totalAmount += itemTotal;
      enrichedItems.push({ ...item, product, total: itemTotal });
    }

    const createPurchase = db.transaction(async () => {
      const purchaseResult = await db.prepare(`
        INSERT INTO purchases (invoice_number, supplier_name, purchase_date, total_amount, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(invoiceNumber, supplier_name || null, purchase_date, totalAmount, notes || null, req.user.id);

      const purchaseId = purchaseResult.lastInsertRowid;

      for (const item of enrichedItems) {
        await db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(purchaseId, item.product.id, item.product.name, item.quantity, item.unit_cost, item.total);

        // Increase stock
        const before = item.product.current_stock;
        const after = before + parseFloat(item.quantity);
        db.prepare('UPDATE products SET current_stock = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(after, parseFloat(item.unit_cost), item.product.id);
        
        await db.prepare(`
          INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id)
          VALUES (?, 'purchase', ?, ?, ?, ?, 'purchase', ?, ?)
        `).run(item.product.id, item.quantity, before, after, `شراء - فاتورة ${invoiceNumber}`, purchaseId, req.user.id);
      }

      return purchaseId;
    });

    const purchaseId = createPurchase();
    logActivity(req.user.id, req.user.full_name, 'create', 'purchases', `إنشاء فاتورة شراء: ${invoiceNumber} - المبلغ: ${totalAmount}`, 'purchase', purchaseId);

    const purchase = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    const purchaseItems = await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);
    res.status(201).json({ success: true, data: { ...purchase, items: purchaseItems }, message: 'تم إنشاء فاتورة الشراء بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إنشاء فاتورة الشراء' });
  }
});

// PUT /api/purchases/:id - Update purchase
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { supplier_name, invoice_number, purchase_date, items, notes } = req.body;
    const purchaseId = req.params.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'يجب إضافة منتج واحد على الأقل' });
    }

    const oldPurchase = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!oldPurchase) {
      return res.status(404).json({ success: false, message: 'فاتورة الشراء غير موجودة' });
    }

    // Validate new items and calculate total
    let totalAmount = 0;
    const enrichedItems = [];
    for (const item of items) {
      const product = await db.prepare("SELECT * FROM products WHERE id = ? AND product_type = 'stock_tracked'").get(item.product_id);
      if (!product) {
        return res.status(400).json({ success: false, message: `المنتج غير موجود أو ليس مخزونًا: ${item.product_id}` });
      }
      const itemTotal = parseFloat(item.unit_cost) * parseFloat(item.quantity);
      totalAmount += itemTotal;
      enrichedItems.push({ ...item, product, total: itemTotal });
    }

    db.transaction(async () => {
      // 1. Revert old items stock
      const oldItems = await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);
      for (const oldItem of oldItems) {
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(oldItem.product_id);
        if (product) {
          const newStock = product.current_stock - oldItem.quantity;
          await db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, product.id);
          await db.prepare(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id)
            VALUES (?, 'adjustment_out', ?, ?, ?, ?, 'purchase', ?, ?)
          `).run(product.id, -oldItem.quantity, product.current_stock, newStock, `تعديل وإلغاء كمية فاتورة شراء ${oldPurchase.invoice_number}`, purchaseId, req.user.id);
        }
      }

      // 2. Delete old items
      await db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(purchaseId);

      // 3. Update purchase record
      await db.prepare(`
        UPDATE purchases
        SET supplier_name = ?, invoice_number = ?, purchase_date = ?, total_amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(supplier_name || null, invoice_number || oldPurchase.invoice_number, purchase_date || oldPurchase.purchase_date, totalAmount, notes || null, purchaseId);

      // 4. Insert new items and apply stock
      for (const item of enrichedItems) {
        await db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(purchaseId, item.product.id, item.product.name, item.quantity, item.unit_cost, item.total);

        // Fetch fresh product stock since it changed in Step 1
        const freshProduct = await db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product.id);
        const before = freshProduct ? freshProduct.current_stock : 0;
        const after = before + parseFloat(item.quantity);

        db.prepare('UPDATE products SET current_stock = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(after, parseFloat(item.unit_cost), item.product.id);
        
        await db.prepare(`
          INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id)
          VALUES (?, 'purchase', ?, ?, ?, ?, 'purchase', ?, ?)
        `).run(item.product.id, item.quantity, before, after, `شراء بعد التعديل - فاتورة ${oldPurchase.invoice_number}`, purchaseId, req.user.id);
      }
    })();

    logActivity(req.user.id, req.user.full_name, 'update', 'purchases', `تعديل فاتورة شراء: ${oldPurchase.invoice_number}`, 'purchase', purchaseId);

    res.json({ success: true, message: 'تم تحديث الفاتورة بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث فاتورة الشراء' });
  }
});

// DELETE /api/purchases/:id - Delete purchase
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const purchase = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'فاتورة الشراء غير موجودة' });
    }

    db.transaction(async () => {
      const items = await db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);
      
      for (const item of items) {
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (product) {
          const newStock = product.current_stock - item.quantity;
          await db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStock, product.id);
          await db.prepare(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id)
            VALUES (?, 'adjustment_out', ?, ?, ?, ?, 'purchase', ?, ?)
          `).run(product.id, -item.quantity, product.current_stock, newStock, `حذف فاتورة شراء ${purchase.invoice_number}`, purchaseId, req.user.id);
        }
      }
      
      await db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(purchaseId);
      await db.prepare('DELETE FROM purchases WHERE id = ?').run(purchaseId);
    })();

    logActivity(req.user.id, req.user.full_name, 'delete', 'purchases', `حذف فاتورة شراء: ${purchase.invoice_number}`, 'purchase', purchaseId);
    res.json({ success: true, message: 'تم حذف الفاتورة بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في حذف الفاتورة' });
  }
});

module.exports = router;
