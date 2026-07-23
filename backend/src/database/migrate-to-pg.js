const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function migrateData() {
  const targetPgUrl = process.env.DATABASE_URL;
  if (!targetPgUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is not defined in .env');
    process.exit(1);
  }

  const sqlitePath = process.env.DB_PATH || path.join(__dirname, 'cafeteria.db');
  if (!fs.existsSync(sqlitePath)) {
    console.error('❌ SQLite database file not found at:', sqlitePath);
    process.exit(1);
  }

  console.log('📂 Source SQLite database:', sqlitePath);
  console.log('🌐 Target PostgreSQL database URL:', targetPgUrl.split('@')[1] || 'Cloud Database');

  const sqliteDb = new Database(sqlitePath);
  const pgPool = new Pool({
    connectionString: targetPgUrl,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
  });

  const tables = [
    'users',
    'settings',
    'categories',
    'products',
    'customers',
    'sales',
    'sale_items',
    'stock_movements',
    'customer_transactions',
    'suppliers',
    'purchases',
    'purchase_items',
    'expense_categories',
    'expenses',
    'shifts',
    'activity_logs',
    'accounts',
    'journal_entries',
    'journal_entry_items'
  ];

  try {
    console.log('⚡ Initializing tables and schema in PostgreSQL...');
    const { createTables } = require('./schema');
    await createTables();

    for (const table of tables) {
      try {
        const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
        if (rows.length === 0) {
          console.log(`ℹ️ Table '${table}' is empty. Skipping...`);
          continue;
        }

        console.log(`🚀 Migrating table '${table}' (${rows.length} records)...`);
        
        const columns = Object.keys(rows[0]);
        const colsSql = columns.join(', ');

        // Batch insert in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuePlaceholders = [];
          const flatValues = [];
          let paramIdx = 1;

          for (const row of chunk) {
            const rowPlaceholders = columns.map(() => `$${paramIdx++}`);
            valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
            columns.forEach(col => flatValues.push(row[col]));
          }

          const batchSql = `INSERT INTO ${table} (${colsSql}) VALUES ${valuePlaceholders.join(', ')} ON CONFLICT DO NOTHING`;
          await pgPool.query(batchSql, flatValues);
        }

        if (columns.includes('id')) {
          await pgPool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) + 1 FROM ${table}), 1), false)`);
        }

        console.log(`✅ Table '${table}' migrated successfully!`);
      } catch (tableErr) {
        console.warn(`⚠️ Warning migrating table '${table}':`, tableErr.message);
      }
    }

    console.log('\n🎉 ALL DATA MIGRATED TO CLOUD POSTGRESQL (SUPABASE) SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

if (require.main === module) {
  migrateData();
}

module.exports = { migrateData };
