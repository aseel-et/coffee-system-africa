const db = require('./connection');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Starting database seeding...');

  // Check if already seeded
  const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (adminExists) {
    console.log('⚠️  Database already seeded. Skipping...');
    return;
  }

  // --- Settings ---
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('shop_name', 'كافيتيريا جامعة أفريقيا');
  insertSetting.run('shop_name_en', 'Africa University Cafeteria');
  insertSetting.run('currency', 'LYD');
  insertSetting.run('currency_symbol', 'د.ل');
  insertSetting.run('tax_percent', '0');
  insertSetting.run('receipt_footer', 'شكراً لزيارتكم • Thank you for your visit');
  insertSetting.run('low_stock_threshold', '5');
  insertSetting.run('theme', 'light');

  // --- Users ---
  const adminHash = bcrypt.hashSync('admin123', 10);
  const cashierHash = bcrypt.hashSync('cashier123', 10);
  const cashier2Hash = bcrypt.hashSync('cashier123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (username, full_name, password_hash, role, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  insertUser.run('admin', 'مدير النظام', adminHash, 'admin');
  insertUser.run('ahmed', 'أحمد محمد الكاشير', cashierHash, 'cashier');
  insertUser.run('fatima', 'فاطمة علي السالم', cashier2Hash, 'cashier');

  // --- Expense categories ---
  const insertExpCat = db.prepare(`
    INSERT INTO expense_categories (name, name_ar, color) VALUES (?, ?, ?)
  `);
  insertExpCat.run('إيجار', 'إيجار', '#EF4444');
  insertExpCat.run('رواتب', 'رواتب', '#F97316');
  insertExpCat.run('مرافق', 'مرافق', '#EAB308');
  insertExpCat.run('إنترنت', 'إنترنت', '#3B82F6');
  insertExpCat.run('تنظيف', 'تنظيف', '#22C55E');
  insertExpCat.run('صيانة', 'صيانة', '#8B5CF6');
  insertExpCat.run('مستلزمات', 'مستلزمات', '#EC4899');
  insertExpCat.run('متنوع', 'متنوع', '#6B7280');

  // --- Categories ---
  const insertCategory = db.prepare(`
    INSERT INTO categories (name, name_ar, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)
  `);
  const catCoffee = insertCategory.run('مشروبات ساخنة', 'مشروبات ساخنة', '#92400E', 'coffee', 1).lastInsertRowid;
  const catCold = insertCategory.run('مشروبات باردة', 'مشروبات باردة', '#1D4ED8', 'glass-water', 2).lastInsertRowid;
  const catSnacks = insertCategory.run('وجبات خفيفة', 'وجبات خفيفة', '#D97706', 'cookie', 3).lastInsertRowid;
  const catRetail = insertCategory.run('منتجات مغلقة', 'منتجات مغلقة', '#16A34A', 'package', 4).lastInsertRowid;

  // --- Products (non-stock: hot drinks) ---
  const insertProduct = db.prepare(`
    INSERT INTO products (name, name_ar, category_id, selling_price, cost_price, product_type, is_active, show_in_pos, current_stock, min_stock_alert, unit)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
  `);

  // Hot drinks (non-stock)
  insertProduct.run('إسبريسو', 'إسبريسو', catCoffee, 3.5, 1.0, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('لاتيه', 'لاتيه', catCoffee, 5.0, 1.5, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('كابوتشينو', 'كابوتشينو', catCoffee, 5.0, 1.5, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('أمريكانو', 'أمريكانو', catCoffee, 4.0, 1.0, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('موكا', 'موكا', catCoffee, 5.5, 1.8, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('شاي أحمر', 'شاي أحمر', catCoffee, 2.5, 0.5, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('شاي أخضر', 'شاي أخضر', catCoffee, 3.0, 0.8, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('قهوة عربية', 'قهوة عربية', catCoffee, 3.0, 0.7, 'non_stock', 0, 0, 'كوب');

  // Cold drinks (non-stock)
  insertProduct.run('عصير طازج - برتقال', 'عصير طازج برتقال', catCold, 6.0, 2.0, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('عصير طازج - مانجو', 'عصير طازج مانجو', catCold, 7.0, 2.5, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('سموذي مشكل', 'سموذي مشكل', catCold, 8.0, 3.0, 'non_stock', 0, 0, 'كوب');
  insertProduct.run('شوكولاتة باردة', 'شوكولاتة باردة', catCold, 6.0, 2.0, 'non_stock', 0, 0, 'كوب');

  // Snacks (non-stock)
  insertProduct.run('كعكة بالشوكولاتة', 'كعكة بالشوكولاتة', catSnacks, 4.0, 1.5, 'non_stock', 0, 0, 'قطعة');
  insertProduct.run('سندويشة جبن', 'سندويشة جبن', catSnacks, 5.0, 2.0, 'non_stock', 0, 0, 'قطعة');
  insertProduct.run('كرواسون', 'كرواسون', catSnacks, 3.5, 1.2, 'non_stock', 0, 0, 'قطعة');

  // Retail (stock-tracked)
  insertProduct.run('ماء معدني 500مل', 'ماء معدني 500مل', catRetail, 1.5, 0.7, 'stock_tracked', 50, 10, 'زجاجة');
  insertProduct.run('ماء معدني 1.5ل', 'ماء معدني 1.5ل', catRetail, 2.5, 1.2, 'stock_tracked', 30, 10, 'زجاجة');
  insertProduct.run('عصير علبة - تفاح', 'عصير علبة تفاح', catRetail, 3.0, 1.5, 'stock_tracked', 25, 5, 'علبة');
  insertProduct.run('عصير علبة - برتقال', 'عصير علبة برتقال', catRetail, 3.0, 1.5, 'stock_tracked', 20, 5, 'علبة');
  insertProduct.run('شوكولاتة كيت كات', 'شوكولاتة كيت كات', catRetail, 2.5, 1.2, 'stock_tracked', 40, 10, 'قطعة');
  insertProduct.run('شيبس محلي', 'شيبس محلي', catRetail, 2.0, 0.8, 'stock_tracked', 35, 10, 'كيس');
  insertProduct.run('بسكويت مشكل', 'بسكويت مشكل', catRetail, 3.0, 1.3, 'stock_tracked', 15, 5, 'علبة');
  insertProduct.run('علك', 'علك', catRetail, 1.0, 0.4, 'stock_tracked', 60, 15, 'قطعة');

  // --- Sample Expenses ---
  const insertExpense = db.prepare(`
    INSERT INTO expenses (expense_category_id, amount, description, expense_date, payment_method, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const today = new Date().toISOString().split('T')[0];
  const adminUserId = 1;
  insertExpense.run(1, 1500, 'إيجار الكافيتيريا - شهر مارس', today, 'cash', adminUserId);
  insertExpense.run(3, 200, 'فاتورة الكهرباء', today, 'cash', adminUserId);
  insertExpense.run(4, 80, 'اشتراك الإنترنت الشهري', today, 'cash', adminUserId);
  insertExpense.run(7, 150, 'مستلزمات التنظيف والمواد الاستهلاكية', today, 'cash', adminUserId);

  // --- Activity log for seeding ---
  const insertLog = db.prepare(`
    INSERT INTO activity_logs (user_id, user_name, action_type, module, description)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertLog.run(adminUserId, 'مدير النظام', 'system_init', 'system', 'تم تهيئة قاعدة البيانات وإضافة البيانات الأولية');

  console.log('✅ Database seeded successfully!');
  console.log('👤 Admin: username=admin, password=admin123');
  console.log('👤 Cashier 1: username=ahmed, password=cashier123');
  console.log('👤 Cashier 2: username=fatima, password=cashier123');
}

seed().catch(console.error);
