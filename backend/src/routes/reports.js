const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/reports/sales
router.get('/sales', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = start_date || today;
    const end = end_date || today;

    // Get sales by product
    const sales = db.prepare(`
      SELECT p.name as product_name, c.name as category_name,
        SUM(si.quantity) as quantity_sold,
        SUM(si.total) as revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      GROUP BY p.id
      ORDER BY revenue DESC
    `).all(start, end);

    // Summary
    const summaryRow = db.prepare(`
      SELECT COUNT(DISTINCT id) as total_orders,
        COALESCE(SUM(total), 0) as total_revenue
      FROM sales
      WHERE status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).get(start, end);

    res.json({ success: true, data: { sales, summary: summaryRow } });
  } catch (err) {
    console.error("Sales report error:", err);
    res.status(500).json({ success: false, message: 'خطأ في تقرير المبيعات' });
  }
});

// GET /api/reports/sales-by-product
router.get('/sales-by-product', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { from_date, to_date, category_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = from_date || today;
    const end = to_date || today;

    let query = `
      SELECT p.id, p.name, p.name_ar, c.name as category_name,
        SUM(si.quantity) as total_qty,
        SUM(si.total) as total_revenue,
        SUM(si.cost_price * si.quantity) as total_cost,
        SUM(si.total) - SUM(si.cost_price * si.quantity) as gross_profit,
        COUNT(DISTINCT si.sale_id) as order_count
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
    `;
    const params = [start, end];
    if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id); }
    query += ' GROUP BY si.product_id ORDER BY total_revenue DESC';
    
    const data = db.prepare(query).all(...params);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تقرير المبيعات حسب المنتج' });
  }
});

// GET /api/reports/sales-by-category
router.get('/sales-by-category', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = from_date || today;
    const end = to_date || today;

    const data = db.prepare(`
      SELECT c.id, c.name, c.color,
        SUM(si.total) as total_revenue,
        SUM(si.quantity) as total_qty,
        COUNT(DISTINCT si.sale_id) as order_count
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      GROUP BY p.category_id ORDER BY total_revenue DESC
    `).all(start, end);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تقرير المبيعات حسب التصنيف' });
  }
});

// GET /api/reports/employee-performance
router.get('/employee-performance', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = from_date || today;
    const end = to_date || today;

    const data = db.prepare(`
      SELECT u.id, u.full_name, u.username,
        COUNT(s.id) as total_orders,
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(AVG(s.total), 0) as avg_order_value,
        COALESCE(MAX(s.total), 0) as max_order,
        COALESCE(MIN(CASE WHEN s.total > 0 THEN s.total END), 0) as min_order
      FROM users u
      LEFT JOIN sales s ON s.cashier_id = u.id AND s.status = 'completed'
        AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      WHERE u.role = 'cashier'
      GROUP BY u.id ORDER BY total_sales DESC
    `).all(start, end);

    res.json({ success: true, data, period: { start, end } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تقرير أداء الموظفين' });
  }
});

// GET /api/reports/profit
router.get('/profit', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = start_date || today;
    const end = end_date || today;

    const details = db.prepare(`
      WITH dates AS (
        SELECT DISTINCT DATE(created_at) as date FROM sales WHERE status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?
        UNION
        SELECT DISTINCT expense_date as date FROM expenses WHERE expense_date >= ? AND expense_date <= ?
      )
      SELECT 
        d.date,
        COALESCE((SELECT SUM(total) FROM sales WHERE DATE(created_at) = d.date AND status = 'completed'), 0) as revenue,
        COALESCE((SELECT SUM(discount_amount) FROM sales WHERE DATE(created_at) = d.date AND status = 'completed'), 0) as discounts,
        COALESCE((SELECT SUM(si.cost_price * si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE DATE(s.created_at) = d.date AND s.status = 'completed'), 0) as cogs,
        COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date = d.date), 0) as expenses,
        (
          COALESCE((SELECT SUM(total) FROM sales WHERE DATE(created_at) = d.date AND status = 'completed'), 0) -
          COALESCE((SELECT SUM(si.cost_price * si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE DATE(s.created_at) = d.date AND s.status = 'completed'), 0) -
          COALESCE((SELECT SUM(amount) FROM expenses WHERE expense_date = d.date), 0)
        ) as profit
      FROM dates d
      ORDER BY d.date DESC
    `).all(start, end, start, end);

    const total_revenue = details.reduce((sum, d) => sum + d.revenue, 0);
    const total_cogs = details.reduce((sum, d) => sum + d.cogs, 0);
    const total_expenses = details.reduce((sum, d) => sum + d.expenses, 0);
    const net_profit = details.reduce((sum, d) => sum + d.profit, 0);

    res.json({
      success: true,
      data: {
        details,
        summary: { total_revenue, total_cogs, total_expenses, net_profit }
      }
    });
  } catch (err) {
    console.error("Profit report error:", err);
    res.status(500).json({ success: false, message: 'خطأ في تقرير الأرباح' });
  }
});

// GET /api/reports/inventory
router.get('/inventory', authenticateToken, requireAdmin, (req, res) => {
  try {
    const inventory = db.prepare(`
      SELECT p.id, p.name, p.name_ar, p.sku, p.current_stock, p.min_stock_alert, 
        p.unit, p.cost_price, p.selling_price,
        (p.current_stock * p.cost_price) as inventory_value,
        c.name as category_name,
        CASE 
          WHEN p.current_stock <= 0 THEN 'out_of_stock'
          WHEN p.current_stock <= p.min_stock_alert THEN 'low_stock'
          ELSE 'ok'
        END as stock_status
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.product_type = 'stock_tracked' AND p.is_active = 1
      ORDER BY stock_status ASC, p.current_stock ASC
    `).all();
    
    const summary = {
      total_products: inventory.length,
      total_inventory_value: inventory.reduce((sum, p) => sum + p.inventory_value, 0),
      out_of_stock: inventory.filter(p => p.stock_status === 'out_of_stock').length,
      low_stock_items: inventory.filter(p => p.stock_status === 'low_stock').length
    };

    res.json({ success: true, data: { inventory, summary } });
  } catch (err) {
    console.error("Inventory report error:", err);
    res.status(500).json({ success: false, message: 'خطأ في تقرير المخزون' });
  }
});

// GET /api/reports/expenses
router.get('/expenses', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { from_date, to_date, expense_category_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = from_date || today;
    const end = to_date || today;

    let query = `
      SELECT e.*, ec.name as category_name, ec.color as category_color
      FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      WHERE e.expense_date >= ? AND e.expense_date <= ?
    `;
    const params = [start, end];
    if (expense_category_id) { query += ' AND e.expense_category_id = ?'; params.push(expense_category_id); }
    query += ' ORDER BY e.expense_date DESC';
    
    const data = db.prepare(query).all(...params);
    const summary = { total: data.reduce((sum, e) => sum + e.amount, 0), count: data.length };
    res.json({ success: true, data, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تقرير المصاريف' });
  }
});

module.exports = router;
