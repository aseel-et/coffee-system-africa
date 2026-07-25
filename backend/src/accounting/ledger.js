const db = require('../database/connection');

// ── Account lookup ──
async function accId(code) {
  const r = await db.prepare('SELECT id FROM accounts WHERE code = ?').get(code);
  return r ? r.id : null;
}

// Map an expense (category + description) to an operating-expense ledger account.
async function mapExpenseAccountId(text) {
  const t = text || '';
  if (/كهربا|ماء|مياه|غاز/.test(t)) return accId('5220');
  if (/راتب|رواتب|عامل|عمال|أجور|اجور|سلفة/.test(t)) return accId('5210');
  if (/إيجار|ايجار/.test(t)) return accId('5230');
  if (/صيانة/.test(t)) return accId('5240');
  if (/تنظيف|تغليف|أكواب|اكواب|أكياس|اكياس/.test(t)) return accId('5250');
  if (/نقل|شحن|نولون/.test(t)) return accId('5260');
  return accId('5290');
}

const dateOf = async (s) => (s ? String(s).split('T')[0].substring(0, 10) : new Date().toISOString().split('T')[0]);

/**
 * Rebuild all auto-posted GL entries from the operational data
 * (sales, purchases, expenses, customer transactions). Manual journal
 * entries (voucher_type = 'Journal Entry') are preserved.
 */
