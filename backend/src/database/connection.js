const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const isPg = Boolean(process.env.DATABASE_URL);

let sqliteDb = null;
let pgPool = null;

if (isPg) {
  console.log('🌐 Connected to Cloud PostgreSQL database:', process.env.DATABASE_URL.split('@')[1] || 'Cloud Instance');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
  });
} else {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'cafeteria.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
}

/**
 * Converts SQLite SQL dialect into PostgreSQL SQL dialect
 */
function convertSql(sql) {
  let paramIndex = 1;
  let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  
  pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  pgSql = pgSql.replace(/DATETIME/gi, 'TIMESTAMP');
  
  return pgSql;
}

const db = {
  isPg,
  rawDb: isPg ? pgPool : sqliteDb,
  
  exec: async (sql) => {
    if (isPg) {
      const converted = convertSql(sql);
      return await pgPool.query(converted);
    } else {
      return sqliteDb.exec(sql);
    }
  },
  
  prepare: (sql) => {
    if (isPg) {
      const pgSql = convertSql(sql);
      return {
        get: async (...params) => {
          const flatParams = params.flat();
          const res = await pgPool.query(pgSql, flatParams);
          return res.rows[0] || null;
        },
        all: async (...params) => {
          const flatParams = params.flat();
          const res = await pgPool.query(pgSql, flatParams);
          return res.rows;
        },
        run: async (...params) => {
          const flatParams = params.flat();
          let querySql = pgSql;
          const isInsert = /^insert/i.test(querySql.trim());
          if (isInsert && !/returning/i.test(querySql)) {
            querySql += ' RETURNING id';
          }
          try {
            const res = await pgPool.query(querySql, flatParams);
            const lastInsertRowid = (res.rows && res.rows[0] && res.rows[0].id) ? res.rows[0].id : null;
            return {
              changes: res.rowCount,
              lastInsertRowid
            };
          } catch (err) {
            console.error('PostgreSQL Execution Error:', err.message, 'SQL:', querySql);
            throw err;
          }
        }
      };
    } else {
      const stmt = sqliteDb.prepare(sql);
      return {
        get: (...params) => stmt.get(...params.flat()),
        all: (...params) => stmt.all(...params.flat()),
        run: (...params) => stmt.run(...params.flat())
      };
    }
  },
  
  transaction: (fn) => {
    if (isPg) {
      return async (...args) => {
        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');
          const res = await fn(...args);
          await client.query('COMMIT');
          return res;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      };
    } else {
      return sqliteDb.transaction(fn);
    }
  }
};

module.exports = db;

