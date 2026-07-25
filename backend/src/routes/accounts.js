const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/accounts/summary
router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    // Helper: run a query with optional date params
    const q = (sql, dateField, extraParams = []) => {
      let query = sql;
      const params = [...extraParams];
      if (from_date) { query += ` AND ${dateField} >= ?`; params.push(from_date); }
      if (to_date)   { query += ` AND ${dateField} <= ?`; params.push(to_date); }
      return { query, params };
    };

    // === 1. CASH BALANCE ===
    const { query: cq1, params: cp1 } = q(`SELECT COALESCE(SUM(cash_amount),0) as total FROM sales WHERE status='completed'`, 'DATE(created_at)');
    const cashFromSales = await db.prepare(cq1).get(...cp1).total;

    const { query: cq2, params: cp2 } = q(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE (payment_method='cash' OR payment_method IS NULL OR payment_method='')`, 'expense_date');
    const cashPaidExpenses = await db.prepare(cq2).get(...cp2).total;

    const { query: cq3, params: cp3 } = q(`SELECT COALESCE(SUM(total_amount),0) as total FROM purchases WHERE 1=1`, 'purchase_date');
    const cashPaidPurchases = await db.prepare(cq3).get(...cp3).total;

    const cashBalance = cashFromSales - cashPaidExpenses - cashPaidPurchases;

    // === 2. CARD BALANCE ===
    const { query: cardQ1, params: cardP1 } = q(`SELECT COALESCE(SUM(card_amount),0) as total FROM sales WHERE status='completed'`, 'DATE(created_at)');
    const cardFromSales = await db.prepare(cardQ1).get(...cardP1).total;

    const { query: cardQ2, params: cardP2 } = q(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE payment_method='card'`, 'expense_date');
    const cardPaidExpenses = await db.prepare(cardQ2).get(...cardP2).total;

    const cardBalance = cardFromSales - cardPaidExpenses;

    // === 3. PERIOD SALES SUMMARY ===
    const { query: saleQ, params: saleP } = q(`SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count FROM sales WHERE status='completed'`, 'DATE(created_at)');
    const totalSalesPeriod = await db.prepare(saleQ).get(...saleP);

    const { query: debtQ, params: debtP } = q(`SELECT COALESCE(SUM(debt_amount),0) as total FROM sales WHERE status='completed' AND debt_amount>0`, 'DATE(created_at)');
    const debtSalesPeriod = await db.prepare(debtQ).get(...debtP).total;

    // === 4. PERIOD EXPENSES SUMMARY ===
    const { query: expQ, params: expP } = q(`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count FROM expenses WHERE 1=1`, 'expense_date');
    const totalExpensesPeriod = await db.prepare(expQ).get(...expP);

    // === 5. PERIOD PURCHASES SUMMARY ===
    const { query: purQ, params: purP } = q(`SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count FROM purchases WHERE 1=1`, 'purchase_date');
    const totalPurchasesPeriod = await db.prepare(purQ).get(...purP);

    // === 6. CUSTOMER DEBTS (all-time) ===
    const customerDebtResult = await db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0) as total_debts,
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) as total_credits,
        COUNT(CASE WHEN balance < 0 THEN 1 END) as debtor_count,
        COUNT(CASE WHEN balance > 0 THEN 1 END) as creditor_count
      FROM customers WHERE is_active = 1
    `).get();

    // === 7. RECENT SALES ===
    const { query: rsQ, params: rsP } = q(`
      SELECT s.invoice_number, s.created_at, s.total, s.cash_amount, s.card_amount, s.debt_amount,
             s.payment_method, u.full_name as cashier_name
      FROM sales s LEFT JOIN users u ON u.id = s.cashier_id
      WHERE s.status='completed'`, 'DATE(s.created_at)');
    const recentSales = await db.prepare(rsQ + ' ORDER BY s.created_at DESC LIMIT 15').all(...rsP);

    // === 8. EXPENSES LIST ===
    const { query: elQ, params: elP } = q(`
      SELECT e.*, ec.name as category_name, u.full_name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      LEFT JOIN users u ON u.id = e.created_by
      WHERE 1=1`, 'e.expense_date');
    const recentExpenses = await db.prepare(elQ + ' ORDER BY e.expense_date DESC, e.created_at DESC').all(...elP);

    // === 9. EXPENSES BY CATEGORY ===
    const { query: ecQ, params: ecP } = q(`
      SELECT COALESCE(ec.name,'غير مصنف') as category_name, COALESCE(ec.color,'#6B7280') as color,
             COUNT(*) as count, COALESCE(SUM(e.amount),0) as total
      FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      WHERE 1=1`, 'e.expense_date');
    const expensesByCategory = await db.prepare(ecQ + ' GROUP BY e.expense_category_id ORDER BY total DESC').all(...ecP);

    // === 10. EXPENSES BY PAYMENT METHOD ===
    const { query: emQ, params: emP } = q(`
      SELECT COALESCE(payment_method,'cash') as payment_method, COUNT(*) as count, COALESCE(SUM(amount),0) as total
      FROM expenses WHERE 1=1`, 'expense_date');
    const expensesByMethod = await db.prepare(emQ + ' GROUP BY payment_method').all(...emP);

    // === 11. TOP DEBTORS ===
    const topDebtors = await db.prepare(`
      SELECT name, phone, balance FROM customers WHERE balance < 0 AND is_active = 1 ORDER BY balance ASC LIMIT 8
    `).all();

    // === 12. TODAY STATS ===
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await db.prepare(`
      SELECT COALESCE(SUM(cash_amount),0) as cash_today, COALESCE(SUM(card_amount),0) as card_today,
             COALESCE(SUM(debt_amount),0) as debt_today, COALESCE(SUM(total),0) as total_today,
             COUNT(*) as orders_today
      FROM sales WHERE DATE(created_at) = ? AND status='completed'
    `).get(today);

    res.json({
      success: true,
      data: {
        period: { from_date: from_date || null, to_date: to_date || null },
        // Balances
        cash_balance: cashBalance,
        card_balance: cardBalance,
        customer_debts: customerDebtResult.total_debts,
        customer_credits: customerDebtResult.total_credits,
        debtor_count: customerDebtResult.debtor_count,
        creditor_count: customerDebtResult.creditor_count,
        supplier_debt: 0,
        // Period
        total_sales_period: totalSalesPeriod.total,
        total_orders_period: totalSalesPeriod.count,
        total_expenses_period: totalExpensesPeriod.total,
        total_expenses_count: totalExpensesPeriod.count,
        total_purchases_period: totalPurchasesPeriod.total,
        total_purchases_count: totalPurchasesPeriod.count,
        debt_sales_period: debtSalesPeriod,
        net_profit_period: totalSalesPeriod.total - totalExpensesPeriod.total - totalPurchasesPeriod.total,
        // Breakdown
        cash_from_sales: cashFromSales,
        cash_paid_expenses: cashPaidExpenses,
        cash_paid_purchases: cashPaidPurchases,
        card_from_sales: cardFromSales,
        card_paid_expenses: cardPaidExpenses,
        total_expenses: totalExpensesPeriod.total,
        total_purchases: totalPurchasesPeriod.total,
        // Today
        today: todayStats,
        // Lists
        recent_sales: recentSales,
        recent_expenses: recentExpenses,
        expenses_by_category: expensesByCategory,
        expenses_by_method: expensesByMethod,
        top_debtors: topDebtors,
      }
    });
  } catch (err) {
    console.error('Accounts summary error:', err);
    res.status(500).json({ success: false, message: 'خطأ في جلب البيانات: ' + err.message });
  }
});

module.exports = router;
