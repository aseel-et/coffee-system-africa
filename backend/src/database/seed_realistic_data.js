const db = require('./connection');

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const realisticMenu = {
  'مشروبات ساخنة': {
    color: '#ef4444', icon: 'coffee',
    items: [
      { name: 'قهوة اسبريسو', cost: 1.5, price: 3.0 },
      { name: 'كابتشينو', cost: 2.0, price: 5.0 },
      { name: 'كافيه لاتيه', cost: 2.0, price: 5.0 },
      { name: 'ميكياتو', cost: 2.5, price: 5.5 },
      { name: 'نسكافيه', cost: 1.0, price: 3.0 },
      { name: 'شاي أحمر', cost: 0.5, price: 1.5 },
      { name: 'شاي بالحليب', cost: 0.8, price: 2.0 },
      { name: 'شاي أخضر', cost: 0.5, price: 1.5 },
      { name: 'قهوة تركية', cost: 1.0, price: 2.5 },
      { name: 'قهوة فرنسية', cost: 1.5, price: 3.5 },
      { name: 'موكا ساخنة', cost: 2.5, price: 6.0 },
      { name: 'هوت شوكليت', cost: 2.0, price: 5.0 }
    ]
  },
  'مشروبات باردة': {
    color: '#3b82f6', icon: 'tint',
    items: [
      { name: 'بيبسي', cost: 1.0, price: 2.0, type: 'stock_tracked' },
      { name: 'سفن أب', cost: 1.0, price: 2.0, type: 'stock_tracked' },
      { name: 'ميرندا برتقال', cost: 1.0, price: 2.0, type: 'stock_tracked' },
      { name: 'مياه معدنية صغيرة', cost: 0.5, price: 1.0, type: 'stock_tracked' },
      { name: 'مياه معدنية كبيرة', cost: 1.0, price: 2.0, type: 'stock_tracked' },
      { name: 'ريد بول', cost: 3.0, price: 6.0, type: 'stock_tracked' },
      { name: 'آيس كوفي', cost: 2.0, price: 4.5 },
      { name: 'آيس لاتيه', cost: 2.5, price: 5.0 },
      { name: 'آيس موكا', cost: 2.5, price: 5.5 }
    ]
  },
  'عصائر طازجة': {
    color: '#10b981', icon: 'blender',
    items: [
      { name: 'عصير برتقال طازج', cost: 1.5, price: 4.0 },
      { name: 'عصير مانجو', cost: 2.0, price: 4.5 },
      { name: 'عصير فراولة', cost: 2.0, price: 4.5 },
      { name: 'عصير جوافة', cost: 1.5, price: 4.0 },
      { name: 'عصير ليمون بالنعناع', cost: 1.0, price: 3.5 },
      { name: 'عصير موز بالحليب', cost: 1.5, price: 4.0 },
      { name: 'كوكتيل فواكه طبيعي', cost: 2.5, price: 6.0 },
      { name: 'عصير بطيخ', cost: 1.5, price: 3.5 }
    ]
  },
  'ساندوتشات وجبات': {
    color: '#f59e0b', icon: 'hamburger',
    items: [
      { name: 'شاورما دجاج (صغير)', cost: 3.0, price: 6.0 },
      { name: 'شاورما دجاج (كبير)', cost: 5.0, price: 10.0 },
      { name: 'شاورما لحم', cost: 6.0, price: 12.0 },
      { name: 'ساندوتش فاهيتا دجاج', cost: 4.0, price: 8.0 },
      { name: 'ساندوتش كبدة إسكندراني', cost: 3.5, price: 7.0 },
      { name: 'برجر لحم مشوي', cost: 4.5, price: 9.0 },
      { name: 'برجر دجاج كرسبي', cost: 4.0, price: 8.0 },
      { name: 'ساندوتش دجاج بانيه', cost: 3.5, price: 7.5 },
      { name: 'ساندوتش بطاطس سوري', cost: 2.0, price: 4.5 },
      { name: 'ساندوتش فلافل (طعمية)', cost: 1.0, price: 2.5 },
      { name: 'ساندوتش بيض بالجبن', cost: 1.5, price: 3.0 }
    ]
  },
  'وجبات خفيفة وإضافات': {
    color: '#8b5cf6', icon: 'pizza-slice',
    items: [
      { name: 'بطاطس مقلية (حجم عادي)', cost: 1.5, price: 3.5 },
      { name: 'بطاطس مقلية مع الجبن', cost: 2.0, price: 5.0 },
      { name: 'بيتزا مارغريتا (وسط)', cost: 7.0, price: 14.0 },
      { name: 'بيتزا دجاج (وسط)', cost: 9.0, price: 18.0 },
      { name: 'مكرونة بشاميل', cost: 6.0, price: 12.0 },
      { name: 'إضافة جبن موزاريلا', cost: 1.0, price: 2.5 },
      { name: 'صوص ثومية', cost: 0.5, price: 1.0 },
      { name: 'صوص جبن شيدر', cost: 1.0, price: 2.0 }
    ]
  },
  'حلويات ومخبوزات': {
    color: '#ec4899', icon: 'cookie',
    items: [
      { name: 'كيكة شوكولاتة', cost: 2.0, price: 5.0 },
      { name: 'تشيز كيك فراولة', cost: 3.0, price: 7.0 },
      { name: 'مولتن كيك', cost: 4.0, price: 9.0 },
      { name: 'دونتس شوكولاتة', cost: 1.5, price: 3.5, type: 'stock_tracked' },
      { name: 'دونتس سكر', cost: 1.0, price: 2.5, type: 'stock_tracked' },
      { name: 'كرواسون زبدة', cost: 1.5, price: 3.0, type: 'stock_tracked' },
      { name: 'كرواسون جبنة دبل', cost: 2.0, price: 4.0, type: 'stock_tracked' },
      { name: 'بسبوسة بالمكسرات', cost: 2.5, price: 5.5 },
      { name: 'سينابون كلاسيك', cost: 3.5, price: 7.5 }
    ]
  }
};

