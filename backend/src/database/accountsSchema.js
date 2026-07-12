const db = require('./connection');

// ── ERPNext-style accounting schema: Chart of Accounts + General Ledger ──
function createAccountTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      name_ar TEXT,
      parent_id INTEGER,
      root_type TEXT NOT NULL CHECK(root_type IN ('asset','liability','equity','income','expense')),
      account_type TEXT,
      is_group INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_root ON accounts(root_type);

    CREATE TABLE IF NOT EXISTS gl_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      posting_date DATE NOT NULL,
      account_id INTEGER NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      voucher_type TEXT NOT NULL,
      voucher_no TEXT,
      party TEXT,
      against TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_gl_account ON gl_entries(account_id);
    CREATE INDEX IF NOT EXISTS idx_gl_date ON gl_entries(posting_date);
    CREATE INDEX IF NOT EXISTS idx_gl_voucher ON gl_entries(voucher_type, voucher_no);

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_no TEXT UNIQUE,
      posting_date DATE NOT NULL,
      remarks TEXT,
      total_debit REAL NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedChartOfAccounts();
}

// Default Arabic chart of accounts for the cafeteria (ERPNext-style 5 roots).
const CHART = [
  { code: '1000', name: 'Assets', ar: 'الأصول', root: 'asset', group: true, children: [
    { code: '1100', name: 'Current Assets', ar: 'الأصول المتداولة', group: true, children: [
      { code: '1110', name: 'Cash', ar: 'الصندوق (نقدية)', type: 'cash' },
      { code: '1120', name: 'Bank & Cards', ar: 'البنك والبطاقات', type: 'bank' },
      { code: '1130', name: 'Accounts Receivable', ar: 'العملاء (المدينون)', type: 'receivable' },
      { code: '1140', name: 'Stock In Hand', ar: 'المخزون', type: 'stock' },
    ] },
    { code: '1200', name: 'Fixed Assets', ar: 'الأصول الثابتة', group: true, children: [
      { code: '1210', name: 'Equipment', ar: 'المعدات والأجهزة', type: 'fixed_asset' },
    ] },
  ] },
  { code: '2000', name: 'Liabilities', ar: 'الخصوم (الالتزامات)', root: 'liability', group: true, children: [
    { code: '2100', name: 'Current Liabilities', ar: 'الخصوم المتداولة', group: true, children: [
      { code: '2110', name: 'Accounts Payable', ar: 'الموردون (الدائنون)', type: 'payable' },
      { code: '2120', name: 'Taxes Payable', ar: 'ضرائب مستحقة', type: 'tax' },
    ] },
  ] },
  { code: '3000', name: 'Equity', ar: 'حقوق الملكية', root: 'equity', group: true, children: [
    { code: '3110', name: 'Capital', ar: 'رأس المال', type: 'equity' },
    { code: '3120', name: 'Opening Balance Equity', ar: 'رصيد افتتاحي - حقوق الملكية', type: 'equity' },
    { code: '3130', name: 'Retained Earnings', ar: 'الأرباح المحتجزة', type: 'equity' },
  ] },
  { code: '4000', name: 'Income', ar: 'الإيرادات', root: 'income', group: true, children: [
    { code: '4110', name: 'Sales Revenue', ar: 'إيرادات المبيعات', type: 'income' },
    { code: '4120', name: 'Other Income', ar: 'إيرادات أخرى', type: 'income' },
  ] },
  { code: '5000', name: 'Expenses', ar: 'المصروفات', root: 'expense', group: true, children: [
    { code: '5110', name: 'Cost of Goods Sold', ar: 'تكلفة البضاعة المباعة', type: 'cogs' },
    { code: '5200', name: 'Operating Expenses', ar: 'المصروفات التشغيلية', group: true, children: [
      { code: '5210', name: 'Salaries & Wages', ar: 'رواتب وأجور', type: 'expense' },
      { code: '5220', name: 'Utilities', ar: 'كهرباء وماء وغاز', type: 'expense' },
      { code: '5230', name: 'Rent', ar: 'إيجار', type: 'expense' },
      { code: '5240', name: 'Maintenance', ar: 'صيانة', type: 'expense' },
      { code: '5250', name: 'Packaging & Cleaning', ar: 'مواد تنظيف وتغليف', type: 'expense' },
      { code: '5260', name: 'Transport', ar: 'نقل وشحن', type: 'expense' },
      { code: '5290', name: 'Other Expenses', ar: 'مصروفات أخرى', type: 'expense' },
    ] },
  ] },
];

function seedChartOfAccounts() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM accounts').get().c;
  if (count > 0) return;

  const insert = db.prepare(`INSERT INTO accounts (code, name, name_ar, parent_id, root_type, account_type, is_group)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insertTree = (node, root, parentId) => {
    const info = insert.run(node.code, node.name, node.ar, parentId, root, node.type || null, node.group ? 1 : 0);
    const id = info.lastInsertRowid;
    (node.children || []).forEach(child => insertTree(child, root, id));
  };
  db.transaction(() => {
    CHART.forEach(node => insertTree(node, node.root, null));
  })();
  console.log('✅ Default chart of accounts seeded');
}

module.exports = { createAccountTables, seedChartOfAccounts };
