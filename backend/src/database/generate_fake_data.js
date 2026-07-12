const db = require('./connection');

const NUM_CATEGORIES = 15;
const NUM_PRODUCTS_PER_CAT = 15;
const NUM_CUSTOMERS = 100;
const NUM_SUPPLIERS = 20;
const NUM_SALES = 500;
const NUM_PURCHASES = 100;
const NUM_EXPENSES = 150;
const NUM_SHIFTS = 60;

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

console.log('🚀 Starting fake data generation...');

try {
db.transaction(() => {
  // 1. Generate Categories
  console.log('Generating categories...');
  const categoryNames = ['مشروبات باردة', 'مشروبات ساخنة', 'ساندوتشات', 'وجبات خفيفة', 'حلويات', 'عصائر طازجة', 'معجنات', 'وجبات رئيسية', 'إضافات', 'مخبوزات', 'مقبلات', 'سلطات', 'شاورما', 'برجر', 'وجبات عائلية'];
  const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9'];
  const icons = ['coffee', 'utensils', 'hamburger', 'pizza-slice', 'ice-cream', 'cookie', 'apple-alt', 'carrot', 'cheese', 'bread-slice'];
  
  const categoryIds = [];
  for (let i = 0; i < categoryNames.length; i++) {
    const info = db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES (?, ?, ?, ?)").run(
      `Category ${i+1}`, categoryNames[i], getRandom(colors), getRandom(icons)
    );
    categoryIds.push(info.lastInsertRowid);
  }

  // 2. Generate Products
  console.log('Generating products...');
  const productAdjectives = ['كبير', 'صغير', 'وسط', 'دبل', 'حار', 'عادي', 'مميز', 'طازج', 'إكسترا', 'بالجبنة'];
  const productTypes = ['stock_tracked', 'non_stock'];
  const productIds = [];
  
  for (let catId of categoryIds) {
    for (let i = 0; i < NUM_PRODUCTS_PER_CAT; i++) {
      const type = getRandom(productTypes);
      const cost = parseFloat((Math.random() * 20 + 2).toFixed(2));
      const price = parseFloat((cost * (1 + Math.random() * 1.5 + 0.2)).toFixed(2)); // markup 20% to 170%
      const info = db.prepare(`
        INSERT INTO products (name, name_ar, category_id, selling_price, cost_price, product_type, current_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `Product ${catId}-${i}`, 
        `منتج عشوائي ${catId}-${i} ${getRandom(productAdjectives)}`, 
        catId, 
        price, 
        cost, 
        type, 
        type === 'stock_tracked' ? getRandomInt(10, 500) : 0
      );
      productIds.push({ id: info.lastInsertRowid, price: price, cost: cost, type: type });
    }
  }

  // 3. Generate Customers
  console.log('Generating customers...');
  const firstNames = ['أحمد', 'محمد', 'محمود', 'علي', 'عمر', 'خالد', 'عبدالله', 'عبدالرحمن', 'حسن', 'حسين', 'فاطمة', 'عائشة', 'مريم', 'زينب', 'سارة'];
  const lastNames = ['السيد', 'علي', 'محمود', 'مصطفى', 'إبراهيم', 'حسن', 'عبدالله', 'عمر', 'سليمان', 'يوسف'];
  const customerIds = [];
  
  for (let i = 0; i < NUM_CUSTOMERS; i++) {
    const balance = (Math.random() < 0.3) ? -1 * getRandomInt(10, 2000) : 0; // 30% have debt
    const info = db.prepare("INSERT INTO customers (name, phone, balance) VALUES (?, ?, ?)").run(
      `${getRandom(firstNames)} ${getRandom(lastNames)}`,
      `09${getRandomInt(10000000, 99999999)}`,
      balance
    );
    customerIds.push(info.lastInsertRowid);

    if (balance < 0) {
      db.prepare(`
        INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, notes)
        VALUES (?, 'debt', ?, 0, ?, 'رصيد افتتاحي عبر التعبئة العشوائية')
      `).run(info.lastInsertRowid, Math.abs(balance), balance);
    }
  }

  // 4. Generate Suppliers
  console.log('Generating suppliers...');
  const supplierNames = ['شركة المراعي', 'شركة النسيم', 'مورد الجملة', 'مخبز الأمل', 'متجر المنظفات', 'مورد الخضار', 'مورد اللحوم', 'شركة العصائر', 'مورد البن', 'شركة المياه', 'التموين لخدمات الإعاشة', 'مورد الدواجن'];
  const supplierIds = [];
  
  for (let i = 0; i < NUM_SUPPLIERS; i++) {
    const name = supplierNames[i % supplierNames.length] + ' ' + (i > supplierNames.length ? String(i) : '');
    const info = db.prepare("INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)").run(name, `09${getRandomInt(10000000, 99999999)}`, 'المنطقة الصناعية');
    supplierIds.push(info.lastInsertRowid);
  }

  // Get users
  let users = db.prepare("SELECT id FROM users").all();
  if (users.length === 0) {
    db.prepare("INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)").run('admin_fake', 'Mock Admin', '123', 'admin');
    users = db.prepare("SELECT id FROM users").all();
  }
  const userIds = users.map(u => u.id);

  // 5. Generate Shifts
  console.log('Generating shifts...');
  const shiftIds = [];
  let currentDate = new Date();
  currentDate.setMonth(currentDate.getMonth() - 3); // start 3 months ago
  
  for (let i = 0; i < NUM_SHIFTS; i++) {
    const shiftStart = new Date(currentDate.getTime() + i * (24/2) * 60 * 60 * 1000); // 2 shifts per day roughly
    const shiftEnd = new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000); // 8 hours later
    const expectedCash = getRandomInt(500, 5000);
    const userId = getRandom(userIds);
    
    const info = db.prepare(`
      INSERT INTO shifts (cashier_id, opening_cash, closing_cash, expected_cash, cash_difference, total_sales, total_orders, status, opened_at, closed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'closed', ?, ?)
    `).run(userId, 200, expectedCash + getRandomInt(-20, 20), expectedCash, 0, expectedCash - 200, getRandomInt(20, 150), shiftStart.toISOString(), shiftEnd.toISOString());
    shiftIds.push({id: info.lastInsertRowid, opened_at: shiftStart.toISOString()});
  }

  // 6. Generate Sales
  console.log('Generating sales & items...');
  for (let i = 0; i < NUM_SALES; i++) {
    const shiftInfo = getRandom(shiftIds);
    let saleDate = new Date(shiftInfo.opened_at);
    saleDate = new Date(saleDate.getTime() + getRandomInt(0, 8 * 60 * 60 * 1000)); // random time within shift

    const isDebt = Math.random() < 0.25;
    const paymentMethod = isDebt ? 'debt' : (Math.random() < 0.2 ? 'card' : 'cash');
    const customerId = isDebt ? getRandom(customerIds) : null;
    let userId = getRandom(userIds);

    const invoiceNum = `INV-${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, '0')}${String(saleDate.getDate()).padStart(2, '0')}-${String(getRandomInt(1, 9999)).padStart(4, '0')}`;
    
    // sale items
    let subtotal = 0;
    const numItems = getRandomInt(1, 8);
    const saleItems = [];
    
    for(let j = 0; j < numItems; j++) {
      const p = getRandom(productIds);
      const qty = getRandomInt(1, 5);
      const total = p.price * qty;
      subtotal += total;
      saleItems.push({ productId: p.id, price: p.price, cost: p.cost, type: p.type, qty, total });
    }

    const discountAmount = Math.random() < 0.15 ? parseFloat((subtotal * (Math.random() * 0.2)).toFixed(2)) : 0;
    const total = subtotal - discountAmount;

    // insert sale
    const saleInfo = db.prepare(`
      INSERT INTO sales (invoice_number, cashier_id, customer_id, payment_method, subtotal, discount_amount, total, cash_amount, debt_amount, card_amount, shift_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoiceNum, userId, customerId, paymentMethod, subtotal, discountAmount, total, 
      paymentMethod === 'cash' ? total : 0, 
      paymentMethod === 'debt' ? total : 0, 
      paymentMethod === 'card' ? total : 0,
      shiftInfo.id, saleDate.toISOString());

    const saleId = saleInfo.lastInsertRowid;

    for (let item of saleItems) {
      db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, product_type, quantity, unit_price, cost_price, discount, total, created_at)
        VALUES (?, ?, (SELECT name_ar FROM products WHERE id=?), ?, ?, ?, ?, 0, ?, ?)
      `).run(saleId, item.productId, item.productId, item.type, item.qty, item.price, item.cost, item.total, saleDate.toISOString());

      if (item.type === 'stock_tracked') {
        db.prepare(`
          INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id, created_at)
          VALUES (?, 'sale', ?, 0, 0, 'مبيعات', 'sale', ?, ?, ?)
        `).run(item.productId, -item.qty, saleId, userId, saleDate.toISOString());
      }
    }

    if (paymentMethod === 'debt' && customerId) {
      const cust = db.prepare("SELECT balance FROM customers WHERE id = ?").get(customerId);
      const newBalance = cust.balance - total;
      db.prepare("UPDATE customers SET balance = ? WHERE id = ?").run(newBalance, customerId);
      db.prepare(`
        INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, notes, user_id, created_at)
        VALUES (?, 'debt', ?, ?, ?, 'sale', ?, 'فاتورة مبيعات آجل', ?, ?)
      `).run(customerId, total, cust.balance, newBalance, saleId, userId, saleDate.toISOString());

      // simulate some payments on debts
      if (Math.random() < 0.4) {
        const payDate = new Date(saleDate.getTime() + getRandomInt(1, 10) * 24 * 60 * 60 * 1000);
        const pAmt = getRandomInt(10, Math.floor(total));
        const currentCust = db.prepare("SELECT balance FROM customers WHERE id = ?").get(customerId);
        const balAfterPay = currentCust.balance + pAmt;
        db.prepare("UPDATE customers SET balance = ? WHERE id = ?").run(balAfterPay, customerId);
        db.prepare(`
          INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, notes, user_id, created_at)
          VALUES (?, 'payment', ?, ?, ?, 'دفعة سداد نقدية (عشوائي)', ?, ?)
        `).run(customerId, pAmt, currentCust.balance, balAfterPay, userId, payDate.toISOString());
      }
    }
  }

  // 7. Generate Expense Categories and Expenses
  console.log('Generating expenses...');
  const expenseCatNames = ['كهرباء', 'مياه', 'إيجار', 'رواتب', 'نظافة', 'صيانة معدات', 'ضيافة', 'نثريات', 'قرطاسية', 'تسويق وإعلانات', 'صيانة مباني', 'تأمين'];
  const expCatIds = [];
  for (let name of expenseCatNames) {
    const info = db.prepare("INSERT INTO expense_categories (name, name_ar) VALUES (?, ?)").run(`Expense ${name}`, name);
    expCatIds.push(info.lastInsertRowid);
  }

  let expDateStart = new Date();
  expDateStart.setMonth(expDateStart.getMonth() - 3);
  for (let i = 0; i < NUM_EXPENSES; i++) {
    const d = new Date(expDateStart.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000);
    const amt = getRandomInt(20, 2000);
    const catId = getRandom(expCatIds);
    db.prepare(`
      INSERT INTO expenses (expense_category_id, amount, description, expense_date, payment_method, created_by, created_at)
      VALUES (?, ?, ?, ?, 'cash', ?, ?)
    `).run(catId, amt, `مصروف عشوائي يمثل فاتورة أو خدمة - ${i}`, d.toISOString().split('T')[0], getRandom(userIds), d.toISOString());
  }

  // 8. Generate Purchases
  console.log('Generating purchases...');
  let purchDateStart = new Date();
  purchDateStart.setMonth(purchDateStart.getMonth() - 3);
  for (let i = 0; i < NUM_PURCHASES; i++) {
    const d = new Date(purchDateStart.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000);
    const supplierId = getRandom(supplierIds);
    const userId = getRandom(userIds);
    const numItems = getRandomInt(1, 15);
    
    let totalAmt = 0;
    const invNum = `PUR-${getRandomInt(10000, 999999)}`;
    const purchItems = [];

    for (let j = 0; j < numItems; j++) {
      const p = getRandom(productIds);
      const qty = getRandomInt(20, 200);
      const total = p.cost * qty;
      totalAmt += total;
      purchItems.push({ productId: p.id, qty, cost: p.cost, total, type: p.type });
    }

    const purchInfo = db.prepare(`
      INSERT INTO purchases (invoice_number, supplier_id, supplier_name, purchase_date, total_amount, status, created_by, created_at)
      VALUES (?, ?, (SELECT name FROM suppliers WHERE id=?), ?, ?, 'received', ?, ?)
    `).run(invNum, supplierId, supplierId, d.toISOString().split('T')[0], totalAmt, userId, d.toISOString());

    const purchId = purchInfo.lastInsertRowid;

    for (let item of purchItems) {
      db.prepare(`
        INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, total, created_at)
        VALUES (?, ?, (SELECT name_ar FROM products WHERE id=?), ?, ?, ?, ?)
      `).run(purchId, item.productId, item.productId, item.qty, item.cost, item.total, d.toISOString());

      if (item.type === 'stock_tracked') {
         db.prepare(`
          INSERT INTO stock_movements (product_id, movement_type, quantity, quantity_before, quantity_after, reason, reference_type, reference_id, user_id, created_at)
          VALUES (?, 'purchase', ?, 0, 0, 'فاتورة مشتريات', 'purchase', ?, ?, ?)
        `).run(item.productId, item.qty, purchId, userId, d.toISOString());
      }
    }
  }

})();
console.log('✅ Fake data generated successfully!! 🎉');
} catch (error) {
  console.error("❌ Error generating data: ", error);
}