async function rebuildLedger() {
  const CASH = accId('1110'), BANK = accId('1120'), AR = accId('1130'), STOCK = accId('1140');
  const SALES = accId('4110'), COGS = accId('5110'), OPEQ = accId('3120');

  const insEntry = db.prepare(`INSERT INTO gl_entries
    (posting_date, account_id, debit, credit, voucher_type, voucher_no, party, against, remarks)
    VALUES (@posting_date, @account_id, @debit, @credit, @voucher_type, @voucher_no, @party, @against, @remarks)`);

  const post = async (voucher_type, voucher_no, posting_date, lines, party = null, remarks = null) => {
    for (const ln of lines) {
      if ((ln.debit || 0) === 0 && (ln.credit || 0) === 0) continue;
      insEntry.run({
        posting_date, account_id: ln.account_id,
        debit: +(ln.debit || 0).toFixed(2), credit: +(ln.credit || 0).toFixed(2),
        voucher_type, voucher_no, party: ln.party || party || null,
        against: ln.against || null, remarks: ln.remarks || remarks || null,
      });
    }
  };

  const result = { sales: 0, purchases: 0, expenses: 0, payments: 0, openings: 0 };

  db.transaction(async () => {
    await db.prepare("DELETE FROM gl_entries WHERE voucher_type != 'Journal Entry'").run();

    // ── SALES ──
    const cogsBySale = {};
    await db.prepare(`SELECT sale_id, SUM(cost_price * quantity) AS c FROM sale_items
                WHERE product_type = 'stock_tracked' GROUP BY sale_id`).all()
      .forEach(r => { cogsBySale[r.sale_id] = r.c || 0; });

    const sales = await db.prepare(`SELECT s.id, s.invoice_number, s.created_at, s.total, s.cash_amount,
        s.card_amount, s.debt_amount, c.name AS customer_name
        FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
        WHERE s.status = 'completed'`).all();
    for (const s of sales) {
      const d = dateOf(s.created_at);
      const lines = [];
      if (s.cash_amount > 0) lines.push({ account_id: CASH, debit: s.cash_amount, against: 'إيرادات المبيعات' });
      if (s.card_amount > 0) lines.push({ account_id: BANK, debit: s.card_amount, against: 'إيرادات المبيعات' });
      if (s.debt_amount > 0) lines.push({ account_id: AR, debit: s.debt_amount, party: s.customer_name, against: 'إيرادات المبيعات' });
      lines.push({ account_id: SALES, credit: s.total });
      post('Sales Invoice', s.invoice_number, d, lines, s.customer_name);

      const cogs = cogsBySale[s.id] || 0;
      if (cogs > 0) {
        post('Sales Invoice', s.invoice_number, d, [
          { account_id: COGS, debit: cogs, against: 'المخزون' },
          { account_id: STOCK, credit: cogs, against: 'تكلفة البضاعة المباعة' },
        ]);
      }
      result.sales++;
    }

    // ── PURCHASES (cash) — split by product type: stocked goods → Inventory,
    //    consumables (non-stock, made-to-order) → COGS (expensed immediately) ──
    const splitByPurchase = {};
    await db.prepare(`SELECT pi.purchase_id, p.product_type, SUM(pi.total) AS amt
                FROM purchase_items pi LEFT JOIN products p ON p.id = pi.product_id
                GROUP BY pi.purchase_id, p.product_type`).all()
      .forEach(r => {
        const s = splitByPurchase[r.purchase_id] || (splitByPurchase[r.purchase_id] = { stock: 0, cogs: 0 });
        if (r.product_type === 'stock_tracked') s.stock += r.amt || 0; else s.cogs += r.amt || 0;
      });

    await db.prepare("SELECT id, invoice_number, purchase_date, total_amount, supplier_name FROM purchases WHERE status = 'received'").all()
      .forEach(p => {
        const split = splitByPurchase[p.id];
        let stockAmt = split ? split.stock : 0;
        let cogsAmt = split ? split.cogs : 0;
        if (stockAmt + cogsAmt === 0) stockAmt = p.total_amount; // fallback if no items
        const lines = [];
        if (stockAmt > 0) lines.push({ account_id: STOCK, debit: stockAmt, against: 'الصندوق' });
        if (cogsAmt > 0) lines.push({ account_id: COGS, debit: cogsAmt, against: 'الصندوق' });
        lines.push({ account_id: CASH, credit: stockAmt + cogsAmt, against: 'المشتريات' });
        post('Purchase', p.invoice_number, dateOf(p.purchase_date), lines, p.supplier_name);
        result.purchases++;
      });

    // ── EXPENSES ──
    await db.prepare(`SELECT e.id, e.amount, e.description, e.expense_date, e.payment_method, ec.name AS category_name
                FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id`).all()
      .forEach(e => {
        const exAcc = mapExpenseAccountId(`${e.category_name || ''} ${e.description || ''}`);
        const credAcc = e.payment_method === 'card' ? BANK : CASH;
        post('Expense', `EXP-${e.id}`, dateOf(e.expense_date), [
          { account_id: exAcc, debit: e.amount, remarks: e.description },
          { account_id: credAcc, credit: e.amount },
        ]);
        result.expenses++;
      });

    // ── CUSTOMER TRANSACTIONS (payments, refunds, opening balances) ──
    // 'debt' with reference_type='sale' is already captured by the sales posting → skip.
    await db.prepare(`SELECT ct.*, c.name AS customer_name FROM customer_transactions ct
                LEFT JOIN customers c ON c.id = ct.customer_id`).all()
      .forEach(t => {
        const d = dateOf(t.created_at);
        if (t.transaction_type === 'payment') {
          post('Payment', `PAY-${t.id}`, d, [
            { account_id: CASH, debit: t.amount, against: 'العملاء' },
            { account_id: AR, credit: t.amount, party: t.customer_name },
          ], t.customer_name);
          result.payments++;
        } else if (t.transaction_type === 'refund') {
          post('Refund', `REF-${t.id}`, d, [
            { account_id: AR, debit: t.amount, party: t.customer_name },
            { account_id: CASH, credit: t.amount },
          ], t.customer_name);
          result.payments++;
        } else if (t.transaction_type === 'debt' && t.reference_type !== 'sale') {
          // opening / pre-existing debt (not from a sale)
          post('Opening', `OPEN-${t.id}`, d, [
            { account_id: AR, debit: t.amount, party: t.customer_name, remarks: t.notes },
            { account_id: OPEQ, credit: t.amount },
          ], t.customer_name);
          result.openings++;
        } else if (t.transaction_type === 'adjustment') {
          const delta = (t.balance_after || 0) - (t.balance_before || 0); // negative => more debt
          const amt = Math.abs(delta);
          if (amt > 0) {
            const lines = delta < 0
              ? [{ account_id: AR, debit: amt, party: t.customer_name, remarks: t.notes }, { account_id: OPEQ, credit: amt }]
              : [{ account_id: OPEQ, debit: amt }, { account_id: AR, credit: amt, party: t.customer_name, remarks: t.notes }];
            post('Opening', `ADJ-${t.id}`, d, lines, t.customer_name);
            result.openings++;
          }
        }
      });
  })();

  return result;
}

