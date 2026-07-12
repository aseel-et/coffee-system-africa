const db = require('./connection');

try {
  db.prepare('ALTER TABLE sales ADD COLUMN customer_id INTEGER').run();
  console.log('Successfully added customer_id to sales table');
} catch(e) {
  if (e.message.includes('duplicate column name')) {
    console.log('customer_id already exists');
  } else {
    console.log('Error adding customer_id:', e.message);
  }
}

try {
  db.prepare('ALTER TABLE sales ADD COLUMN debt_amount REAL DEFAULT 0').run();
  console.log('Successfully added debt_amount to sales table');
} catch(e) {
  if (e.message.includes('duplicate column name')) {
    console.log('debt_amount already exists');
  } else {
    console.log('Error adding debt_amount:', e.message);
  }
}

console.log('Migration complete');
process.exit(0);
