const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/dashboard - Dashboard summary
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const start = from_date || today;
    const end = to_date || today;

    // Total sales
    const salesSummary = await db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'debt' THEN total ELSE 0 END), 0) as debt_sales
      FROM sales WHERE status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?
    `).get(start, end);

    // Customer balances
    const customerSummary = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_debts,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as total_credits
      FROM customers WHERE is_active = 1
    `).get();

    // Total expenses
    const expensesSummary = await db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN description LIKE '%عامل%' OR description LIKE '%عمال%' OR description LIKE '%يومية%' OR description LIKE '%راتب%' THEN amount ELSE 0 END), 0) as worker_salaries
      FROM expenses WHERE expense_date >= ? AND expense_date <= ?
    `).get(start, end);

    // Total purchases
    const purchasesSummary = await db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total_purchases
      FROM purchases WHERE purchase_date >= ? AND purchase_date <= ? AND status = 'received'
    `).get(start, end);

    // Estimated profit = Sales - Cost of goods sold - Expenses
    const cogsResult = await db.prepare(`
      SELECT COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
    `).get(start, end);

    const estimatedProfit = salesSummary.total_sales - cogsResult.total_cogs - expensesSummary.total_expenses;

    // Employee performance
    const employeePerformance = await db.prepare(`
      SELECT u.id, u.full_name, u.username,
        COUNT(s.id) as total_orders,
        COALESCE(SUM(s.total), 0) as total_sales,
        COALESCE(AVG(s.total), 0) as avg_order_value
      FROM users u
      LEFT JOIN sales s ON s.cashier_id = u.id AND s.status = 'completed'
        AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      WHERE u.role = 'cashier' AND u.is_active = 1
      GROUP BY u.id ORDER BY total_sales DESC
    `).all(start, end);

    // Top products
    const topProducts = await db.prepare(`
      SELECT p.name, p.name_ar, 
        SUM(si.quantity) as total_qty,
        SUM(si.total) as total_revenue,
        COUNT(DISTINCT si.sale_id) as order_count
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      GROUP BY si.product_id ORDER BY total_revenue DESC LIMIT 10
    `).all(start, end);

    // Sales by category
    const salesByCategory = await db.prepare(`
      SELECT c.name, c.color,
        SUM(si.total) as total_revenue,
        SUM(si.quantity) as total_qty
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.status = 'completed' AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
      GROUP BY p.category_id ORDER BY total_revenue DESC
    `).all(start, end);

    // Sales by payment method
    const salesByPayment = await db.prepare(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM sales WHERE status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?
      GROUP BY payment_method
    `).all(start, end);

    // Daily sales (for chart - last 7 or 30 days)
    const dailySales = await db.prepare(`
      SELECT DATE(created_at) as date, 
        COUNT(*) as orders, 
        COALESCE(SUM(total), 0) as sales
      FROM sales WHERE status = 'completed' AND DATE(created_at) >= ? AND DATE(created_at) <= ?
      GROUP BY DATE(created_at) ORDER BY date ASC
    `).all(start, end);

    // Recent sales
    const recentSales = await db.prepare(`
      SELECT s.id, s.invoice_number, s.total, s.payment_method, s.created_at, u.full_name as cashier_name
      FROM sales s LEFT JOIN users u ON u.id = s.cashier_id
      WHERE s.status = 'completed' ORDER BY s.created_at DESC LIMIT 10
    `).all();

    // Stock alerts
    const stockAlerts = await db.prepare(`
      SELECT id, name, current_stock, min_stock_alert, unit
      FROM products WHERE product_type = 'stock_tracked' AND is_active = 1 
        AND current_stock <= CASE WHEN min_stock_alert > 0 THEN min_stock_alert ELSE 5 END
      ORDER BY current_stock ASC LIMIT 10
    `).all();

    // Expenses by category (for chart)
    const expensesByCategory = await db.prepare(`
      SELECT ec.name, ec.color, COALESCE(SUM(e.amount), 0) as total
      FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      WHERE e.expense_date >= ? AND e.expense_date <= ?
      GROUP BY e.expense_category_id ORDER BY total DESC
    `).all(start, end);

    res.json({
      success: true,
      data: {
        period: { start, end },
        summary: {
          total_orders: salesSummary.total_orders,
          total_sales: salesSummary.total_sales,
          cash_sales: salesSummary.cash_sales,
          card_sales: salesSummary.card_sales,
          total_expenses: expensesSummary.total_expenses,
          worker_salaries: expensesSummary.worker_salaries,
          total_purchases: purchasesSummary.total_purchases,
          total_cogs: cogsResult.total_cogs,
          estimated_profit: estimatedProfit,
          total_debts: customerSummary.total_debts,
          debt_sales: salesSummary.debt_sales
        },
        employeePerformance,
        topProducts,
        salesByCategory,
        salesByPayment,
        dailySales,
        recentSales,
        stockAlerts,
        expensesByCategory
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في جلب بيانات لوحة القيادة' });
  }
});

module.exports = router;