// ── Reports ──

// Map of account_id -> {debit, credit} aggregated with an optional date filter.
async function aggregate(whereSql = '', params = []) {
  const rows = await db.prepare(`SELECT account_id, SUM(debit) AS debit, SUM(credit) AS credit
    FROM gl_entries ${whereSql ? 'WHERE ' + whereSql : ''} GROUP BY account_id`).all(...params);
  const m = {};
  rows.forEach(r => { m[r.account_id] = { debit: r.debit || 0, credit: r.credit || 0 }; });
  return m;
}

async function allAccounts() {
  return await db.prepare('SELECT * FROM accounts ORDER BY code').all();
}

// Natural balance for display: assets/expenses are debit-positive; others credit-positive.
async function naturalBalance(root, debit, credit) {
  return (root === 'asset' || root === 'expense') ? (debit - credit) : (credit - debit);
}

async function trialBalance(from, to) {
  const accounts = allAccounts().filter(a => !a.is_group);
  const openConds = [], openParams = [];
  if (from) { openConds.push('posting_date < ?'); openParams.push(from); }
  const opening = from ? aggregate(openConds.join(' AND '), openParams) : {};

  const perConds = [], perParams = [];
  if (from) { perConds.push('posting_date >= ?'); perParams.push(from); }
  if (to) { perConds.push('posting_date <= ?'); perParams.push(to); }
  const period = aggregate(perConds.join(' AND '), perParams);

  let totalDebit = 0, totalCredit = 0;
  const rows = accounts.map(a => {
    const op = opening[a.id] || { debit: 0, credit: 0 };
    const pe = period[a.id] || { debit: 0, credit: 0 };
    const openingBal = op.debit - op.credit;
    const closing = openingBal + pe.debit - pe.credit;
    totalDebit += pe.debit; totalCredit += pe.credit;
    return {
      id: a.id, code: a.code, name: a.name, name_ar: a.name_ar, root_type: a.root_type,
      opening: +openingBal.toFixed(2), debit: +pe.debit.toFixed(2), credit: +pe.credit.toFixed(2),
      closing: +closing.toFixed(2),
    };
  }).filter(r => r.opening || r.debit || r.credit || r.closing);

  return { rows, total_debit: +totalDebit.toFixed(2), total_credit: +totalCredit.toFixed(2) };
}

// Build a nested tree (groups + ledgers) with natural-balance amounts for the
// given root types, using a pre-aggregated balance map.
async function buildTree(rootTypes, balMap) {
  const accounts = allAccounts();
  const byParent = {};
  accounts.forEach(a => { (byParent[a.parent_id] = byParent[a.parent_id] || []).push(a); });

  const build = async (a) => {
    const node = {
      id: a.id, code: a.code, name: a.name, name_ar: a.name_ar,
      root_type: a.root_type, is_group: !!a.is_group, account_type: a.account_type,
      children: (byParent[a.id] || []).map(build),
    };
    const own = balMap[a.id] || { debit: 0, credit: 0 };
    const self = naturalBalance(a.root_type, own.debit, own.credit);
    const childSum = node.children.reduce((s, c) => s + c.amount, 0);
    node.amount = +((node.is_group ? childSum : self)).toFixed(2);
    return node;
  };

  return accounts.filter(a => a.parent_id === null && rootTypes.includes(a.root_type)).map(build);
}

