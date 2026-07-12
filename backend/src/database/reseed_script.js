const db = require('./connection');
const { createTables } = require('./schema');
const bcrypt = require('bcryptjs');

async function reseed() {
  console.log('--- STARTING TOTAL ARABIC RESEED ---');
  
  try {
    // 1. DROP ALL TABLES
    const tables = ['sales', 'sale_items', 'products', 'categories', 'customers', 'customer_transactions', 'expenses', 'expense_categories', 'users', 'settings', 'suppliers', 'purchases', 'purchase_items', 'shifts', 'activity_logs'];
    
    db.exec('PRAGMA foreign_keys = OFF');
    for (const table of tables) {
      db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }
    db.exec('PRAGMA foreign_keys = ON');
    console.log('✅ Tables dropped.');

    // 2. RECREATE TABLES
    createTables();
    console.log('✅ Tables recreated.');

    // 3. SEED ARABIC DATA
    const adminHash = bcrypt.hashSync('admin123', 10);
    const cashierHash = bcrypt.hashSync('cashier123', 10);
    
    // Users
    db.prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?,?,?,?)').run('admin', 'مدير النظام', adminHash, 'admin');
    db.prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?,?,?,?)').run('cashier', 'أحمد الكاشير', cashierHash, 'cashier');
    
    // Settings
    db.prepare("INSERT INTO settings (key, value) VALUES ('store_name', 'كافيتيريا جامعة أفريقيا')").run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('store_phone', '0912345678')").run();
    
    // Categories
    const catHot = db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES ('Hot Drinks', 'مشروبات ساخنة', '#92400e', 'coffee')").run().lastInsertRowid;
    const catFood = db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES ('Meals', 'وجبات وساندوتشات', '#b45309', 'utensils')").run().lastInsertRowid;
    const catCold = db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES ('Cold Drinks', 'مشروبات باردة', '#1d4ed8', 'glass-water')").run().lastInsertRowid;
    const catRetail = db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES ('Retail', 'منتجات مغلفة', '#15803d', 'package')").run().lastInsertRowid;
    
    // Products
    const prodStmt = db.prepare("INSERT INTO products (name, name_ar, category_id, selling_price, cost_price, product_type, current_stock, min_stock_alert, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    prodStmt.run('Red Tea', 'شاي أحمر لبتون', catHot, 2.5, 0.5, 'non_stock', 0, 0, 'كوب');
    prodStmt.run('Arabic Coffee', 'قهوة عربية أصيلة', catHot, 3.5, 1.0, 'non_stock', 0, 0, 'فنجان');
    prodStmt.run('Cappuccino', 'كابتشينو إيطالي', catHot, 6.0, 2.5, 'non_stock', 0, 0, 'كوب');
    
    prodStmt.run('Shawarma', 'شاورما دجاج ممتازة', catFood, 15.0, 8.0, 'non_stock', 0, 0, 'وجبة');
    prodStmt.run('Beef Burger', 'همبرجر لحم مشوي', catFood, 18.0, 10.0, 'non_stock', 0, 0, 'وجبة');
    prodStmt.run('Cheese Sandwich', 'ساندوتش جبنة فيتا', catFood, 5.0, 2.0, 'non_stock', 0, 0, 'ساندوتش');
    
    prodStmt.run('Water 500ml', 'ماء معدني بارد 500مل', catRetail, 1.5, 0.7, 'stock_tracked', 100, 10, 'زجاجة');
    prodStmt.run('Pepsi', 'بيبسي علبة بارد', catRetail, 3.0, 2.1, 'stock_tracked', 48, 10, 'علبة');
    
    // Customers
    db.prepare("INSERT INTO customers (name, phone, balance) VALUES ('أحمد علي المرجبي', '0910001122', -50.0)").run();
    db.prepare("INSERT INTO customers (name, phone, balance) VALUES ('سارة محمد عبد الله', '0925556677', -125.0)").run();
    db.prepare("INSERT INTO customers (name, phone, balance) VALUES ('خالد يوسف إبراهيم', '0918889900', 0)").run();
    
    // Expenses
    const expCat = db.prepare("INSERT INTO expense_categories (name, name_ar, color) VALUES ('General', 'عام وتكاليف', '#6b7280')").run().lastInsertRowid;
    db.prepare("INSERT INTO expenses (expense_category_id, amount, description, expense_date, created_by) VALUES (?, 500, 'يومية العمال والمساعدة', ?, 1)").run(expCat, new Date().toISOString().split('T')[0]);
    
    console.log('✅ SEEDING COMPLETE!');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }
}

reseed();
