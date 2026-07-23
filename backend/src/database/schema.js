const db = require('./connection');
const { createAccountTables } = require('./accountsSchema');

async function createTables() {
  await db.exec(`
    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'cashier')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Categories table
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT,
      color TEXT DEFAULT '#6B7280',
      icon TEXT DEFAULT 'tag',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT,
      sku TEXT,
      category_id INTEGER,
      selling_price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      product_type TEXT NOT NULL DEFAULT 'non_stock' CHECK(product_type IN ('stock_tracked', 'non_stock')),
      is_active INTEGER NOT NULL DEFAULT 1,
      show_in_pos INTEGER NOT NULL DEFAULT 1,
      image_url TEXT,
      -- Stock fields (only relevant for stock_tracked type)
      current_stock REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 0,
      unit TEXT DEFAULT 'piece',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Customers table
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      balance REAL DEFAULT 0, -- Negative balance means debt, positive means credit
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

    -- Sales table
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      cashier_id INTEGER NOT NULL,
      customer_id INTEGER,
      payment_method TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash', 'card', 'mixed', 'debt')),
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      discount_percent REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      cash_amount REAL DEFAULT 0,
      card_amount REAL DEFAULT 0,
      debt_amount REAL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'voided', 'refunded')),
      shift_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);

    -- Sale items table
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

    -- Stock movements table
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL CHECK(movement_type IN ('sale', 'purchase', 'adjustment_in', 'adjustment_out', 'return')),
      quantity REAL NOT NULL,
      quantity_before REAL NOT NULL DEFAULT 0,
      quantity_after REAL NOT NULL DEFAULT 0,
      reason TEXT,
      reference_type TEXT,
      reference_id INTEGER,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

    -- Customer transactions table
    CREATE TABLE IF NOT EXISTS customer_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL CHECK(transaction_type IN ('payment', 'debt', 'refund', 'adjustment')),
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      notes TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchases table
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      supplier_id INTEGER,
      supplier_name TEXT,
      purchase_date DATE NOT NULL,
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received', 'pending', 'cancelled')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

    -- Purchase items table
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

    -- Expense categories table
    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT,
      color TEXT DEFAULT '#6B7280',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses table
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_category_id INTEGER,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      expense_date DATE NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(expense_category_id);

    -- Shifts table
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL,
      opening_cash REAL NOT NULL DEFAULT 0,
      closing_cash REAL,
      expected_cash REAL,
      cash_difference REAL,
      total_sales REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed')),
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

    -- Activity logs table
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action_type TEXT NOT NULL,
      module TEXT NOT NULL,
      description TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action_type);
    -- System binding table (Anti-theft)
    CREATE TABLE IF NOT EXISTS system_binding (
      id INTEGER PRIMARY KEY DEFAULT 1,
      machine_id TEXT NOT NULL,
      bound_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (id = 1) -- Ensure only one record exists
    );
  `);

  console.log('✅ Database tables created successfully');

  // AUTO-SEED ARABIC DATA IF EMPTY
  try {
    const catRow = await db.prepare("SELECT COUNT(*) as count FROM categories").get();
    const catCount = catRow ? (catRow.count || catRow.c || 0) : 0;
    if (catCount === 0) {
      console.log('🌱 Empty menu detected. Force seeding Arabic cafeteria data...');
      const bcrypt = require('bcryptjs');
      const adminHash = bcrypt.hashSync('admin123', 10);
      
      await db.prepare("INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)").run('admin', 'مدير النظام', adminHash, 'admin');
      await db.prepare("INSERT INTO settings (key, value) VALUES ('store_name', 'كافيتيريا جامعة أفريقيا')").run();
      
      const catHot = (await db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES ('Hot Drinks', 'مشروبات ساخنة', '#92400e', 'coffee')").run()).lastInsertRowid;
      const catFood = (await db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES ('Meals', 'وجبات وساندوتشات', '#b45309', 'utensils')").run()).lastInsertRowid;
      
      await db.prepare("INSERT INTO products (name, name_ar, category_id, selling_price, cost_price, product_type) VALUES ('Tea', 'شاي أحمر لبتون', ?, 2.5, 0.5, 'non_stock')").run(catHot);
      await db.prepare("INSERT INTO products (name, name_ar, category_id, selling_price, cost_price, product_type) VALUES ('Shawarma', 'شاورما دجاج ممتازة', ?, 15.0, 8.0, 'non_stock')").run(catFood);
      await db.prepare("INSERT INTO customers (name, phone, balance) VALUES ('أحمد علي المرجبي', '0910001122', -50.0)").run();
      console.log('✅ Arabic cafeteria data seeded successfully!');
    }
  } catch (e) {
    console.error('⚠️ Auto-seed warning:', e.message);
  }

  // Automatic migrations for existing databases
  try { await db.prepare('ALTER TABLE sales ADD COLUMN customer_id INTEGER').run(); } catch(e) {}
  try { await db.prepare('ALTER TABLE sales ADD COLUMN debt_amount REAL DEFAULT 0').run(); } catch(e) {}

  // Accounting tables + default chart of accounts (ERPNext-style)
  await createAccountTables();
}

module.exports = { createTables };

module.exports = { createTables };