async function profitLoss(from, to) {
  const conds = [], params = [];
  if (from) { conds.push('posting_date >= ?'); params.push(from); }
  if (to) { conds.push('posting_date <= ?'); params.push(to); }
  const bal = aggregate(conds.join(' AND '), params);

  const income = buildTree(['income'], bal);
  const expense = buildTree(['expense'], bal);
  const totalIncome = income.reduce((s, n) => s + n.amount, 0);
  const totalExpense = expense.reduce((s, n) => s + n.amount, 0);
  return {
    income, expense,
    total_income: +totalIncome.toFixed(2),
    total_expense: +totalExpense.toFixed(2),
    net_profit: +(totalIncome - totalExpense).toFixed(2),
  };
}

async function balanceSheet(asOf) {
  const conds = [], params = [];
  if (asOf) { conds.push('posting_date <= ?'); params.push(asOf); }
  const bal = aggregate(conds.join(' AND '), params);

  const assets = buildTree(['asset'], bal);
  const liabilities = buildTree(['liability'], bal);
  const equity = buildTree(['equity'], bal);

  const totalAssets = assets.reduce((s, n) => s + n.amount, 0);
  const totalLiab = liabilities.reduce((s, n) => s + n.amount, 0);
  let totalEquity = equity.reduce((s, n) => s + n.amount, 0);

  // Current period earnings (Income - Expense) shown under equity (ERPNext behaviour)
  const incomeTree = buildTree(['income'], bal);
  const expenseTree = buildTree(['expense'], bal);
  const currentEarnings = +(incomeTree.reduce((s, n) => s + n.amount, 0) - expenseTree.reduce((s, n) => s + n.amount, 0)).toFixed(2);
  totalEquity = +(totalEquity + currentEarnings).toFixed(2);

  return {
    assets, liabilities, equity,
    current_earnings: currentEarnings,
    total_assets: +totalAssets.toFixed(2),
    total_liabilities: +totalLiab.toFixed(2),
    total_equity: totalEquity,
    total_liabilities_equity: +(totalLiab + totalEquity).toFixed(2),
    balanced: Math.abs(totalAssets - (totalLiab + totalEquity)) < 0.5,
  };
}

async function generalLedger(accountId, from, to) {
  const account = await db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  if (!account) return null;

  let opening = 0;
  if (from) {
    const o = await db.prepare('SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM gl_entries WHERE account_id = ? AND posting_date < ?').get(accountId, from);
    opening = o.d - o.c;
  }

  const conds = ['account_id = ?']; const params = [accountId];
  if (from) { conds.push('posting_date >= ?'); params.push(from); }
  if (to) { conds.push('posting_date <= ?'); params.push(to); }
  const entries = await db.prepare(`SELECT posting_date, debit, credit, voucher_type, voucher_no, party, against, remarks
    FROM gl_entries WHERE ${conds.join(' AND ')} ORDER BY posting_date, id`).all(...params);

  let running = opening;
  const rows = entries.map(e => {
    running += (e.debit || 0) - (e.credit || 0);
    return { ...e, balance: +running.toFixed(2) };
  });
  const totDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);

  return {
    account: { id: account.id, code: account.code, name: account.name, name_ar: account.name_ar, root_type: account.root_type },
    opening: +opening.toFixed(2),
    rows,
    total_debit: +totDebit.toFixed(2),
    total_credit: +totCredit.toFixed(2),
    closing: +running.toFixed(2),
  };
}

module.exports = {
  rebuildLedger, trialBalance, profitLoss, balanceSheet, generalLedger, accId,
};