const NUM_SALES = 800;
const NUM_SHIFTS = 80;
const NUM_EXPENSES = 150;
const NUM_PURCHASES = 100;

console.log('🚀 Cleaning old generated data...');
try {
  db.transaction(() => {
    // 1. Wipe out old data
    db.prepare("DELETE FROM sale_items").run();
    db.prepare("DELETE FROM sales").run();
    db.prepare("DELETE FROM purchase_items").run();
    db.prepare("DELETE FROM purchases").run();
    db.prepare("DELETE FROM expenses").run();
    db.prepare("DELETE FROM expense_categories").run();
    db.prepare("DELETE FROM stock_movements").run();
    db.prepare("DELETE FROM customer_transactions").run();
    db.prepare("DELETE FROM shifts").run();
    db.prepare("DELETE FROM products").run();
    db.prepare("DELETE FROM categories").run();
    db.prepare("DELETE FROM customers").run();
    db.prepare("DELETE FROM suppliers").run();

    // 2. Insert Real Categories & Products
    console.log('Generating realistic categories and products...');
    const productIds = [];
    for (const [catName, catData] of Object.entries(realisticMenu)) {
      const catInfo = db.prepare("INSERT INTO categories (name, name_ar, color, icon) VALUES (?, ?, ?, ?)").run(
        catName, catName, catData.color, catData.icon
      );
      const catId = catInfo.lastInsertRowid;

      for (const item of catData.items) {
        const type = item.type || 'non_stock';
        const info = db.prepare(`
          INSERT INTO products (name, name_ar, category_id, selling_price, cost_price, product_type, current_stock)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          item.name, item.name, catId, item.price, item.cost, type, type === 'stock_tracked' ? getRandomInt(50, 300) : 0
        );
        productIds.push({ id: info.lastInsertRowid, price: item.price, cost: item.cost, type: type, name: item.name });
      }
    }

    // 3. Insert Real Customers (Students / Doctors / Guests)
    console.log('Generating realistic customers...');
    const realCustomerNames = [
      'د. أحمد منصور', 'د. خالد إبراهيم', 'أ. محمود سعد', 'الطالب محمد حسن', 'الطالبة سارة عبدالرحمن',
      'د. منى علي', 'أ. فاطمة يوسف', 'الطالب عمر طارق', 'الطالبة آية مصطفى', 'ياسر عبدالعزيز (المكتبة)',
      'سيد (أمن بوابة 1)', 'عماد (شؤون الطلبة)', 'د. حسام الدين', 'إبراهيم غريب', 'وليد فوزي'
    ];
    const customerIds = [];
    for (const name of realCustomerNames) {
       const balance = (Math.random() < 0.4) ? -1 * getRandomInt(20, 300) : 0;
       const info = db.prepare("INSERT INTO customers (name, phone, balance) VALUES (?, ?, ?)").run(
         name, `091${getRandomInt(1000000, 9999999)}`, balance
       );
       customerIds.push(info.lastInsertRowid);
       if (balance < 0) {
        db.prepare(`
          INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, notes)
          VALUES (?, 'debt', ?, 0, ?, 'رصيد ديون سابقة')
        `).run(info.lastInsertRowid, Math.abs(balance), balance);
      }
    }

    // 4. Insert Real Suppliers
    console.log('Generating realistic suppliers...');
    const realSuppliers = ['مخابز الشرق الآلي', 'شركة البيبسي الوطنية', 'مراعي العصائر الطازجة', 'مورد الخضروات (سوق الجملة)', 'قهوة البورصة (بن محمص)', 'شركة المياه الصافية', 'محلات اللحوم البلدية'];
    const supplierIds = [];
    for (const name of realSuppliers) {
      const info = db.prepare("INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)").run(
        name, `092${getRandomInt(1000000, 9999999)}`, 'المدينة'
      );
      supplierIds.push(info.lastInsertRowid);
    }

    const users = db.prepare("SELECT id FROM users").all();
    const userIds = users.map(u => u.id);
    const userId = userIds[0] || 1; 

    // 5. Generate Shifts
    console.log('Generating shifts...');
    const shiftIds = [];
    let currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() - 3); // start 3 months ago
    
    for (let i = 0; i < NUM_SHIFTS; i++) {
      const shiftStart = new Date(currentDate.getTime() + i * 28 * 60 * 60 * 1000); // spread shifts
      const shiftEnd = new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000); 
      const expectedCash = getRandomInt(1000, 4000);
      
      const info = db.prepare(`
        INSERT INTO shifts (cashier_id, opening_cash, closing_cash, expected_cash, cash_difference, total_sales, total_orders, status, opened_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'closed', ?, ?)
      `).run(userId, 200, expectedCash, expectedCash, 0, expectedCash - 200, getRandomInt(40, 100), shiftStart.toISOString(), shiftEnd.toISOString());
      shiftIds.push({id: info.lastInsertRowid, opened_at: shiftStart.toISOString()});
    }

    // 6. Generate Sales
    console.log('Generating sales & items...');
    for (let i = 0; i < NUM_SALES; i++) {
      const shiftInfo = getRandom(shiftIds);
      let saleDate = new Date(shiftInfo.opened_at);
      saleDate = new Date(saleDate.getTime() + getRandomInt(0, 8 * 60 * 60 * 1000)); 

      const isDebt = Math.random() < 0.15;
      const paymentMethod = isDebt ? 'debt' : (Math.random() < 0.25 ? 'card' : 'cash');
      const customerId = isDebt ? getRandom(customerIds) : null;

      const invoiceNum = `INV-${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, '0')}${String(saleDate.getDate()).padStart(2, '0')}-${String(getRandomInt(1, 9999)).padStart(4, '0')}`;
      
      let subtotal = 0;
      const numItems = getRandomInt(1, 6);
      const saleItems = [];
      
      for(let j = 0; j < numItems; j++) {
        const p = getRandom(productIds);
        const qty = getRandomInt(1, 4);
        const total = p.price * qty;
        subtotal += total;
        saleItems.push({ productId: p.id, price: p.price, cost: p.cost, type: p.type, name: p.name, qty, total });
      }

      const discountAmount = Math.random() < 0.10 ? parseFloat((subtotal * 0.1).toFixed(2)) : 0;
      const total = subtotal - discountAmount;

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
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(saleId, item.productId, item.name, item.type, item.qty, item.price, item.cost, item.total, saleDate.toISOString());

        if (item.type === 'stock_tracked') {
          db.prepare(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_type, reference_id, user_id, created_at)
            VALUES (?, 'sale', ?, 'مبيعات الكافيتيريا', 'sale', ?, ?, ?)
          `).run(item.productId, -item.qty, saleId, userId, saleDate.toISOString());
        }
      }

      if (paymentMethod === 'debt' && customerId) {
        const cust = db.prepare("SELECT balance FROM customers WHERE id = ?").get(customerId);
        const newBalance = cust.balance - total;
        db.prepare("UPDATE customers SET balance = ? WHERE id = ?").run(newBalance, customerId);
        db.prepare(`
          INSERT INTO customer_transactions (customer_id, transaction_type, amount, balance_before, balance_after, reference_type, reference_id, notes, user_id, created_at)
          VALUES (?, 'debt', ?, ?, ?, 'sale', ?, 'مديونية طلبات', ?, ?)
        `).run(customerId, total, cust.balance, newBalance, saleId, userId, saleDate.toISOString());
      }
    }

    // 7. Generate Expensive Categories
    console.log('Generating realistic expenses...');
    const expenseCatNames = ['فاتورة كهرباء كافيتيريا', 'شراء مواد تنظيف', 'صيانة ماكينة القهوة', 'رواتب العمال (سلفة)', 'شراء أكياس تغليف وأكواب ورقية', 'تعبئة أسطوانات الغاز', 'نولون نقل بضائع', 'مشتريات نثرية يومية'];
    const expCatIds = [];
    for (let name of expenseCatNames) {
      const info = db.prepare("INSERT INTO expense_categories (name, name_ar) VALUES (?, ?)").run(`Exp ${name}`, name);
      expCatIds.push(info.lastInsertRowid);
    }

    let minDate = new Date();
    minDate.setMonth(minDate.getMonth() - 3);
    for (let i = 0; i < NUM_EXPENSES; i++) {
      const d = new Date(minDate.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000);
      const amt = getRandomInt(10, 300);
      const catId = getRandom(expCatIds);
      db.prepare(`
        INSERT INTO expenses (expense_category_id, amount, description, expense_date, payment_method, created_by, created_at)
        VALUES (?, ?, ?, ?, 'cash', ?, ?)
      `).run(catId, amt, 'مصروفات يومية تشغيلية', d.toISOString().split('T')[0], userId, d.toISOString());
    }

    // 8. Generate Purchases
    console.log('Generating realistic purchases...');
    for (let i = 0; i < NUM_PURCHASES; i++) {
      const d = new Date(minDate.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000);
      const supplierId = getRandom(supplierIds);
      const numItems = getRandomInt(1, 5);
      
      let totalAmt = 0;
      const invNum = `INV-PUR-${getRandomInt(100000, 999999)}`;
      const purchItems = [];

      for (let j = 0; j < numItems; j++) {
        const p = getRandom(productIds);
        const qty = getRandomInt(20, 100);
        const total = p.cost * qty;
        totalAmt += total;
        purchItems.push({ productId: p.id, qty, cost: p.cost, total, type: p.type, name: p.name });
      }

      const purchInfo = db.prepare(`
        INSERT INTO purchases (invoice_number, supplier_id, supplier_name, purchase_date, total_amount, status, created_by, created_at)
        VALUES (?, ?, (SELECT name FROM suppliers WHERE id=?), ?, ?, 'received', ?, ?)
      `).run(invNum, supplierId, supplierId, d.toISOString().split('T')[0], totalAmt, userId, d.toISOString());

      const purchId = purchInfo.lastInsertRowid;

      for (let item of purchItems) {
        db.prepare(`
          INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(purchId, item.productId, item.name, item.qty, item.cost, item.total, d.toISOString());

        if (item.type === 'stock_tracked') {
           db.prepare(`
            INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_type, reference_id, user_id, created_at)
            VALUES (?, 'purchase', ?, 'شراء توريدات', 'purchase', ?, ?, ?)
          `).run(item.productId, item.qty, purchId, userId, d.toISOString());
        }
      }
    }

  })();
  console.log('✅ Realistic Fake data generated successfully!! 🎉');
} catch (error) {
  console.error("❌ Error generating data: ", error);
}
