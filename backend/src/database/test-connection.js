const { Pool } = require('pg');

const password = 'q5itJzXmdoX34YGk';
const projectRef = 'vjpmolsarbhzzyrihgpn';

// Potential pooler regions in Supabase
const poolers = [
  `postgres://${projectRef}:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  `postgres://postgres.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgres://postgres.${projectRef}:${password}@aws-0-me-central-1.pooler.supabase.com:6543/postgres`,
  `postgres://postgres.${projectRef}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgres://postgres.${projectRef}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  `postgres://postgres.${projectRef}:${password}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
];

async function testAll() {
  for (const uri of poolers) {
    console.log('\n🔍 Testing URI:', uri.replace(password, '****'));
    const pool = new Pool({ connectionString: uri, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('✅ CONNECTED SUCCESSFULLY! Time from DB:', res.rows[0].now);
      console.log('🎉 Working DATABASE_URL:');
      console.log(uri);
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.log('❌ Connection failed:', err.message);
    } finally {
      try { await pool.end(); } catch (e) {}
    }
  }
}

testAll();
