const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

// GET /api/users - List all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.prepare(`
      SELECT id, username, full_name, role, is_active, last_login, created_at, updated_at
      FROM users ORDER BY created_at DESC
    `).all();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المستخدمين' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await db.prepare(`
      SELECT id, username, full_name, role, is_active, last_login, created_at
      FROM users WHERE id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب المستخدم' });
  }
});

// POST /api/users - Create user
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, full_name, password, role, is_active = 1 } = req.body;
    
    if (!username || !full_name || !password || !role) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    if (!['admin', 'cashier'].includes(role)) {
      return res.status(400).json({ success: false, message: 'الدور غير صالح' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ success: false, message: 'اسم المستخدم موجود بالفعل' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.prepare(`
      INSERT INTO users (username, full_name, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, full_name, passwordHash, role, is_active ? 1 : 0);

    logActivity(req.user.id, req.user.full_name, 'create', 'users', `إضافة مستخدم جديد: ${full_name}`, 'user', result.lastInsertRowid);

    const newUser = await db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: newUser, message: 'تم إضافة المستخدم بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في إضافة المستخدم' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, full_name, password, role, is_active } = req.body;
    const userId = parseInt(req.params.id);

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    let newUsername = user.username;
    if (username && username.trim() !== '' && username !== user.username) {
      const existing = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return res.status(409).json({ success: false, message: 'اسم الدخول مأخوذ من قبل مستخدم آخر، يرجى اختيار اسم مختلف' });
      }
      newUsername = username;
    }

    let passwordHash = user.password_hash;
    if (password && password.length >= 6) {
      passwordHash = bcrypt.hashSync(password, 10);
    } else if (password && password.length > 0 && password.length < 6) {
      return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    await db.prepare(`
      UPDATE users SET username = ?, full_name = ?, password_hash = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newUsername, full_name || user.full_name, passwordHash, role || user.role, is_active !== undefined ? (is_active ? 1 : 0) : user.is_active, userId);

    logActivity(req.user.id, req.user.full_name, 'update', 'users', `تعديل بيانات المستخدم: ${full_name || user.full_name}`, 'user', userId);

    const updated = await db.prepare('SELECT id, username, full_name, role, is_active, updated_at FROM users WHERE id = ?').get(userId);
    res.json({ success: true, data: updated, message: 'تم تحديث المستخدم بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في تحديث المستخدم' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك الخاص' });
    }
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    await db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    logActivity(req.user.id, req.user.full_name, 'delete', 'users', `حذف المستخدم: ${user.full_name}`, 'user', userId);
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في حذف المستخدم' });
  }
});

// PATCH /api/users/:id/toggle-status
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    const newStatus = user.is_active ? 0 : 1;
    await db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, userId);
    
    logActivity(req.user.id, req.user.full_name, newStatus ? 'activate' : 'deactivate', 'users', 
      `${newStatus ? 'تفعيل' : 'تعطيل'} المستخدم: ${user.full_name}`);
    
    res.json({ success: true, message: newStatus ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في تغيير حالة المستخدم' });
  }
});

module.exports = router;
