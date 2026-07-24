require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./database/connection');
const { createTables } = require('./database/schema');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const license = require('./license');

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const productsRoutes = require('./routes/products');
const productsExcelRoutes = require('./routes/productsExcel');
const salesRoutes = require('./routes/sales');
const inventoryRoutes = require('./routes/inventory');
const purchasesRoutes = require('./routes/purchases');
const expensesRoutes = require('./routes/expenses');
const dashboardRoutes = require('./routes/dashboard');
const reportsRoutes = require('./routes/reports');
const activityLogsRoutes = require('./routes/activityLogs');
const settingsRoutes = require('./routes/settings');
const customersRoutes = require('./routes/customers');
const customersExcelRoutes = require('./routes/customersExcel');
const inventoryExcelRoutes = require('./routes/inventoryExcel');
const licenseRoutes = require('./routes/license');
const accountsRoutes = require('./routes/accounts');
const accountingRoutes = require('./routes/accounting');

// Initialize database
(async () => {
  try {
    await createTables();

    // Ensure default Admin exists
    try {
      const adminRow = await db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('admin');
      const adminCount = Number(adminRow?.count || adminRow?.c || 0);
      if (adminCount === 0) {
        const bcrypt = require('bcryptjs');
        const adminHash = bcrypt.hashSync('admin123', 10);
        const cashierHash = bcrypt.hashSync('cashier123', 10);
        
        await db.prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)').run('admin', 'مدير النظام', adminHash, 'admin');
        await db.prepare('INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)').run('cashier', 'موظف مبيعات', cashierHash, 'cashier');
        
        console.log('✅ Default users created (admin / admin123) and (cashier / cashier123)');
      }
    } catch (e) {
      console.error('Admin check error:', e.message);
    }
  } catch (err) {
    console.error('Database initialization warning:', err.message);
  }
})();

// ── Hardware Binding (Anti-Theft Protection) ──
if (!db.isPg) {
  try {
    const currentMachineId = license.getMachineId();
    const binding = db.prepare('SELECT machine_id FROM system_binding WHERE id = 1').get();

    if (!binding) {
      // First time opening this database - lock it to this machine
      db.prepare('INSERT INTO system_binding (machine_id) VALUES (?)').run(currentMachineId);
      console.log('🔒 Database successfully bound to this hardware.');
    } else if (binding.machine_id !== currentMachineId) {
      // Security Breach: Database was copied from another machine
      console.error('\x1b[31m%s\x1b[0m', '🛑 [فشل أمني] قاعدة البيانات هذه مرتبطة بجهاز كمبيوتر آخر ولا يمكن فتحها هنا.');
      console.error('\x1b[33m%s\x1b[0m', 'Security Alert: Database hardware mismatch. Access Denied.');
      process.env.DB_LOCKED = 'true';
    }
  } catch (e) {
    console.warn('Hardware binding skipped:', e.message);
  }
} else {
  console.log('🌐 Running in Cloud Mode (PostgreSQL). Hardware binding disabled.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Force CORS headers on all requests and immediately satisfy preflight OPTIONS
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── License Check Middleware ──
// License and auth routes are always accessible
// All other API routes require activation
app.use('/api/license', licenseRoutes);
app.use('/api/auth', authRoutes);

// Middleware: block all other /api/* routes if not activated or if DB is locked
app.use('/api', (req, res, next) => {
  // Check Hardware Binding First
  if (process.env.DB_LOCKED === 'true') {
    return res.status(403).json({
      success: false,
      message: 'تم اكتشاف محاولة نقل غير قانونية للبيانات. هذه النسخة مرتبطة بجهاز آخر.',
      code: 'DB_HARDWARE_MISMATCH'
    });
  }

  if (!license.isActivated()) {
    return res.status(403).json({
      success: false,
      message: 'النظام غير مفعل. يرجى إدخال مفتاح التفعيل.',
      code: 'LICENSE_REQUIRED'
    });
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'كافيتيريا جامعة أفريقيا - النظام يعمل بشكل طبيعي',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsExcelRoutes); // export / template / import (must precede :id routes)
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryExcelRoutes); // export / template / import
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', customersExcelRoutes); // export / template / import
app.use('/api/customers', customersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/accounting', accountingRoutes);

// ── Serve Frontend (Production) ──
const frontendBuildPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(frontendBuildPath)) {
  app.use(express.static(frontendBuildPath));
  // SPA fallback: all non-API routes serve index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  // Development mode: no static files, handled by Vite dev server
  console.log('ℹ️  Frontend build not found. Running in development mode.');
}

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  const activated = license.isActivated();
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   كافيتيريا جامعة أفريقيا - نظام الإدارة       ║');
  console.log('║   Africa University Cafeteria Management System ║');
  console.log(`║   Server running on: http://localhost:${PORT}       ║`);
  console.log(`║   License: ${activated ? '✅ مفعل (Activated)' : '❌ غير مفعل (Not Activated)'}         ║`);
  console.log('╚════════════════════════════════════════════════╝');
  if (!activated) {
    const machineId = license.getMachineId();
    console.log('');
    console.log(`  ⚠️  Machine ID: ${machineId}`);
    console.log('  ⚠️  يرجى تفعيل النظام من صفحة التفعيل');
  }
  console.log('');
});

module.exports = app;
