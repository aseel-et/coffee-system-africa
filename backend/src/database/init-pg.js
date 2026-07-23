const db = require('./connection');
const { createTables } = require('./schema');

async function main() {
  console.log('🚀 Connecting to Supabase PostgreSQL database...');
  try {
    await createTables();
    console.log('🎉 Supabase PostgreSQL Database Initialized & Seeded Successfully!');
    
    // Quick test query
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const productCount = await db.prepare('SELECT COUNT(*) as count FROM products').get();
    console.log(`📊 Total Users in Cloud DB: ${userCount?.count || 0}`);
    console.log(`📦 Total Products in Cloud DB: ${productCount?.count || 0}`);
  } catch (err) {
    console.error('❌ Failed to initialize Supabase DB:', err);
  } finally {
    if (db.isPg && db.rawDb) {
      await db.rawDb.end();
    }
  }
}

main();
