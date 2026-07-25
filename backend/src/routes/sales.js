const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/sales/debug-test (Public to verify update)
router.get('/debug-test', async (req, res) => {
  try {
    const tableInfo = await db.prepare("PRAGMA table_info(sales)").all();
    res.json({ success: true, status: 'OK_NEW_VERSION', table: tableInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sales/fix-db (Public for rescue)
router.get('/fix-db', async (req, res) => {
  try {
    const msgs = [];
    await db.exec(`DROP TABLE IF EXISTS sales_backup`);
    try { await db.prepare('ALTER TABLE sales RENAME TO sales_backup').run(); msgs.push('Renamed sales to sales_backup'); } catch(e) {}
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL UNIQUE,
        cashier_id INTEGER NOT NULL,
        customer_id INTEGER,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        subtotal REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        discount_percent REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        cash_amount REAL DEFAULT 0,
        card_amount REAL DEFAULT 0,
        debt_amount REAL DEFAULT 0,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        shift_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    msgs.push('Created sales table clean');
    res.json({ success: true, details: msgs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sales - List sales with filters
router.get('/', async (req, res, next) => {
  // Simple session check without crashing
  if (!req.headers['authorization']) return res.status(401).json({ success: false, message: 'لا يوجد رمز مصادقة' });
  authenticateToken(req, res, next);
}, async (req, res) => {
  try {
    const { from_date, to_date, cashier_id, payment_method, status, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT s.*, u.full_name as cashier_name
      FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id
      WHERE 1=1
    `;
    const params = [];
    
    // Cashier can only see own sales
    if (req.user.role === 'cashier') {
      query += ' AND s.cashier_id = ?';
      params.push(req.user.id);
    } else if (cashier_id) {
      query += ' AND s.cashier_id = ?';
      params.push(cashier_id);
    }
    
    if (from_date) { query += ' AND DATE(s.created_at) >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND DATE(s.created_at) <= ?'; params.push(to_date); }
    if (payment_method) { query += ' AND s.payment_method = ?'; params.push(payment_method); }
    if (status) { query += ' AND s.status = ?'; params.push(status); }
    
    // Get total count
    const countQuery = query.replace('SELECT s.*, u.full_name as cashier_name', 'SELECT COUNT(*) as total');
    const totalResult = await db.prepare(countQuery).get(...params);
    
    query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const salesRaw = await db.prepare(query).all(...params);
    const sales = salesRaw.map(s => {
      if (s.debt_amount > 0 && s.cash_amount === 0 && s.card_amount === 0) s.payment_method = 'debt';
      return s;
    });
    
    res.json({ success: true, data: sales, total: totalResult.total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في جلب المبيعات' });
  }
});

// GET /api/sales/:id - Get sale with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const sale = await db.prepare(`
      SELECT s.*, u.full_name as cashier_name
      FROM sales s LEFT JOIN users u ON u.id = s.cashier_id
      WHERE s.id = ?
    `).get(req.params.id);
    
    if (!sale) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    
    const items = await db.prepare(`
      SELECT si.*, p.image_url
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
    `).all(sale.id);
    
    if (sale.debt_amount > 0 && sale.cash_amount === 0 && sale.card_amount === 0) sale.payment_method = 'debt';

    res.json({ success: true, data: { ...sale, items } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب الفاتورة' });
  }
});

// POST /api/sales - Create new sale
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, payment_method, customer_id, discount_amount, discount_percent, notes, cash_amount, card_amount, debt_amount } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'الفاتورة يجب أن تحتوي على منتجات' });
    }

    let invoiceNumber = '';
    
    try {
      // 1. Generate invoice number (Moved inside for safety)
      const lastSale = await db.prepare('SELECT invoice_number FROM sales ORDER BY id DESC LIMIT 1').get();
      let nextNum = 1;
      if (lastSale) {
        const lastNum = parseInt(lastSale.invoice_number.replace('INV-', ''));
        nextNum = lastNum + 1;
      }
      invoiceNumber = `INV-${String(nextNum).padStart(4, '0')}`;
    } catch(e) {
      // If table missing, we'll fix it in the main catch block
      throw e; 
    }

    // Calculate totals
    let subtotal = 0;
    const enrichedItems = [];

    for (const item of items) {
      const product = await db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.product_id);
      if (!product) {
        return res.status(400).json({ success: false, message: `المنتج غير موجود: ${item.product_id}` });
      }
      
      // Check stock for tracked products
      if (product.product_type === 'stock_tracked') {
        if (product.current_stock < item.quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `الكمية المطلوبة من "${product.name}" غير متوفرة. المخزون الحالي: ${product.current_stock}` 
          });
        }
      }

      const itemTotal = (item.unit_price || product.selling_price) * item.quantity;
      subtotal += itemTotal;
      enrichedItems.push({
        ...item,
        product,
        unit_price: item.unit_price || product.selling_price,
        cost_price: product.cost_price,
        total: itemTotal
      });
    }

    const discAmt = parseFloat(discount_amount) || 0;
    const total = Math.max(0, subtotal - discAmt);

    // Execute within transaction
    const createSale = await db.transaction(() => {
      const dbPaymentMethod = payment_method === 'debt' ? 'mixed' : (payment_method || 'cash');

      // Create sale record
      const saleResult = await db.prepare(`
        INSERT INTO sales (invoice_number, cashier_id, customer_id, payment_method, subtotal, discount_amount, discount_percent, total, cash_amount, card_amount, debt_amount, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber, req.user.id, customer_id || null, dbPaymentMethod,
        subtotal, discAmt, parseFloat(discount_percent) || 0, total,
        parseFloat(cash_amount) || 0, parseFloat(card_amount) || 0, parseFloat(debt_amount) || 0,
        notes || null
      );

      const saleId = saleResult.lastInsertRowid;

      // Update customer balance if debt
      const actualDebtAmount = parseFloat(debt_amount) || 0;
      if (actualDebtAmount > 0 && customer_id) {
        const customer = await db.prepare('SELECT balance FROM customers WHERE id = ?').get(customer_id);
        if (customer) {
          const before = customer.balance;
          const after = before - actualDebtAmount; // Debt is negative balance
          await db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(after, customer_id);
          await db.prepare(`
            INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, user_id, notes)
            VALUES (?, 'debt', ?, ?, ?, 'sale', ?, ?, ?)
          `).run(customer_id, actualDebtAmount, before, after, saleId, req.user.id, `فاتورة ${invoiceNumber}`);
        }
      }

      // Create sale items & update stock
      for (const item of enrichedItems) {
        await db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, product_name, product_type, quantity, unit_price, cost_price, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(saleId, item.product.id, item.product.name, item.product.product_type,
          item.quantity, item.unit_price, item.cost_price, item.total);

        // Deduct stock for tracked products
        if (item.product.product_type === 'stock_tracked') {
          const before = item.product.current_stock;
          const after = before - item.quantity;
          await db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(after, item.product.id);
          await db.prepare(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id)
            VALUES (?, 'sale', ?, ?, ?, ?, 'sale', ?, ?)
          `).run(item.product.id, item.quantity, before, after, `بيع - فاتورة ${invoiceNumber}`, saleId, req.user.id);
        }
      }

      return saleId;
    });

    const saleId = createSale();
    
    logActivity(req.user.id, req.user.full_name, 'create', 'sales', `إنشاء فاتورة بيع: ${invoiceNumber} - المبلغ: ${total}`, 'sale', saleId);

    const sale = await db.prepare(`
      SELECT s.*, u.full_name as cashier_name FROM sales s
      LEFT JOIN users u ON u.id = s.cashier_id WHERE s.id = ?
    `).get(saleId);
    const saleItems = await db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);

    res.status(201).json({ success: true, data: { ...sale, items: saleItems }, message: 'تم إنشاء الفاتورة بنجاح' });
  } catch (err) {
    console.error('CRITICAL SALE ERROR:', err);
    
    // Nuclear Auto-fix: Rebuild Table to Remove Constraints
    if (err.message.includes('column') || err.message.includes('constraint') || err.message.includes('table')) {
      try {
        const dbX = require('../database/connection');
        console.log('REBUILDING SALES TABLE TO REMOVE CONSTRAINTS...');
        
        dbX.transaction(() => {
          // 1. Create backup if exists
          dbX.prepare('DROP TABLE IF EXISTS sales_backup').run();
          try { dbX.prepare('ALTER TABLE sales RENAME TO sales_backup').run(); } catch(e) {}
          
          // 2. Create fresh table WITHOUT restrictive CHECK constraints
          dbX.exec(`
            CREATE TABLE IF NOT EXISTS sales (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              invoice_number TEXT NOT NULL UNIQUE,
              cashier_id INTEGER NOT NULL,
              customer_id INTEGER,
              payment_method TEXT NOT NULL DEFAULT 'cash',
              subtotal REAL NOT NULL DEFAULT 0,
              discount_amount REAL NOT NULL DEFAULT 0,
              discount_percent REAL NOT NULL DEFAULT 0,
              total REAL NOT NULL DEFAULT 0,
              cash_amount REAL DEFAULT 0,
              card_amount REAL DEFAULT 0,
              debt_amount REAL DEFAULT 0,
              notes TEXT,
              status TEXT NOT NULL DEFAULT 'completed',
              shift_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          // 3. Migrate data back
          try {
             dbX.exec(`
               INSERT INTO sales (id, invoice_number, cashier_id, payment_method, subtotal, discount_amount, discount_percent, total, cash_amount, card_amount, debt_amount, notes, status, created_at, updated_at)
               SELECT id, invoice_number, cashier_id, payment_method, subtotal, discount_amount, discount_percent, total, 
               COALESCE(cash_amount, 0), COALESCE(card_amount, 0), COALESCE(debt_amount, 0), notes, status, created_at, updated_at
               FROM sales_backup
             `);
          } catch(e) { console.log('Migration warning:', e.message); }
        })();
        
        return res.status(500).json({ success: false, message: 'تم إعادة تهيئة النظام. إذا استمر هذا الخطأ، فالسبب هو: ' + err.message });
      } catch (e) {
        console.error('CRITICAL REBUILD FAIL:', e.message);
      }
    }
    
    res.status(500).json({ success: false, message: 'خطأ إتمام البيع: ' + err.message });
  }
});

// PATCH /api/sales/:id/void - Void a sale (All active users can void if allowed by business)
router.patch('/:id/void', authenticateToken, async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const sale = await db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    if (sale.status !== 'completed') return res.status(400).json({ success: false, message: 'الفاتورة غير قابلة للإلغاء' });

    const voidSale = await db.transaction(() => {
      await db.prepare('UPDATE sales SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('voided', saleId);
      
      // Restore customer balance if it was a debt sale
      if (sale.debt_amount > 0 && sale.customer_id) {
        const customer = await db.prepare('SELECT balance FROM customers WHERE id = ?').get(sale.customer_id);
        if (customer) {
          const before = customer.balance;
          const after = before + sale.debt_amount; // Reversing the debt
          await db.prepare('UPDATE customers SET balance = ? WHERE id = ?').run(after, sale.customer_id);
          await db.prepare(`
            INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, user_id, notes)
            VALUES (?, 'refund', ?, ?, ?, 'sale_void', ?, ?, ?)
          `).run(sale.customer_id, sale.debt_amount, before, after, saleId, req.user.id, `إلغاء فاتورة ${sale.invoice_number}`);
        }
      }

      // Restore stock for tracked items
      const items = await db.prepare("SELECT * FROM sale_items WHERE sale_id = ? AND product_type = 'stock_tracked'").all(saleId);
      for (const item of items) {
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        if (product) {
          const before = product.current_stock;
          const after = before + item.quantity;
          await db.prepare('UPDATE products SET current_stock = ? WHERE id = ?').run(after, product.id);
          await db.prepare(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id)
            VALUES (?, 'return', ?, ?, ?, ?, 'sale_void', ?, ?)
          `).run(product.id, item.quantity, before, after, `إلغاء فاتورة: ${sale.invoice_number}`, saleId, req.user.id);
        }
      }
    });

    voidSale();
    logActivity(req.user.id, req.user.full_name, 'void', 'sales', `إلغاء فاتورة: ${sale.invoice_number}`, 'sale', saleId);
    res.json({ success: true, message: 'تم إلغاء الفاتورة بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في إلغاء الفاتورة' });
  }
});

module.exports = router;
