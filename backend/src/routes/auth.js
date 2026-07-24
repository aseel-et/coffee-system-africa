const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');
const { logActivity } = require('../utils/activityLogger');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // Update last login
    await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    logActivity(user.id, user.full_name, 'login', 'auth', `تسجيل دخول المستخدم: ${user.full_name}`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          last_login: user.last_login
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'خطأ في الخادم' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  const user = await db.prepare('SELECT id, username, full_name, role, last_login, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, data: user });
});

module.exports = router;
